# Vibration Motor BLE Control Implementation

Implementation of secure BLE vibration motor control protocol for JieLi AC632N chip.

## Protocol Version
V2.0 - Based on LE Secure Connections + Just-Works bonding

## Files
- `vm_ble_service.h` - GATT service definitions and API
- `vm_ble_service.c` - GATT service implementation
- `vm_security.h` - Security and bonding management API
- `vm_security.c` - Security implementation (LESC, counter, CMAC)
- `vm_storage.h` - Flash NVS storage API
- `vm_storage.c` - Key and counter persistence
- `vm_motor_control.h` - PWM motor control API
- `vm_motor_control.c` - Motor control implementation

## Integration
Add these files to your AC632N project and call `vm_ble_service_init()` from your main application.

## Security Features
- BLE Security Level 4 (LESC)
- 48-bit replay counter
- AES-CMAC-32 message integrity
- Flash-backed key storage
