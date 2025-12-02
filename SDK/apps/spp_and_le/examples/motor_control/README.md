# Vibration Motor BLE Control Example

## Overview

This example implements a vibration motor control system using BLE with LESC + Just-Works security.

## Features

- **Security**: LE Secure Connections (LESC) with Just-Works pairing
- **Protocol**: 2-byte packet format (duty_cycle: 0-10000)
- **Motor Control**: PWM-based vibration motor control (0.01% resolution)
- **No Application Security**: All security handled by BLE stack

## Files

```
motor_control/
├── app_motor.c              - Application state machine and initialization
├── ble_motor.c              - BLE stack integration
├── ble_motor.h              - BLE motor control API
└── vibration_motor_ble/     - Motor control implementation
    ├── vm_ble_service.c     - GATT service implementation
    ├── vm_ble_service.h     - Service API
    ├── vm_ble_profile.h     - GATT database
    ├── vm_motor_control.c   - PWM motor control
    ├── vm_motor_control.h   - Motor API
    └── vm_config.h          - Hardware configuration
```

## Configuration

### 1. Hardware Configuration

Edit `vibration_motor_ble/vm_config.h`:

```c
#define VM_MOTOR_PWM_PIN        IO_PORTB_05  // Change to your pin
#define VM_MOTOR_PWM_FREQ_HZ    20000        // 20kHz PWM
```

### 2. Build Configuration

Already configured in `include/app_config.h`:

```c
#define CONFIG_APP_MOTOR_CONTROL  1  // Enabled
```

## Compilation

### Using Code::Blocks

1. Open the project in Code::Blocks
2. Select build configuration
3. Build the project
4. Flash to board

### Build Output

The compiled firmware will be ready to flash to the JieLi AC632N chip.

## BLE Protocol

### Service UUID
`9A501A2D-594F-4E2B-B123-5F739A2D594F`

### Characteristic UUID
`9A511A2D-594F-4E2B-B123-5F739A2D594F`

### Packet Format
- **Size**: 2 bytes
- **Format**: `duty_cycle` (uint16, little-endian)
- **Range**: 0-10000 (0.00% - 100.00%)

### Security
- **Pairing**: LESC + Just-Works (no PIN)
- **Encryption**: AES-CCM 128-bit (automatic)
- **Replay Protection**: Link-layer (automatic)

## Usage

1. Power on the device
2. Device starts advertising as "VibMotor"
3. Connect from phone app
4. System prompts for pairing (Just-Works, no PIN)
5. Send 2-byte packets to control motor duty cycle

### Example Packets

```
0x00 0x00  = 0% (motor off)
0x88 0x13  = 50.00% (5000 in little-endian)
0x10 0x27  = 100.00% (10000 in little-endian)
```

## Testing

### Using nRF Connect App

1. Scan for "VibMotor"
2. Connect
3. Accept pairing
4. Find service `9A50...`
5. Write to characteristic `9A51...`
6. Send hex values (e.g., `8813` for 50%)

## Troubleshooting

### Motor doesn't respond
- Check PWM pin configuration in `vm_config.h`
- Verify motor is connected to correct pin
- Check power supply to motor

### BLE connection fails
- Ensure BLE is enabled on phone
- Check if device is advertising
- Try forgetting device and re-pairing

### Compilation errors
- Verify all files are in place
- Check `CONFIG_APP_MOTOR_CONTROL = 1` in `app_config.h`
- Ensure SDK paths are correct

## License

Copyright (c) JIELI 2011-2019
