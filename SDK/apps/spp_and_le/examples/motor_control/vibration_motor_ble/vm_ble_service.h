#ifndef VM_BLE_SERVICE_H
#define VM_BLE_SERVICE_H

#include <stdint.h>

/* Service UUID: 9A501A2D-594F-4E2B-B123-5F739A2D594F */
#define VM_SERVICE_UUID_128 \
    0x4F, 0x59, 0x2D, 0x9A, 0x73, 0x5F, 0x23, 0xB1, \
    0x2B, 0x4E, 0x4F, 0x59, 0x2D, 0x1A, 0x50, 0x9A

/* Motor Control Characteristic UUID: 9A511A2D-594F-4E2B-B123-5F739A2D594F */
#define VM_MOTOR_CHAR_UUID_128 \
    0x4F, 0x59, 0x2D, 0x9A, 0x73, 0x5F, 0x23, 0xB1, \
    0x2B, 0x4E, 0x4F, 0x59, 0x2D, 0x1A, 0x51, 0x9A

/* Device Info Characteristic UUID: 9A521A2D-594F-4E2B-B123-5F739A2D594F */
#define VM_DEVICE_INFO_CHAR_UUID_128 \
    0x4F, 0x59, 0x2D, 0x9A, 0x73, 0x5F, 0x23, 0xB1, \
    0x2B, 0x4E, 0x4F, 0x59, 0x2D, 0x1A, 0x52, 0x9A

/* Packet format constants */
#define VM_MOTOR_PACKET_SIZE    2
#define VM_DEVICE_INFO_REQUEST_SIZE  1  /* Single byte: 0xB0 */
#define VM_DEVICE_INFO_RESPONSE_SIZE 6

/* Device info protocol */
#define VM_DEVICE_INFO_HEADER   0xB0
#define VM_DEVICE_INFO_CMD      0x00

/* Firmware version - update these for your firmware */
#define VM_FIRMWARE_VERSION_HIGH  1
#define VM_FIRMWARE_VERSION_LOW   0

/* Error codes */
#define VM_ERR_OK               0
#define VM_ERR_INVALID_LENGTH   1
#define VM_ERR_INVALID_DUTY     2

/**
 * Initialize the vibration motor BLE service
 * Registers GATT profile and initializes motor control
 * @return 0 on success, negative on error
 */
int vm_ble_service_init(void);

/**
 * Deinitialize the vibration motor BLE service
 * Cleans up motor control resources
 */
void vm_ble_service_deinit(void);

/**
 * Get GATT server configuration for application integration
 * This should be passed to the application's gatt_ctrl_t structure
 * @return Pointer to server configuration
 */
const void *vm_ble_get_server_config(void);

/**
 * Get security manager configuration for application integration
 * This should be passed to the application's gatt_ctrl_t structure
 * Configures LESC + Just-Works (no MITM, bonding enabled)
 * @return Pointer to SM configuration
 */
const void *vm_ble_get_sm_config(void);

/**
 * Handle incoming write request to motor control characteristic
 * @param conn_handle Connection handle
 * @param data Packet data (2 bytes: duty_cycle)
 * @param len Packet length (must be 2)
 * @return VM_ERR_OK on success, error code otherwise
 */
int vm_ble_handle_motor_write(uint16_t conn_handle, const uint8_t *data, uint16_t len);

/**
 * Handle incoming write request to device info characteristic
 * Sends notification with device information when 0xB0 is written
 * Note: This is handled directly in vm_att_write_callback, not as separate function
 * @param conn_handle Connection handle
 * @param data Packet data (1 byte: 0xB0 command)
 * @param len Packet length (must be 1)
 * @return VM_ERR_OK on success, error code otherwise
 */
int vm_ble_handle_device_info_write(uint16_t conn_handle, const uint8_t *data, uint16_t len);

/**
 * Get battery level (0-100%)
 * Uses JieLi SDK's power management system (get_vbat_percent)
 * Battery monitoring is initialized by board_power_init() at startup
 * @return Battery level percentage (0-100)
 */
uint8_t vm_ble_get_battery_level(void);

#endif /* VM_BLE_SERVICE_H */
