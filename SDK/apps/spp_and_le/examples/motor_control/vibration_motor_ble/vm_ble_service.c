#include "app_config.h"  /* Must be first for SDK configuration */
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
#include "update/dual_bank_updata_api.h"  /* For OTA update */
#include "system/includes.h"  /* For cpu_reset() */
#include "custom_dual_bank_ota.h"  /* Custom dual-bank OTA implementation */

/* Logging - RE-ENABLED for custom OTA debugging */
#define log_info(fmt, ...)   printf("[INFO] " fmt, ##__VA_ARGS__)
#define log_error(fmt, ...)  printf("[ERROR] " fmt, ##__VA_ARGS__)

/* Connection handle for notifications */
static uint16_t vm_connection_handle = 0;

/* OTA state machine */
typedef enum {
    OTA_STATE_IDLE = 0,
    OTA_STATE_RECEIVING,
    OTA_STATE_VERIFYING
} ota_state_t;

static ota_state_t ota_state = OTA_STATE_IDLE;
static uint32_t ota_total_size = 0;
static uint32_t ota_received_size = 0;
static uint32_t ota_expected_crc = 0;
static uint16_t ota_current_sequence = 0;  /* Track current packet sequence for ACK */

/* Forward declarations */
static void ota_send_notification(uint16_t conn_handle, uint8_t status, uint8_t value);
static int ota_write_complete_callback(void *priv);

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
 * Get battery level - returns fake value for testing
 * TODO: Replace with real battery monitoring when hardware is connected
 */
uint8_t vm_ble_get_battery_level(void)
{
    /* Return fake battery level for testing */
    return 85;  /* 85% */
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

    /* Handle device info characteristic write - trigger notification on 0xB0 0x00 */
    if (att_handle == ATT_CHARACTERISTIC_VM_DEVICE_INFO_VALUE_HANDLE) {
        /* Check for 2 bytes: 0xB0 0x00 command */
        if (buffer_size == 2 && buffer[0] == 0xB0 && buffer[1] == 0x00) {
            log_info("Device info request received (0xB0 0x00)\\n");

            /* Build device info response */
            uint8_t response[VM_DEVICE_INFO_RESPONSE_SIZE];
            response[0] = VM_DEVICE_INFO_HEADER;           /* Header: 0xB0 */
            response[1] = VM_DEVICE_INFO_CMD;              /* CMD: 0x00 */
            response[2] = 0x01;                            /* Motor count: 1 */
            response[3] = VM_FIRMWARE_VERSION_LOW;         /* Firmware version low byte */
            response[4] = VM_FIRMWARE_VERSION_HIGH;        /* Firmware version high byte */
            response[5] = vm_ble_get_battery_level();      /* Battery level: 0-100% */

            log_info("Sending device info: FW=%d.%d Battery=%d%%\\n",
                     response[4], response[3], response[5]);

            /* Send notification */
            ble_comm_att_send_data(connection_handle, 
                                   ATT_CHARACTERISTIC_VM_DEVICE_INFO_VALUE_HANDLE,
                                   response, VM_DEVICE_INFO_RESPONSE_SIZE,
                                   ATT_OP_AUTO_READ_CCC);

            return 0;
        } else {
            log_info("Invalid device info request: size=%d, data=0x%02x 0x%02x\\n",
                     buffer_size,
                     buffer_size > 0 ? buffer[0] : 0,
                     buffer_size > 1 ? buffer[1] : 0);
            return 0x0E;  /* ATT_ERROR_VALUE_NOT_ALLOWED */
        }
    }

    /* Handle device info CCC write */
    if (att_handle == ATT_CHARACTERISTIC_VM_DEVICE_INFO_CLIENT_CONFIGURATION_HANDLE) {
        log_info("Device info CCC write: 0x%02x\n", buffer[0]);
        ble_gatt_server_characteristic_ccc_set(connection_handle, att_handle, buffer[0]);
        return 0;
    }

    /* Handle custom OTA characteristic write */
    if (att_handle == ATT_CHARACTERISTIC_VM_OTA_VALUE_HANDLE) {
        return vm_ble_handle_ota_write(connection_handle, buffer, buffer_size);
    }

    /* Handle OTA CCC write */
    if (att_handle == ATT_CHARACTERISTIC_VM_OTA_CLIENT_CONFIGURATION_HANDLE) {
        log_info("OTA CCC write: 0x%02x\n", buffer[0]);
        ble_gatt_server_characteristic_ccc_set(connection_handle, att_handle, buffer[0]);
        return 0;
    }

    /* Not our characteristic, let other handlers process it */
    return 0;
}

/*
 * GATT read callback - no longer needed (device info is WRITE+NOTIFY now)
 */
