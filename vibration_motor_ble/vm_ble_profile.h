#ifndef VM_BLE_PROFILE_H
#define VM_BLE_PROFILE_H

#include <stdint.h>

/* 
 * GATT Profile for Vibration Motor BLE Service
 * 
 * Service UUID: 9A501A2D-594F-4E2B-B123-5F739A2D594F
 * Characteristic UUID: 9A511A2D-594F-4E2B-B123-5F739A2D594F
 * Property: Write Without Response
 * 
 * Profile format based on SDK/apps/spp_and_le/examples/trans_data/ble_trans_profile.h
 * Generated using JieLi GATT Profile Generator tool
 */

static const uint8_t vm_motor_profile_data[] = {
    //////////////////////////////////////////////////////
    //
    // 0x0001 PRIMARY_SERVICE  9A501A2D-594F-4E2B-B123-5F739A2D594F
    //
    //////////////////////////////////////////////////////
    // Service declaration: 128-bit UUID
    0x18, 0x00, 0x02, 0x00, 0x01, 0x00, 0x00, 0x28,
    // UUID bytes (little-endian): 9A501A2D-594F-4E2B-B123-5F739A2D594F
    0x4F, 0x59, 0x2D, 0x9A, 0x73, 0x5F, 0x23, 0xB1,
    0x2B, 0x4E, 0x4F, 0x59, 0x2D, 0x1A, 0x50, 0x9A,

    /* CHARACTERISTIC, 9A511A2D-594F-4E2B-B123-5F739A2D594F, WRITE_WITHOUT_RESPONSE | DYNAMIC */
    // 0x0002 CHARACTERISTIC 9A511A2D... WRITE_WITHOUT_RESPONSE | DYNAMIC
    0x1b, 0x00, 0x02, 0x00, 0x02, 0x00, 0x03, 0x28,
    0x04,  // Property: Write Without Response (0x04)
    0x03, 0x00,  // Value handle
    // UUID bytes (little-endian): 9A511A2D-594F-4E2B-B123-5F739A2D594F
    0x4F, 0x59, 0x2D, 0x9A, 0x73, 0x5F, 0x23, 0xB1,
    0x2B, 0x4E, 0x4F, 0x59, 0x2D, 0x1A, 0x51, 0x9A,

    // 0x0003 VALUE 9A511A2D... WRITE_WITHOUT_RESPONSE | DYNAMIC
    0x16, 0x00, 0x04, 0x01, 0x03, 0x00,
    // UUID bytes (little-endian): 9A511A2D-594F-4E2B-B123-5F739A2D594F
    0x4F, 0x59, 0x2D, 0x9A, 0x73, 0x5F, 0x23, 0xB1,
    0x2B, 0x4E, 0x4F, 0x59, 0x2D, 0x1A, 0x51, 0x9A,

    // END
    0x00, 0x00,
};

// Characteristic handle
#define ATT_CHARACTERISTIC_VM_MOTOR_CONTROL_VALUE_HANDLE 0x0003

#endif /* VM_BLE_PROFILE_H */
