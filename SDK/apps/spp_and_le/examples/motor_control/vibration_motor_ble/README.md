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

## GATT Characteristics

### Motor Control (9A511A2D-594F-4E2B-B123-5F739A2D594F)
- **Property**: Write Without Response
- **Format**: 2 bytes (duty_cycle: 0-10000, little-endian)

### Device Info Query (9A521A2D-594F-4E2B-B123-5F739A2D594F)
- **Property**: Write, Notify
- **Request**: 2 bytes (header=0xB0, cmd=0x00)
- **Response**: 6 bytes (header, cmd, motor_count, fw_low, fw_high, battery)

## Battery Level Integration

The device info query returns battery level (0-100%). To integrate actual battery reading:

### Option 1: Override the weak function
```c
// In your application code
uint8_t vm_ble_get_battery_level(void)
{
    // Read ADC from battery voltage divider
    uint16_t adc_value = adc_get_voltage(ADC_CH_VBAT);
    
    // Convert to percentage (example: 3.0V-4.2V range)
    if (adc_value >= 4200) return 100;
    if (adc_value <= 3000) return 0;
    return (uint8_t)((adc_value - 3000) * 100 / 1200);
}
```

### Option 2: Use SDK battery API (if available)
```c
uint8_t vm_ble_get_battery_level(void)
{
    return get_vbat_percent();  // SDK function
}
```

### Option 3: Periodic update with cached value
```c
static uint8_t cached_battery_level = 100;

void battery_monitor_task(void)
{
    // Called periodically (e.g., every 60 seconds)
    cached_battery_level = read_battery_adc_and_convert();
}

uint8_t vm_ble_get_battery_level(void)
{
    return cached_battery_level;
}
```
