#ifndef VM_BLE_SERVICE_H
#define VM_BLE_SERVICE_H

#include <stdint.h>
#include <stdbool.h>

/* Service UUID: 9A501A2D-594F-4E2B-B123-5F739A2D594F */
#define VM_SERVICE_UUID_128 \
    0x4F, 0x59, 0x2D, 0x9A, 0x73, 0x5F, 0x23, 0xB1, \
    0x2B, 0x4E, 0x4F, 0x59, 0x2D, 0x1A, 0x50, 0x9A

/* Characteristic UUID: 9A511A2D-594F-4E2B-B123-5F739A2D594F */
#define VM_CHAR_UUID_128 \
    0x4F, 0x59, 0x2D, 0x9A, 0x73, 0x5F, 0x23, 0xB1, \
    0x2B, 0x4E, 0x4F, 0x59, 0x2D, 0x1A, 0x51, 0x9A

/* Packet format constants */
#define VM_PACKET_SIZE          20
#define VM_CMD_SET_DUTY         0x01
#define VM_COUNTER_SIZE         6
#define VM_MIC_SIZE             4

/* Packet structure offsets */
#define VM_OFFSET_CMD           0
#define VM_OFFSET_COUNTER       1
#define VM_OFFSET_DUTY          7
#define VM_OFFSET_RESERVED      8
#define VM_OFFSET_MIC           16

/* Error codes */
#define VM_ERR_OK               0
#define VM_ERR_INVALID_LENGTH   1
#define VM_ERR_INVALID_CMD      2
#define VM_ERR_REPLAY_ATTACK    3
#define VM_ERR_AUTH_FAILED      4
#define VM_ERR_NOT_BONDED       5

/* Packet structure */
typedef struct {
    uint8_t cmd;
    uint64_t counter;       /* 48-bit counter stored in 64-bit */
    uint8_t duty;
    uint8_t reserved[8];
    uint32_t mic;
} vm_packet_t;

/**
 * Initialize the vibration motor BLE service
 * @return 0 on success, negative on error
 */
int vm_ble_service_init(void);

/**
 * Handle incoming write request to control characteristic
 * @param conn_handle Connection handle
 * @param data Packet data
 * @param len Packet length
 * @return VM_ERR_OK on success, error code otherwise
 */
int vm_ble_handle_write(uint16_t conn_handle, const uint8_t *data, uint16_t len);

/**
 * Parse packet from raw data
 * @param data Raw packet data
 * @param len Data length
 * @param packet Output parsed packet
 * @return true on success
 */
bool vm_packet_parse(const uint8_t *data, uint16_t len, vm_packet_t *packet);

/**
 * Get 48-bit counter from little-endian bytes
 * @param data Pointer to 6-byte counter
 * @return Counter value
 */
uint64_t vm_get_counter_le48(const uint8_t *data);

#endif /* VM_BLE_SERVICE_H */
