# Vibration Motor BLE Control Implementation

Standard LESC + Just-Works implementation for JieLi AC632N chip.

## Protocol Version
V3.0 - Typical BLE security, no application-layer crypto

## Hardware Configuration
- **PWM Pin**: IO_PORTB_08 (PB8) - Connected to MOS transistor gate
- **Timer**: JL_TIMER3 - Hardware timer for PWM generation
- **Frequency**: 1kHz - Manufacturer recommended for vibration motors
- **Duty Cycle**: 0-10000 (0.00%-100.00%)

## Files
- `vm_ble_service.h` - GATT service definitions and API
- `vm_ble_service.c` - GATT service implementation
- `vm_ble_profile.h` - ATT database definition
- `vm_motor_control.h` - PWM motor control API
- `vm_motor_control.c` - Motor control implementation using TIMER3 PWM
- `vm_config.h` - Hardware configuration (pin, timer, frequency)
- `vm_integration_example.c` - Integration example code
- `Makefile.include` - Build system integration
- `INTEGRATION_GUIDE.md` - Detailed integration instructions

## Integration
See `INTEGRATION_GUIDE.md` for detailed instructions, or refer to `vm_integration_example.c` for code examples.

## Security Features
All security is handled by the BLE stack:
- LE Secure Connections (LESC) with Just-Works pairing
- AES-CCM link encryption (automatic)
- Link-layer replay protection (automatic)
- LTK storage and management (automatic)

## Packet Format
2 bytes: duty_cycle (0-10000 = 0.00%-100.00%, little-endian)
