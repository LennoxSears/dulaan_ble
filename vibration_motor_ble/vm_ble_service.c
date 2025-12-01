#include "vm_ble_service.h"
#include "vm_ble_profile.h"
#include "vm_security.h"
#include "vm_motor_control.h"
#include <string.h>

/* JieLi SDK includes */
#include "le_gatt_common.h"

/* Connection handle */
static uint16_t vm_conn_handle = 0;

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
 * GATT write callback - called by BLE stack when characteristic is written
 */
static int vm_att_write_callback(hci_con_handle_t connection_handle, uint16_t att_handle,
                                  uint16_t transaction_mode, uint16_t offset,
                                  uint8_t *buffer, uint16_t buffer_size)
{
    (void)transaction_mode;
    (void)offset;
    
    /* Check if this is our characteristic */
    if (att_handle != ATT_CHARACTERISTIC_VM_MOTOR_CONTROL_VALUE_HANDLE) {
        return 0;  /* Not our characteristic, let other handlers process it */
    }
    
    /* Handle the write */
    int ret = vm_ble_handle_write(connection_handle, buffer, buffer_size);
    
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

/*
 * GATT read callback - not used for our write-only characteristic
 */
static uint16_t vm_att_read_callback(hci_con_handle_t connection_handle, uint16_t att_handle,
                                      uint16_t offset, uint8_t *buffer, uint16_t buffer_size)
{
    (void)connection_handle;
    (void)att_handle;
    (void)offset;
    (void)buffer;
    (void)buffer_size;
    return 0;
}

/*
 * BLE event handler
 */
static int vm_event_packet_handler(int event, u8 *packet, u16 size, u8 *ext_param)
{
    (void)packet;
    (void)size;
    (void)ext_param;
    
    switch (event) {
        case GATT_COMM_EVENT_CONNECTION_COMPLETE:
            vm_conn_handle = little_endian_read_16(packet, 0);
            break;
            
        case GATT_COMM_EVENT_DISCONNECT_COMPLETE:
            vm_security_on_disconnect();
            vm_conn_handle = 0;
            break;
            
        case GATT_COMM_EVENT_ENCRYPTION_CHANGE:
            /* Encryption established - bonding may be complete */
            /* CSRK extraction would happen here if needed */
            break;
            
        default:
            break;
    }
    
    return 0;
}

/* GATT server configuration */
static const gatt_server_cfg_t vm_server_cfg = {
    .att_read_cb = &vm_att_read_callback,
    .att_write_cb = &vm_att_write_callback,
    .event_packet_handler = &vm_event_packet_handler,
};

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
    
    /* Register GATT profile with BLE stack */
    ble_gatt_server_set_profile(vm_motor_profile_data, sizeof(vm_motor_profile_data));
    
    /* Note: The server configuration (vm_server_cfg) needs to be registered
     * with the BLE stack during application initialization. This is typically
     * done in the main application's GATT control block setup.
     * 
     * See SDK/apps/spp_and_le/examples/trans_data/ble_trans.c for reference:
     * 
     * static gatt_ctrl_t vm_gatt_control_block = {
     *     .mtu_size = ATT_LOCAL_MTU_SIZE,
     *     .cbuffer_size = ATT_SEND_CBUF_SIZE,
     *     .multi_dev_flag = 0,
     *     .server_config = &vm_server_cfg,
     * };
     * 
     * Then call: ble_gatt_server_init(&vm_gatt_control_block);
     */
    
    return 0;
}

/* Get server configuration for application integration */
const gatt_server_cfg_t *vm_ble_get_server_config(void)
{
    return &vm_server_cfg;
}
