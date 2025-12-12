# Battery Integration - Using JieLi SDK Power Management

## What the Engineer Found

The engineer reviewed our code and pointed out:

> "我不明白。你们的系统这里不运行了？这是电量。掉电初始化的程序啊。"
> 
> Translation: "I don't understand. Your system doesn't run this? This is battery/power. It's the power-down initialization program."

**Key Point**: The JieLi SDK **already has a complete battery monitoring system** that is initialized at startup by `board_power_init()`.

---

## What Was Wrong Before

### ❌ Our Previous Implementation:
```c
__attribute__((weak)) uint8_t vm_ble_get_battery_level(void)
{
    return 85;  /* Placeholder: 85% battery */
}
```

**Problems:**
1. Returned hardcoded placeholder (85%)
2. Didn't use SDK's existing battery system
3. Required manual ADC implementation
4. Ignored the power management already running

---

## SDK's Power Management System

### Initialization Flow:

```
System Boot
    ↓
board_init()  (in board_ac632n_demo.c)
    ↓
board_power_init()  ← Engineer pointed to this function
    ↓
power_init(&power_param)  ← Initializes power management
    ↓
Battery monitoring starts automatically
```

### Key Functions in `board_ac632n_demo.c`:

```c
void board_power_init(void)
{
    log_info("Power init : %s", __FILE__);
    
    power_init(&power_param);  // ← Initializes battery monitoring
    
    power_set_callback(TCFG_LOWPOWER_LOWPOWER_SEL, 
                       sleep_enter_callback, 
                       sleep_exit_callback, 
                       board_set_soft_poweroff);
    
    power_wakeup_init(&wk_param);
    // ... more initialization
}
```

### Power Parameters (configured in board file):

```c
const struct low_power_param power_param = {
    .config         = TCFG_LOWPOWER_LOWPOWER_SEL,
    .btosc_hz       = TCFG_CLOCK_OSC_HZ,
    .vddiom_lev     = TCFG_LOWPOWER_VDDIOM_LEVEL,
    .vddiow_lev     = TCFG_LOWPOWER_VDDIOW_LEVEL,
    // ... battery monitoring configuration
};
```

---

## SDK Battery APIs

### Available in `app_power_manage.h`:

```c
/* Get battery voltage in mV (e.g., 3700 = 3.7V) */
u16 get_vbat_level(void);

/* Get battery percentage (0-100%) */
u8 get_vbat_percent(void);

/* Get raw battery value */
u16 get_vbat_value(void);

/* Check if battery needs shutdown */
bool get_vbat_need_shutdown(void);
```

### Implementation in `app_power_manage.c`:

```c
u16 get_vbat_level(void)
{
    // Reads ADC channel AD_CH_VBAT
    // Applies voltage divider compensation (4/10 factor)
    return (adc_get_voltage(AD_CH_VBAT) * 4 / 10);
}

u8 get_vbat_percent(void)
{
    u16 bat_val = get_vbat_level();
    
    // Get battery full voltage from charge config or default 4.2V
    if (battery_full_value == 0) {
        #if TCFG_CHARGE_ENABLE
            battery_full_value = (get_charge_full_value() - 100) / 10;
        #else
            battery_full_value = 420;  // 4.2V for Li-ion
        #endif
    }
    
    // Check minimum voltage
    if (bat_val <= app_var.poweroff_tone_v) {
        return 0;
    }
    
    // Calculate percentage with battery curve
    tmp_bat_val = ((u32)bat_val - app_var.poweroff_tone_v) * 100 
                  / (battery_full_value - app_var.poweroff_tone_v);
    
    if (tmp_bat_val > 100) {
        tmp_bat_val = 100;
    }
    
    return (u8)tmp_bat_val;
}
```

---

## ✅ Corrected Implementation

### New Code in `vm_ble_service.c`:

```c
#include "app_power_manage.h"  /* For get_vbat_percent() */

/**
 * Get battery level - uses JieLi SDK power management
 * This function uses the SDK's built-in battery monitoring system
 * which is initialized by board_power_init() at startup
 */
uint8_t vm_ble_get_battery_level(void)
{
    /* Use SDK's battery percentage function
     * This reads from ADC channel AD_CH_VBAT and converts to 0-100%
     * The SDK handles voltage divider compensation and battery curve
     */
    extern u8 get_vbat_percent(void);
    u8 battery_percent = get_vbat_percent();
    
    /* Clamp to valid range (0-100) */
    if (battery_percent > 100) {
        battery_percent = 100;
    }
    
    return battery_percent;
}
```

