#include "app_config.h"  /* Must be first for RCSP_BTMATE_EN */
#include "vm_ble_service.h"
#include "vm_ble_profile.h"
#include "vm_motor_control.h"

/* JieLi SDK includes */
#include "gatt_common/le_gatt_common.h"
#include "btstack/bluetooth.h"
#include "btstack/btstack_typedef.h"
#include "le/sm.h"
#include "le/le_user.h"
#include "app_power_manage.h"  /* For get_vbat_percent() */

/* Logging */
#define log_info(fmt, ...)  printf("[VM_BLE] " fmt, ##__VA_ARGS__)
#define log_error(fmt, ...) printf("[VM_BLE_ERR] " fmt, ##__VA_ARGS__)

/* Connection handle for notifications */
static uint16_t vm_connection_handle = 0;

int vm_ble_handle_motor_write(uint16_t conn_handle, const uint8_t *data, uint16_t len)
{
    uint16_t duty_cycle;
    int ret;
    
    (void)conn_handle;
    
    /* Validate data pointer */
    if (!data) {
        return VM_ERR_INVALID_LENGTH;
    }
    
    /* Validate packet length */
    if (len != VM_MOTOR_PACKET_SIZE) {
        return VM_ERR_INVALID_LENGTH;
    }
    
    /* Parse duty_cycle (little-endian uint16) */
    duty_cycle = ((uint16_t)data[0]) | ((uint16_t)data[1] << 8);
    
    log_info("Motor write: duty=%d (0x%02X 0x%02X)\n", duty_cycle, data[0], data[1]);
    
    /* Validate range */
    if (duty_cycle > 10000) {
        log_error("Invalid duty cycle: %d > 10000\n", duty_cycle);
        return VM_ERR_INVALID_DUTY;
    }
    
    /* Set motor duty cycle */
    ret = vm_motor_set_duty(duty_cycle);
    if (ret != 0) {
        log_error("Motor control failed: %d\n", ret);
        return VM_ERR_INVALID_DUTY;
    }
    
    log_info("Motor duty set to %d (%.2f%%)\n", duty_cycle, duty_cycle / 100.0);
    
    return VM_ERR_OK;
}

/**
 * Get battery level - uses JieLi SDK power management
 * This function uses the SDK's built-in battery monitoring system
 * which is initialized by board_power_init() at startup
 */
uint8_t vm_ble_get_battery_level(void)
{
    /* Use SDK's battery percentage function
     * This reads from ADC channel AD_CH_VBAT and converts to 0-100%
     * The SDK handles voltage divider compensation and battery curve
     */
    extern u8 get_vbat_percent(void);
    u8 battery_percent = get_vbat_percent();
    
    /* Clamp to valid range (0-100) */
    if (battery_percent > 100) {
        battery_percent = 100;
    }
    
    return battery_percent;
}

/* 
 * GATT write callback - called by BLE stack when characteristic is written
 */
static int vm_att_write_callback(hci_con_handle_t connection_handle, uint16_t att_handle,
                                  uint16_t transaction_mode, uint16_t offset,
                                  uint8_t *buffer, uint16_t buffer_size)
{
    int ret;
    
    (void)transaction_mode;
    (void)offset;
    
    /* Handle motor control characteristic */
    if (att_handle == ATT_CHARACTERISTIC_VM_MOTOR_CONTROL_VALUE_HANDLE) {
        ret = vm_ble_handle_motor_write(connection_handle, buffer, buffer_size);
        
        /* Map error codes to ATT error codes */
        switch (ret) {
            case VM_ERR_OK:
                return 0;
            case VM_ERR_INVALID_LENGTH:
                return 0x0D;  /* ATT_ERROR_INVALID_ATTRIBUTE_VALUE_LENGTH */
            case VM_ERR_INVALID_DUTY:
                return 0x0E;  /* ATT_ERROR_VALUE_NOT_ALLOWED */
            default:
                return 0x0E;
        }
    }
    
    /* Device info is now read-only, no write handler needed */
    
#if RCSP_BTMATE_EN
    /* Handle RCSP OTA write */
    if (att_handle == ATT_CHARACTERISTIC_ae01_02_VALUE_HANDLE) {
        log_info("RCSP write: %d bytes\n", buffer_size);
        ble_gatt_server_receive_update_data(NULL, buffer, buffer_size);
        return 0;
    }
    
    /* Handle RCSP CCC writes */
    if (att_handle == ATT_CHARACTERISTIC_ae02_02_CLIENT_CONFIGURATION_HANDLE) {
        log_info("RCSP ae02 CCC write: 0x%02x\n", buffer[0]);
        ble_op_latency_skip(connection_handle, 0xffff);
        ble_gatt_server_set_update_send(connection_handle, ATT_CHARACTERISTIC_ae02_02_VALUE_HANDLE, ATT_OP_AUTO_READ_CCC);
        ble_gatt_server_characteristic_ccc_set(connection_handle, att_handle, buffer[0]);
        return 0;
    }
#endif
    
    /* Not our characteristic, let other handlers process it */
    return 0;
}

