# Vibration Motor BLE Control Implementation

Standard LESC + Just-Works implementation for JieLi AC632N chip.

## Protocol Version
V3.0 - Typical BLE security, no application-layer crypto

## Files
- `vm_ble_service.h` - GATT service definitions and API
- `vm_ble_service.c` - GATT service implementation
- `vm_ble_profile.h` - ATT database definition
- `vm_motor_control.h` - PWM motor control API
- `vm_motor_control.c` - Motor control implementation
- `vm_config.h` - Hardware configuration

## Integration
Add these files to your AC632N project and call `vm_ble_service_init()` from your main application.

## Security Features
All security is handled by the BLE stack:
- LE Secure Connections (LESC) with Just-Works pairing
- AES-CCM link encryption (automatic)
- Link-layer replay protection (automatic)
- LTK storage and management (automatic)

## Packet Format
2 bytes: duty_cycle (0-10000 = 0.00%-100.00%, little-endian)
