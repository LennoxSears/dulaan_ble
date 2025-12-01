/*
 * Integration Example for Vibration Motor BLE Protocol
 * 
 * This file shows how to integrate the VM BLE service into your
 * JieLi AC632N application.
 */

#include "vm_ble_service.h"
#include "vm_security.h"
#include "vm_motor_control.h"
#include <stdio.h>
#include <stdint.h>

/* JieLi SDK includes */
/* #include "app_config.h" */
/* #include "btstack/bluetooth.h" */
/* #include "le_gatt_server.h" */

/* Placeholder event definitions - replace with actual SDK values */
#define BLE_EVENT_PAIRING_COMPLETE  0x01
#define BLE_EVENT_DISCONNECTED      0x02
#define BLE_EVENT_ENCRYPTION_CHANGE 0x03
#define BLE_EVENT_CONNECTED         0x04

/*
 * Step 1: Initialize the service during application startup
 */
void app_bluetooth_init(void)
{
    /* ... other BLE initialization ... */
    
    /* Initialize vibration motor BLE service */
    int ret = vm_ble_service_init();
    if (ret != 0) {
        /* Handle initialization error */
        printf("VM BLE service init failed: %d\n", ret);
    }
}

/*
 * Step 2: Handle BLE security events
 */
void app_ble_security_callback(uint16_t conn_handle, uint8_t event, void *data)
{
    (void)conn_handle;  /* Suppress unused parameter warning */
    (void)data;
    
    switch (event) {
        case BLE_EVENT_PAIRING_COMPLETE: {
            /* Pairing completed - extract CSRK */
            /* struct pairing_complete_data *pair_data = data; */
            /* vm_security_on_bonding_complete(pair_data->csrk); */
            break;
        }
        
        case BLE_EVENT_DISCONNECTED: {
            /* Connection closed - save counter */
            vm_security_on_disconnect();
            break;
        }
        
        case BLE_EVENT_ENCRYPTION_CHANGE: {
            /* Encryption status changed */
            /* Can be used to verify Security Level 4 is active */
            break;
        }
    }
}

/*
 * Step 3: Set security requirements on connection
 */
void app_ble_connection_callback(uint16_t conn_handle, uint8_t event)
{
    if (event == BLE_EVENT_CONNECTED) {
        /*
         * Force Security Level 4 (LESC + Encryption)
         * Example: bt_conn_set_security(conn_handle, BT_SECURITY_L4);
         */
        (void)conn_handle;  /* Suppress unused parameter warning */
    }
}

/*
 * Step 4: Configure advertising data
 */
void app_ble_setup_advertising(void)
{
    /*
     * Include service UUID in advertising data for filtering
     * 
     * Example:
     * uint8_t adv_data[] = {
     *     // Flags
     *     0x02, 0x01, 0x06,
     *     // Complete 128-bit Service UUID
     *     0x11, 0x07,
     *     VM_SERVICE_UUID_128
     * };
     * 
     * ble_set_adv_data(adv_data, sizeof(adv_data));
     */
}

/*
 * Step 5: Optional - Add debug commands
 */
void app_debug_vm_status(void)
{
    const vm_security_state_t *state = vm_security_get_state();
    
    printf("VM BLE Status:\n");
    printf("  Bonded: %s\n", state->bonded ? "Yes" : "No");
    printf("  Counter: %llu\n", (unsigned long long)state->last_counter);
    printf("  Packets since save: %u\n", (unsigned int)state->packets_since_save);
    printf("  Motor duty: %u%%\n", (unsigned int)((vm_motor_get_duty() * 100) / 255));
}

void app_debug_vm_clear_bonding(void)
{
    printf("Clearing bonding data...\n");
    vm_security_clear_bonding();
    printf("Done. Device will require re-pairing.\n");
}
