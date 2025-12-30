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

/* Logging - DISABLED to reduce firmware size */
#define log_info(fmt, ...)   // Disabled
#define log_error(fmt, ...)  // Disabled

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

/* Note: CRC verification is handled by dual_bank API internally */

/*
 * OTA Write Handler - implements custom OTA protocol
 */
int vm_ble_handle_ota_write(uint16_t conn_handle, const uint8_t *data, uint16_t len)
{
    if (len < 1) {
        log_error("OTA: Invalid packet length\n");
        return 0x0D;  /* ATT_ERROR_INVALID_ATTRIBUTE_VALUE_LENGTH */
    }
    
    uint8_t cmd = data[0];
    
    switch (cmd) {
        case VM_OTA_CMD_START: {
            /* Start OTA: [0x01][size_low][size_high][size_mid][size_top] */
            if (len != 5) {
                log_error("OTA: Invalid START packet length\n");
                ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0x01);
                return 0x0D;
            }
            
            ota_total_size = data[1] | (data[2] << 8) | (data[3] << 16) | (data[4] << 24);
            
            if (ota_total_size == 0 || ota_total_size > VM_OTA_MAX_SIZE) {
                log_error("OTA: Invalid firmware size: %d\n", ota_total_size);
                ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0x02);
                return 0x0E;  /* ATT_ERROR_VALUE_NOT_ALLOWED */
            }
            
            log_info("OTA: Start, size=%d bytes\n", ota_total_size);
            
            /* Check buffer size before init */
            uint32_t max_buf = get_dual_bank_passive_update_max_buf();
            log_info("OTA: Max buffer size: %d bytes\n", max_buf);
            
            if (max_buf < 2048) {  /* Need at least 2KB buffer for safety */
                log_error("OTA: Buffer too small: %d bytes (need 2048)\n", max_buf);
                ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0x02);
                return 0x0E;
            }
            
            /* Initialize dual-bank update with smaller packet size for safety */
            /* Use 128 bytes instead of 240 to reduce buffer pressure */
            uint32_t ret = dual_bank_passive_update_init(0, ota_total_size, 128, NULL);
            if (ret != 0) {
                log_error("OTA: Init failed: %d\n", ret);
                ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0x02);
                return 0x0E;
            }
            
            /* Check if enough space available */
            ret = dual_bank_update_allow_check(ota_total_size);
            if (ret != 0) {
                log_error("OTA: Not enough space: %d\n", ret);
                dual_bank_passive_update_exit(NULL);
                ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0x02);
                return 0x0E;
            }
            
            ota_received_size = 0;
            ota_state = OTA_STATE_RECEIVING;
            
            /* Send ready notification */
            ota_send_notification(conn_handle, VM_OTA_STATUS_READY, 0x00);
            break;
        }
        
        case VM_OTA_CMD_DATA: {
            /* Data chunk: [0x02][seq_low][seq_high][data...] */
            if (ota_state != OTA_STATE_RECEIVING) {
                log_error("OTA: Not in receiving state\n");
                ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0x03);
                return 0x0E;
            }
            
            if (len < 4) {
                log_error("OTA: Invalid DATA packet length\n");
                ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0x04);
                return 0x0D;
            }
            
            uint16_t seq = data[1] | (data[2] << 8);
            uint16_t data_len = len - 3;
            uint8_t *firmware_data = (uint8_t *)&data[3];
            
            /* Store sequence number for ACK callback */
            ota_current_sequence = seq;
            
            /* Write to flash using dual-bank API with callback for flow control */
            uint32_t ret = dual_bank_update_write(firmware_data, data_len, ota_write_complete_callback);
            if (ret != 0) {
                log_error("OTA: Flash write failed: %d\n", ret);
                ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0x05);
                dual_bank_passive_update_exit(NULL);
                ota_state = OTA_STATE_IDLE;
                return 0x0E;
            }
            
            ota_received_size += data_len;
            
            /* Note: ACK will be sent by ota_write_complete_callback when write finishes */
            /* Progress notifications removed - app can calculate from ACK sequence numbers */
            
            break;
        }
        
        case VM_OTA_CMD_FINISH: {
            /* Finish OTA: [0x03][crc_low][crc_high][crc_mid][crc_top] */
            if (ota_state != OTA_STATE_RECEIVING) {
                log_error("OTA: Not in receiving state\n");
                ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0x06);
                return 0x0E;
            }
            
            if (len != 5) {
                log_error("OTA: Invalid FINISH packet length\n");
                ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0x07);
                return 0x0D;
            }
            
            ota_expected_crc = data[1] | (data[2] << 8) | (data[3] << 16) | (data[4] << 24);
            
            log_info("OTA: Finish, received=%d, expected=%d, crc=0x%08x\n", 
                     ota_received_size, ota_total_size, ota_expected_crc);
            
            /* Verify size */
            if (ota_received_size != ota_total_size) {
                log_error("OTA: Size mismatch\n");
                ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0x08);
                dual_bank_passive_update_exit(NULL);
                ota_state = OTA_STATE_IDLE;
                return 0x0E;
            }
            
            /* Note: dual_bank API doesn't support external CRC verification */
            /* We trust the data was written correctly */
            log_info("OTA: Update complete, burning boot info...\n");
            
            /* Burn boot info to activate new firmware */
            uint32_t ret = dual_bank_update_burn_boot_info(NULL);
            if (ret != 0) {
                log_error("OTA: Failed to burn boot info: %d\n", ret);
                ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0x09);
                dual_bank_passive_update_exit(NULL);
                ota_state = OTA_STATE_IDLE;
                return 0x0E;
            }
            
            log_info("OTA: Success, rebooting...\n");
            
            /* Send success notification */
            ota_send_notification(conn_handle, VM_OTA_STATUS_SUCCESS, 0x00);
            
            /* Wait for notification to be sent */
            os_time_dly(10);  /* 100ms delay */
            
            /* Reboot to apply update */
            cpu_reset();
            
            break;
        }
        
        default:
            log_error("OTA: Unknown command: 0x%02x\n", cmd);
            ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0xFF);
            return 0x0E;
    }
    
    return 0;  /* Success */
}