/*
 * GATT read callback - handles device info reads
 */
static uint16_t vm_att_read_callback(hci_con_handle_t connection_handle, uint16_t att_handle,
                                      uint16_t offset, uint8_t *buffer, uint16_t buffer_size)
{
    (void)connection_handle;
    
    /* Handle device info characteristic read */
    if (att_handle == ATT_CHARACTERISTIC_VM_DEVICE_INFO_VALUE_HANDLE) {
        /* Only support reading from offset 0 */
        if (offset != 0) {
            return 0;
        }
        
        /* Validate buffer size */
        if (buffer_size < VM_DEVICE_INFO_RESPONSE_SIZE) {
            return 0;
        }
        
        /* Build response packet */
        buffer[0] = VM_DEVICE_INFO_HEADER;           /* Header: 0xB0 */
        buffer[1] = VM_DEVICE_INFO_CMD;              /* CMD: 0x00 */
        buffer[2] = 0x01;                            /* Motor count: 1 */
        buffer[3] = VM_FIRMWARE_VERSION_LOW;         /* Firmware version low byte */
        buffer[4] = VM_FIRMWARE_VERSION_HIGH;        /* Firmware version high byte */
        buffer[5] = vm_ble_get_battery_level();      /* Battery level: 0-100% */
        
        log_info("Device info read: FW=%d.%d Battery=%d%%\\n", 
                 buffer[4], buffer[3], buffer[5]);
        
        return VM_DEVICE_INFO_RESPONSE_SIZE;
    }
    
    /* Not our characteristic */
    return 0;
}

/*
 * BLE event handler
 */
static int vm_event_packet_handler(int event, u8 *packet, u16 size, u8 *ext_param)
{
    (void)size;
    (void)ext_param;
    
    if (!packet) {
        return 0;
    }
    
    switch (event) {
        case GATT_COMM_EVENT_CONNECTION_COMPLETE:
            vm_connection_handle = little_endian_read_16(packet, 0);
            log_info("Connected: handle=%04x\n", vm_connection_handle);
            break;
            
        case GATT_COMM_EVENT_DISCONNECT_COMPLETE:
            log_info("Disconnected: handle=%04x\n", little_endian_read_16(packet, 0));
            vm_connection_handle = 0;
            break;
            
        case GATT_COMM_EVENT_ENCRYPTION_CHANGE:
            log_info("Encryption enabled: handle=%04x\n", little_endian_read_16(packet, 0));
            break;
            
        default:
            break;
    }
    
    return 0;
}

/* Security Manager configuration (LESC + Just-Works) */
static const sm_cfg_t vm_sm_config = {
    .slave_security_auto_req = 1,  /* Auto request security */
    .slave_set_wait_security = 1,  /* Enforce encryption before writes */
    .io_capabilities = IO_CAPABILITY_NO_INPUT_NO_OUTPUT,  /* Just-Works (no MITM) */
    .authentication_req_flags = SM_AUTHREQ_BONDING | SM_AUTHREQ_SECURE_CONNECTION,  /* LESC + Bonding */
    .min_key_size = 16,
    .max_key_size = 16,
    .sm_cb_packet_handler = NULL,
};

/* GATT server configuration */
static const gatt_server_cfg_t vm_server_cfg = {
    .att_read_cb = &vm_att_read_callback,
    .att_write_cb = &vm_att_write_callback,
    .event_packet_handler = &vm_event_packet_handler,
};

int vm_ble_service_init(void)
{
    int ret;
    
    /* Initialize motor control */
    ret = vm_motor_init();
    if (ret != 0) {
        return ret;
    }
    
    /* Register GATT profile with BLE stack */
    ble_gatt_server_set_profile(vm_motor_profile_data, sizeof(vm_motor_profile_data));
    
    log_info("VM BLE service initialized - LESC + Just-Works\n");
    
    /* Note: The server configuration (vm_server_cfg) needs to be registered
     * with the BLE stack during application initialization. This is typically
     * done in the main application's GATT control block setup.
     * 
     * Example integration:
     * 
     * static gatt_ctrl_t vm_gatt_control_block = {
     *     .mtu_size = 23,
     *     .cbuffer_size = 512,
     *     .multi_dev_flag = 0,
     *     .server_config = vm_ble_get_server_config(),
     *     .sm_config = vm_ble_get_sm_config(),
     * };
     * 
     * Then call: ble_comm_init(&vm_gatt_control_block);
     */
    
    return 0;
}

/* Get server configuration for application integration */
const void *vm_ble_get_server_config(void)
{
    return &vm_server_cfg;
}

/* Get security manager configuration for application integration */
const void *vm_ble_get_sm_config(void)
{
    return &vm_sm_config;
}

/* Cleanup function for application shutdown */
void vm_ble_service_deinit(void)
{
    /* Deinitialize motor control */
    vm_motor_deinit();
    
    /* Note: BLE stack cleanup (ble_comm_exit) should be called
     * by the main application during shutdown, not by individual services.
     */
}
