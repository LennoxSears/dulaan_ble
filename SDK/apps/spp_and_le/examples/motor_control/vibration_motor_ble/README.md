# Vibration Motor BLE Control Implementation

Standard LESC + Just-Works implementation for JieLi AC632N chip.

## Protocol Version
V3.0 - Typical BLE security, no application-layer crypto

## Hardware Configuration
- **PWM Pin**: IO_PORTB_05 (PB5) - Connected to MOS transistor gate
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
- `README.md` - This file

## Integration
Refer to `vm_integration_example.c` for code examples and integration patterns.

## Security Features
All security is handled by the BLE stack:
- LE Secure Connections (LESC) with Just-Works pairing
- AES-CCM link encryption (automatic)
- Link-layer replay protection (automatic)
- LTK storage and management (automatic)

## GATT Characteristics

### Motor Control (9A511A2D-594F-4E2B-B123-5F739A2D594F)
- **Property**: Write Without Response
- **Format**: 2 bytes (duty_cycle: 0-10000, little-endian)

### Device Info Query (9A521A2D-594F-4E2B-B123-5F739A2D594F)
- **Property**: Write + Notify
- **Request**: 2 bytes (0xB0 0x00 command)
- **Response**: 6 bytes (header=0xB0, cmd=0x00, motor_count, fw_low, fw_high, battery)

## Battery Level Integration

The device info query returns battery level (0-100%). 

**Current implementation**: Returns fake value (85%) for testing.

To integrate real battery monitoring, modify `vm_ble_get_battery_level()` in `vm_ble_service.c`:

### Option 1: Use SDK battery API
```c
uint8_t vm_ble_get_battery_level(void)
{
    extern u8 get_vbat_percent(void);
    u8 battery_percent = get_vbat_percent();
    if (battery_percent > 100) {
        battery_percent = 100;
    }
    return battery_percent;
}
```

### Option 2: Custom ADC reading
```c
uint8_t vm_ble_get_battery_level(void)
{
    // Read ADC from battery voltage divider
    uint16_t adc_value = adc_get_voltage(ADC_CH_VBAT);
    
    // Convert to percentage (example: 3.0V-4.2V range)
    if (adc_value >= 4200) return 100;
    if (adc_value <= 3000) return 0;
    return (uint8_t)((adc_value - 3000) * 100 / 1200);
}
}

uint8_t vm_ble_get_battery_level(void)
{
    return cached_battery_level;
}
```
