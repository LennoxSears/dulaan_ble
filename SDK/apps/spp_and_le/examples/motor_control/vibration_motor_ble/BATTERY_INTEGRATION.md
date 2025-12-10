# Battery Level Integration Guide

## Overview

The device info query characteristic returns battery level (0-100%) to the app. This guide explains how to integrate actual battery reading into your application.

## Default Behavior

By default, `vm_ble_get_battery_level()` returns a placeholder value of 85%. This is a **weak function** that you should override in your application.

## Integration Methods

### Method 1: ADC Reading (Recommended)

Read battery voltage using ADC and convert to percentage.

#### Hardware Setup
```
Battery (+) ──[R1]──┬──[R2]──GND
                    │
                   ADC Pin
```

Voltage divider: `V_adc = V_bat * R2 / (R1 + R2)`

#### Example Code
```c
#include "asm/adc_api.h"

uint8_t vm_ble_get_battery_level(void)
{
    u32 adc_value;
    u32 voltage_mv;
    
    /* Read ADC channel for battery voltage */
    adc_value = adc_get_value(AD_CH_VBAT);
    
    /* Convert ADC value to millivolts
     * Adjust formula based on your voltage divider and ADC reference
     * Example: 10-bit ADC, 3.3V reference, 1:2 divider
     */
    voltage_mv = (adc_value * 3300 * 2) / 1024;
    
    /* Convert voltage to percentage
     * Li-ion battery: 3.0V (0%) to 4.2V (100%)
     * Adjust range for your battery type
     */
    if (voltage_mv >= 4200) {
        return 100;
    }
    if (voltage_mv <= 3000) {
        return 0;
    }
    
    /* Linear interpolation */
    return (uint8_t)((voltage_mv - 3000) * 100 / 1200);
}
```

#### Non-linear Battery Curve (More Accurate)
```c
uint8_t vm_ble_get_battery_level(void)
{
    u32 voltage_mv = read_battery_voltage_mv();
    
    /* Li-ion discharge curve lookup table */
    static const struct {
        u16 voltage_mv;
        u8 percentage;
    } battery_curve[] = {
        {4200, 100},
        {4100, 90},
        {4000, 80},
        {3900, 70},
        {3800, 60},
        {3700, 50},
        {3600, 40},
        {3500, 30},
        {3400, 20},
        {3300, 10},
        {3000, 0},
    };
    
    /* Find position in curve */
    for (int i = 0; i < sizeof(battery_curve)/sizeof(battery_curve[0]) - 1; i++) {
        if (voltage_mv >= battery_curve[i+1].voltage_mv) {
            /* Linear interpolation between two points */
            u16 v_high = battery_curve[i].voltage_mv;
            u16 v_low = battery_curve[i+1].voltage_mv;
            u8 p_high = battery_curve[i].percentage;
            u8 p_low = battery_curve[i+1].percentage;
            
            return p_low + (voltage_mv - v_low) * (p_high - p_low) / (v_high - v_low);
        }
    }
    
    return 0;
}
```

### Method 2: SDK Battery API

If the JieLi SDK provides battery monitoring functions:

```c
#include "system/includes.h"

uint8_t vm_ble_get_battery_level(void)
{
    /* Use SDK's battery API if available */
    return get_vbat_percent();
}
```

Check SDK documentation for available battery functions:
- `get_vbat_value()` - Get raw battery voltage
- `get_vbat_percent()` - Get battery percentage
- `adc_get_voltage(AD_CH_VBAT)` - Get ADC voltage

### Method 3: Cached Value with Periodic Update

For efficiency, read battery periodically and cache the value:

