/*
 * Integration Example for Vibration Motor BLE Protocol
 * 
 * This file shows how to integrate the VM BLE service into your
 * JieLi AC632N application with standard LESC + Just-Works security.
 */

#include "vm_ble_service.h"
#include "vm_motor_control.h"
#include <stdint.h>

/* JieLi SDK includes - uncomment when integrating */
/* #include "app_config.h" */
/* #include "btstack/bluetooth.h" */
/* #include "le_gatt_server.h" */
/* #include "le_gatt_common.h" */

/*
 * Step 1: Initialize the service during application startup
 */
void app_bluetooth_init(void)
{
    /* ... other BLE initialization ... */
    
    /* Initialize vibration motor BLE service */
    int ret = vm_ble_service_init();
    if (ret != 0) {
        printf("VM BLE service init failed: %d\n", ret);
    }
}

/*
 * Step 2: Configure BLE Security (LESC + Just-Works)
 * 
 * The BLE stack handles all security automatically.
 * Use the provided configuration:
 */
void app_ble_setup_gatt_server(void)
{
    static gatt_ctrl_t gatt_control = {
        .mtu_size = 23,  /* Minimum MTU for 2-byte packets */
        .cbuffer_size = 512,
        .multi_dev_flag = 0,
        .server_config = vm_ble_get_server_config(),  /* Get our GATT config */
        .client_config = NULL,  /* No GATT client needed */
        .sm_config = vm_ble_get_sm_config(),  /* Get LESC + Just-Works config */
        .hci_cb_packet_handler = NULL,  /* No HCI callback needed */
    };
    
    /* Initialize BLE communication with our configuration */
    ble_comm_init(&gatt_control);
}

/*
 * Step 3: Configure advertising data
 */
void app_ble_setup_advertising(void)
{
    /* Include service UUID in advertising data for filtering */
    static const uint8_t adv_data[] = {
        /* Flags */
        0x02, 0x01, 0x06,
        /* Complete 128-bit Service UUID */
        0x11, 0x07,
        VM_SERVICE_UUID_128
    };
    
    /* Set advertising data (uncomment when integrating) */
    /* ble_set_adv_data(adv_data, sizeof(adv_data)); */
    
    /* Set device name (uncomment when integrating) */
    /* ble_set_device_name(VM_DEVICE_NAME, strlen(VM_DEVICE_NAME)); */
}

/*
 * Step 4: Optional - Add debug commands
 */
void app_debug_vm_status(void)
{
    printf("VM BLE Status:\n");
    printf("  Motor duty: %u.%02u%%\n", 
           vm_motor_get_duty() / 100,
           vm_motor_get_duty() % 100);
}

/*
 * Step 5: Cleanup on application shutdown
 */
void app_bluetooth_shutdown(void)
{
    /* Cleanup VM BLE service */
    vm_ble_service_deinit();
    
    /* Cleanup BLE stack (uncomment when integrating) */
    /* ble_comm_exit(); */
}

/*
 * That's it! No security callbacks needed.
 * The BLE stack handles everything automatically.
 */
