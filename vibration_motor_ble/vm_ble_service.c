#include "vm_ble_service.h"
#include "vm_security.h"
#include "vm_motor_control.h"
#include <string.h>

/* JieLi SDK includes - adjust paths as needed */
/* These are placeholder includes based on typical BLE stack structure */
/* #include "le_gatt_server.h" */
/* #include "btstack/bluetooth.h" */

/* Service and characteristic UUIDs - used during GATT registration */
static const uint8_t vm_service_uuid[] __attribute__((unused)) = {VM_SERVICE_UUID_128};
static const uint8_t vm_char_uuid[] __attribute__((unused)) = {VM_CHAR_UUID_128};

/* GATT service and characteristic handles - set during registration */
static uint16_t vm_service_handle __attribute__((unused)) = 0;
static uint16_t vm_char_handle = 0;

uint64_t vm_get_counter_le48(const uint8_t *data)
{
    uint64_t counter = 0;
    
    /* Little-endian 48-bit to 64-bit */
    counter = ((uint64_t)data[0] << 0)  |
              ((uint64_t)data[1] << 8)  |
              ((uint64_t)data[2] << 16) |
              ((uint64_t)data[3] << 24) |
              ((uint64_t)data[4] << 32) |
              ((uint64_t)data[5] << 40);
    
    return counter;
}

bool vm_packet_parse(const uint8_t *data, uint16_t len, vm_packet_t *packet)
{
    if (!data || !packet || len != VM_PACKET_SIZE) {
        return false;
    }
    
    memset(packet, 0, sizeof(vm_packet_t));
    
    packet->cmd = data[VM_OFFSET_CMD];
    packet->counter = vm_get_counter_le48(&data[VM_OFFSET_COUNTER]);
    packet->duty = data[VM_OFFSET_DUTY];
    memcpy(packet->reserved, &data[VM_OFFSET_RESERVED], 8);
    
    /* MIC is stored as little-endian 32-bit */
    packet->mic = ((uint32_t)data[VM_OFFSET_MIC + 0] << 0)  |
                  ((uint32_t)data[VM_OFFSET_MIC + 1] << 8)  |
                  ((uint32_t)data[VM_OFFSET_MIC + 2] << 16) |
                  ((uint32_t)data[VM_OFFSET_MIC + 3] << 24);
    
    return true;
}

int vm_ble_handle_write(uint16_t conn_handle, const uint8_t *data, uint16_t len)
{
    vm_packet_t packet;
    int ret;
    
    (void)conn_handle;  /* Reserved for future use */
    
    /* Validate packet length */
    if (len != VM_PACKET_SIZE) {
        return VM_ERR_INVALID_LENGTH;
    }
    
    /* Parse packet */
    if (!vm_packet_parse(data, len, &packet)) {
        return VM_ERR_INVALID_LENGTH;
    }
    
    /* Validate command */
    if (packet.cmd != VM_CMD_SET_DUTY) {
        return VM_ERR_INVALID_CMD;
    }
    
    /* Verify security (counter + CMAC) */
    ret = vm_security_verify_packet(data, len, packet.counter, packet.mic);
    if (ret != VM_ERR_OK) {
        return ret;
    }
    
    /* Set motor duty cycle */
    vm_motor_set_duty(packet.duty);
    
    return VM_ERR_OK;
}

/* 
 * GATT write callback - to be registered with BLE stack
 * This is a template - actual implementation depends on JieLi SDK API
 * 
 * NOTE: This function is currently unused but provided as a template.
 * Remove 'static' and register it with the BLE stack during integration.
 */
__attribute__((unused))
static int vm_gatt_write_callback(uint16_t conn_handle, uint16_t att_handle, 
                                   const uint8_t *data, uint16_t len)
{
    if (att_handle != vm_char_handle) {
        return -1;  /* Not our characteristic */
    }
    
    int ret = vm_ble_handle_write(conn_handle, data, len);
    
    /* Map error codes to ATT error codes */
    switch (ret) {
        case VM_ERR_OK:
            return 0;
        case VM_ERR_INVALID_LENGTH:
            return 0x0D;  /* ATT_ERROR_INVALID_ATTRIBUTE_VALUE_LENGTH */
        case VM_ERR_INVALID_CMD:
        case VM_ERR_REPLAY_ATTACK:
            return 0x0E;  /* ATT_ERROR_VALUE_NOT_ALLOWED */
        case VM_ERR_AUTH_FAILED:
            return 0x05;  /* ATT_ERROR_INSUFFICIENT_AUTHENTICATION */
        case VM_ERR_NOT_BONDED:
            return 0x0F;  /* ATT_ERROR_INSUFFICIENT_ENCRYPTION */
        default:
            return 0x0E;
    }
}

int vm_ble_service_init(void)
{
    int ret;
    
    /* Initialize security module */
    ret = vm_security_init();
    if (ret != 0) {
        return ret;
    }
    
    /* Initialize motor control */
    ret = vm_motor_init();
    if (ret != 0) {
        return ret;
    }
    
    /*
     * Register GATT service with BLE stack
     * 
     * This is SDK-specific code that needs to be adapted to JieLi's API.
     * Typical steps:
     * 1. Create service with UUID
     * 2. Add characteristic with Write-Without-Response property
     * 3. Set security requirements (Level 4)
     * 4. Register write callback
     * 
     * Example pseudo-code:
     * 
     * vm_service_handle = le_gatt_server_add_service(vm_service_uuid, 16);
     * vm_char_handle = le_gatt_server_add_characteristic(
     *     vm_service_handle,
     *     vm_char_uuid, 16,
     *     ATT_PROPERTY_WRITE_WITHOUT_RESPONSE,
     *     ATT_SECURITY_AUTHENTICATED | ATT_SECURITY_ENCRYPTED,
     *     NULL, 0
     * );
     * le_gatt_server_register_write_callback(vm_gatt_write_callback);
     */
    
    /* TODO: Add actual JieLi SDK GATT registration code here */
    
    return 0;
}
