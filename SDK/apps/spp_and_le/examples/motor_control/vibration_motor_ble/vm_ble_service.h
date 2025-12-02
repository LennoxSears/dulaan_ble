#ifndef VM_BLE_SERVICE_H
#define VM_BLE_SERVICE_H

#include <stdint.h>

/* Service UUID: 9A501A2D-594F-4E2B-B123-5F739A2D594F */
#define VM_SERVICE_UUID_128 \
    0x4F, 0x59, 0x2D, 0x9A, 0x73, 0x5F, 0x23, 0xB1, \
    0x2B, 0x4E, 0x4F, 0x59, 0x2D, 0x1A, 0x50, 0x9A

/* Characteristic UUID: 9A511A2D-594F-4E2B-B123-5F739A2D594F */
#define VM_CHAR_UUID_128 \
    0x4F, 0x59, 0x2D, 0x9A, 0x73, 0x5F, 0x23, 0xB1, \
    0x2B, 0x4E, 0x4F, 0x59, 0x2D, 0x1A, 0x51, 0x9A

/* Packet format constants */
#define VM_PACKET_SIZE          2

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
 * Handle incoming write request to control characteristic
 * @param conn_handle Connection handle
 * @param data Packet data (2 bytes: duty_cycle)
 * @param len Packet length (must be 2)
 * @return VM_ERR_OK on success, error code otherwise
 */
int vm_ble_handle_write(uint16_t conn_handle, const uint8_t *data, uint16_t len);

#endif /* VM_BLE_SERVICE_H */