```c
/* Global cached battery level */
static u8 g_cached_battery_level = 100;

/* Battery monitoring task - call every 60 seconds */
void battery_monitor_task(void)
{
    u32 voltage_mv = read_battery_voltage_mv();
    
    /* Update cached value */
    if (voltage_mv >= 4200) {
        g_cached_battery_level = 100;
    } else if (voltage_mv <= 3000) {
        g_cached_battery_level = 0;
    } else {
        g_cached_battery_level = (u8)((voltage_mv - 3000) * 100 / 1200);
    }
}

/* Return cached value */
uint8_t vm_ble_get_battery_level(void)
{
    return g_cached_battery_level;
}

/* In your main loop or timer */
void app_main(void)
{
    /* ... initialization ... */
    
    while (1) {
        /* Update battery every 60 seconds */
        static u32 last_battery_check = 0;
        u32 now = timer_get_ms();
        
        if (now - last_battery_check >= 60000) {
            battery_monitor_task();
            last_battery_check = now;
        }
        
        /* ... other tasks ... */
    }
}
```

### Method 4: Fuel Gauge IC

If using a dedicated fuel gauge IC (e.g., MAX17048, BQ27441):

```c
#include "device/fuel_gauge.h"

uint8_t vm_ble_get_battery_level(void)
{
    /* Read from fuel gauge IC via I2C */
    return fuel_gauge_get_soc();  /* State of Charge */
}
```

## Testing

### Test with Fixed Values
```c
/* For testing, return fixed values */
uint8_t vm_ble_get_battery_level(void)
{
    static u8 test_level = 100;
    
    /* Decrease by 10% each query for testing */
    if (test_level > 0) {
        test_level -= 10;
    }
    
    return test_level;
}
```

### Test with App
1. Connect to device via BLE
2. Write to device info characteristic: `[0xB0, 0x00]`
3. Read notification response
4. Verify byte 5 contains battery level (0-100)

## Battery Level Accuracy

### Factors Affecting Accuracy:
1. **Voltage divider tolerance** - Use 1% resistors
2. **ADC reference accuracy** - Calibrate if possible
3. **Load current** - Measure under typical load
4. **Temperature** - Battery voltage varies with temperature
5. **Battery chemistry** - Different curves for Li-ion, LiPo, etc.

### Calibration:
```c
/* Calibration constants - adjust for your hardware */
#define VBAT_ADC_OFFSET  0      /* ADC offset in mV */
#define VBAT_ADC_SCALE   1000   /* Scale factor (1000 = 1.000x) */

uint8_t vm_ble_get_battery_level(void)
{
    u32 adc_value = adc_get_value(AD_CH_VBAT);
    u32 voltage_mv = (adc_value * 3300 * 2) / 1024;
    
    /* Apply calibration */
    voltage_mv = (voltage_mv * VBAT_ADC_SCALE) / 1000 + VBAT_ADC_OFFSET;
    
    /* Convert to percentage */
    /* ... */
}
```

## Low Battery Handling

### Option 1: Warning at Low Battery
```c
uint8_t vm_ble_get_battery_level(void)
{
    u8 level = calculate_battery_level();
    
    /* Warn user at 20% */
    if (level <= 20 && level > 10) {
        /* Flash LED or vibrate briefly */
        indicate_low_battery();
    }
    
    /* Critical at 10% */
    if (level <= 10) {
        /* Reduce motor power or disable features */
        vm_motor_set_duty(vm_motor_get_duty() / 2);
    }
    
    return level;
}
```

### Option 2: Auto-shutdown at Critical Level
```c
void battery_monitor_task(void)
{
    u8 level = calculate_battery_level();
    
    if (level <= 5) {
        /* Save state and shutdown */
        log_info("Critical battery, shutting down\n");
        vm_motor_stop();
        /* Enter deep sleep or power off */
        system_power_off();
    }
}
```

## Summary

1. **Override** `vm_ble_get_battery_level()` in your application
2. **Read** battery voltage using ADC or SDK API
3. **Convert** voltage to percentage (0-100)
4. **Cache** value for efficiency (optional)
5. **Test** with app to verify correct reporting

The default placeholder (85%) will work for initial testing, but should be replaced with actual battery reading for production.