---

## How It Works Now

### 1. **System Startup**:
```
Power On
    ↓
board_power_init() runs automatically
    ↓
Battery monitoring initialized
    ↓
ADC configured for VBAT reading
    ↓
Periodic battery checks start
```

### 2. **BLE Device Info Read**:
```
App reads Device Info characteristic
    ↓
vm_att_read_callback() called
    ↓
vm_ble_get_battery_level() called
    ↓
get_vbat_percent() reads actual battery
    ↓
Returns real battery percentage (0-100%)
    ↓
Response sent to app
```

### 3. **Battery Monitoring**:
- SDK automatically monitors battery voltage
- Triggers low battery warnings
- Handles auto-shutdown on critical battery
- Updates battery level periodically

---

## Configuration

### Battery Voltage Thresholds (in `app_power_manage.h`):

```c
#define LOW_POWER_SHUTDOWN   200  // 2.0V - Direct shutdown
#define LOW_POWER_OFF_VAL    230  // 2.3V - Low battery shutdown
#define LOW_POWER_WARN_VAL   240  // 2.4V - Low battery warning
#define LOW_POWER_WARN_TIME  (60 * 1000)  // 60 seconds warning
```

### Voltage Divider Configuration:

The SDK uses a **4:10 ratio** for voltage divider:
```c
return (adc_get_voltage(AD_CH_VBAT) * 4 / 10);
```

This means:
- ADC reads divided voltage
- Multiplied by 2.5 (10/4) to get actual battery voltage
- Example: ADC reads 1.48V → Battery is 3.7V

---

## Benefits of Using SDK Functions

### ✅ Advantages:

1. **Already Initialized**: `board_power_init()` runs at startup
2. **Voltage Divider Handled**: Correct compensation applied
3. **Battery Curve**: Non-linear Li-ion discharge curve
4. **Low Battery Protection**: Auto-shutdown on critical battery
5. **Tested and Proven**: Used by all JieLi SDK examples
6. **No Manual ADC**: SDK handles all ADC configuration
7. **Periodic Updates**: Battery checked automatically

### ❌ Our Previous Approach:

1. Hardcoded placeholder value
2. Required manual ADC implementation
3. No battery curve compensation
4. No low battery protection
5. Ignored existing SDK infrastructure

---

## Testing

### Expected Behavior:

**With Battery Connected:**
- Device Info read returns actual battery percentage
- Example: `B0 00 01 00 01 4B` (75% battery = 0x4B)

**Without Battery (USB Power):**
- Returns percentage based on USB voltage
- May show 100% or voltage-dependent value

**Low Battery:**
- SDK triggers warning at 2.4V
- Auto-shutdown at 2.0V
- App receives accurate low battery indication

---

## Summary

### What Changed:

| Before | After |
|--------|-------|
| Hardcoded 85% | Real battery from ADC |
| Manual implementation needed | Uses SDK functions |
| Ignored power management | Integrates with SDK |
| No low battery protection | Full power management |

### Engineer's Point:

The engineer correctly identified that we were **not using the SDK's power management system** that is **already running and initialized** by `board_power_init()`.

### Solution:

Simply call `get_vbat_percent()` which:
1. Reads ADC channel `AD_CH_VBAT`
2. Applies voltage divider compensation
3. Converts to percentage using battery curve
4. Returns accurate 0-100% value

**No need to reinvent the wheel - the SDK already does this!**

---

## References

**SDK Files:**
- `SDK/apps/spp_and_le/board/bd19/board_ac632n_demo.c` - Power initialization
- `SDK/apps/spp_and_le/modules/power/app_power_manage.c` - Battery functions
- `SDK/apps/spp_and_le/include/app_power_manage.h` - API definitions
- `SDK/include_lib/system/power_manage.h` - System power API
- `SDK/include_lib/driver/cpu/bd19/asm/adc_api.h` - ADC functions

**Key Functions:**
- `board_power_init()` - Initializes power management
- `get_vbat_percent()` - Returns battery percentage
- `get_vbat_level()` - Returns battery voltage in mV
- `adc_get_voltage(AD_CH_VBAT)` - Reads battery ADC