static uint16_t vm_att_read_callback(hci_con_handle_t connection_handle, uint16_t att_handle,
                                      uint16_t offset, uint8_t *buffer, uint16_t buffer_size)
{
    (void)connection_handle;
    (void)att_handle;
    (void)offset;
    (void)buffer;
    (void)buffer_size;

    /* No characteristics to read */
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
    .slave_security_auto_req = 0,  /* Don't auto-request (wait for first write) */
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

    /* Initialize custom dual-bank OTA system */
    ret = custom_dual_bank_ota_init();
    if (ret != 0) {
        log_error("Failed to initialize custom dual-bank OTA: %d\n", ret);
        return ret;
    }

    /* Register GATT profile with BLE stack */
    ble_gatt_server_set_profile(vm_motor_profile_data, sizeof(vm_motor_profile_data));

    log_info("VM BLE service initialized - LESC + Just-Works + Custom Dual-Bank OTA\n");

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

/*
 * OTA Helper Functions
 */

/* Send OTA status notification */
static void ota_send_notification(uint16_t conn_handle, uint8_t status, uint8_t value)
{
    uint8_t notify_data[2];
    notify_data[0] = status;
    notify_data[1] = value;
    
    ble_comm_att_send_data(conn_handle, 
                           ATT_CHARACTERISTIC_VM_OTA_VALUE_HANDLE,
                           notify_data, 2,
                           ATT_OP_AUTO_READ_CCC);
}

/* Callback when flash write completes - sends ACK to app */
static int ota_write_complete_callback(void *priv)
{
    (void)priv;
    
    /* Send ACK notification with sequence number */
    uint8_t notify_data[3];
    notify_data[0] = VM_OTA_STATUS_ACK;
    notify_data[1] = ota_current_sequence & 0xFF;
    notify_data[2] = (ota_current_sequence >> 8) & 0xFF;
    
    ble_comm_att_send_data(vm_connection_handle, 
                           ATT_CHARACTERISTIC_VM_OTA_VALUE_HANDLE,
                           notify_data, 3,
                           ATT_OP_AUTO_READ_CCC);
    
    log_info("OTA: ACK sent for seq=%d\n", ota_current_sequence);
    
    return 0;  /* Success */
}

/* Note: Using custom dual-bank implementation with low-level flash functions */

/*
 * OTA Write Handler - implements custom dual-bank OTA protocol
 */
int vm_ble_handle_ota_write(uint16_t conn_handle, const uint8_t *data, uint16_t len)
{
    if (len < 1) {
        log_error("OTA: Invalid packet length\n");
        return 0x0D;  /* ATT_ERROR_INVALID_ATTRIBUTE_VALUE_LENGTH */
    }
    
    uint8_t cmd = data[0];
    int ret;
    
    switch (cmd) {
        case VM_OTA_CMD_START: {
            /* Start OTA: [0x01][size_low][size_high][size_mid][size_top][crc_low][crc_high][version] */
            if (len != 8) {
                log_error("OTA: Invalid START packet length (expected 8, got %d)\n", len);
                ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0x01);
                return 0x0D;
            }
            
            u32 size = data[1] | (data[2] << 8) | (data[3] << 16) | (data[4] << 24);
            u16 crc = data[5] | (data[6] << 8);
            u8 version = data[7];
            
            log_info("Custom OTA: START - size=%d, crc=0x%04x, version=%d\n", size, crc, version);
            
            /* Start custom dual-bank OTA */
            ret = custom_dual_bank_ota_start(size, crc, version);
            if (ret != 0) {
                log_error("Custom OTA: Start failed with error %d\n", ret);
                ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, ret);
                return 0x0E;
            }
            
            ota_state = OTA_STATE_RECEIVING;
            
            /* Send ready notification */
            ota_send_notification(conn_handle, VM_OTA_STATUS_READY, 0x00);
            break;
        }
        
        case VM_OTA_CMD_DATA: {
            /* Data chunk: [0x02][seq_low][seq_high][data...] */
            if (ota_state != OTA_STATE_RECEIVING) {
                log_error("Custom OTA: Not in receiving state\n");
                ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0x03);
                return 0x0E;
            }
            
            if (len < 4) {
                log_error("Custom OTA: Invalid DATA packet length\n");
                ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0x04);
                return 0x0D;
            }
            
            u16 seq = data[1] | (data[2] << 8);
            u16 data_len = len - 3;
            u8 *firmware_data = (u8 *)&data[3];
            
            /* Write firmware data using custom dual-bank */
            ret = custom_dual_bank_ota_data(firmware_data, data_len);
            if (ret != 0) {
                log_error("Custom OTA: Data write failed with error %d\n", ret);
                custom_dual_bank_ota_abort();  /* Reset both state machines */
                ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, ret);
                ota_state = OTA_STATE_IDLE;
                return 0x0E;
            }
            
            /* Send ACK with sequence number */
            ota_send_notification(conn_handle, VM_OTA_STATUS_ACK, seq & 0xFF);
            
            /* Send progress update every 10 packets */
            if (seq % 10 == 0) {
                u8 progress = custom_dual_bank_ota_get_progress();
                ota_send_notification(conn_handle, VM_OTA_STATUS_PROGRESS, progress);
            }
            
            break;
        }
        
        case VM_OTA_CMD_FINISH: {
            /* Finish OTA: [0x03] */
            if (ota_state != OTA_STATE_RECEIVING) {
                log_error("Custom OTA: Not in receiving state\n");
                ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0x06);
                return 0x0E;
            }
            
            log_info("Custom OTA: FINISH - Verifying and switching banks...\n");
            
            /* Finalize OTA update (verifies CRC, updates boot info, resets) */
            ret = custom_dual_bank_ota_end();
            if (ret != 0) {
                log_error("Custom OTA: Finish failed with error %d\n", ret);
                custom_dual_bank_ota_abort();  /* Reset both state machines */
                ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, ret);
                ota_state = OTA_STATE_IDLE;
                return 0x0E;
            }
            
            /* Send success notification */
            ota_send_notification(conn_handle, VM_OTA_STATUS_SUCCESS, 0x00);
            
            /* Wait for notification to be sent, then device will reset */
            os_time_dly(10);  /* 100ms delay */
            
            /* Note: custom_dual_bank_ota_end() calls cpu_reset() */
            
            break;
        }
        
        default:
            log_error("OTA: Unknown command: 0x%02x\n", cmd);
            ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0xFF);
            return 0x0E;
    }
    
    return 0;  /* Success */
}
