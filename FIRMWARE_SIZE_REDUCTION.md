# Firmware Size Reduction Guide

## Current Status

**Firmware size**: 230KB (app.bin)  
**Target**: <120KB for single-bank OTA  
**Need to reduce**: ~110KB (48% reduction)

---

## Answer to Your Questions:

### 1) Can we use single-bank mode instead of dual-bank?

**YES! Already using single-bank mode.**

Check: `SDK/apps/spp_and_le/board/bd19/board_ac632n_demo_global_build_cfg.h`
```c
#define CONFIG_DOUBLE_BANK_ENABLE  0  // Already single-bank!
```

**But the problem remains**: Even in single-bank mode, the `dual_bank_*` API functions check if there's enough space for the update process, and 217KB firmware still needs more space than available.

The SDK's dual_bank API name is misleading - it works for both single and dual bank modes, but still requires sufficient VM space.

---

## 2) How to Reduce Firmware Size

### Quick Wins (Estimated Savings):

#### A. Disable Debug Logging (~15-25KB)

**File**: `SDK/apps/spp_and_le/examples/motor_control/vibration_motor_ble/vm_ble_service.c`

**Change**:
```c
// Current (line 16-17):
#define log_info(fmt, ...)  printf("[VM_BLE] " fmt, ##__VA_ARGS__)
#define log_error(fmt, ...) printf("[VM_BLE_ERR] " fmt, ##__VA_ARGS__)

// Change to:
#define log_info(fmt, ...)   // Empty - no logging
#define log_error(fmt, ...)  // Empty - no logging
```

**Impact**: Removes 33 log statements + printf library code

---

#### B. Disable UART Debug Output (~10-15KB)

**File**: `SDK/apps/spp_and_le/board/bd19/board_ac632n_demo_global_build_cfg.h`

**Find and change**:
```c
// Look for UART debug settings
#define TCFG_UART0_ENABLE  DISABLE_THIS_MOUDLE  // Already disabled
```

**Also check**: `SDK/apps/spp_and_le/include/app_config.h`
```c
// Disable all debug output
#define LIB_DEBUG  0  // Change from 1 to 0
```

---

#### C. Remove Device Info Service (~5-8KB)

If you don't need battery/version reporting:

**File**: `SDK/apps/spp_and_le/examples/motor_control/vibration_motor_ble/vm_ble_profile.h`

**Comment out** (lines ~50-70):
```c
// Comment out entire device info characteristic:
/*
ATT_CHARACTERISTIC, WRITE_WITHOUT_RESPONSE | NOTIFY, \
    ATT_CHARACTERISTIC_VM_DEVICE_INFO_VALUE_HANDLE, \
    ATT_CHARACTERISTIC_VM_DEVICE_INFO_UUID, \
ATT_CHARACTERISTIC_VM_DEVICE_INFO_CLIENT_CONFIGURATION_HANDLE, \
    ATT_CLIENT_CHARACTERISTIC_CONFIGURATION_UUID, \
*/
```

**File**: `SDK/apps/spp_and_le/examples/motor_control/vibration_motor_ble/vm_ble_service.c`

**Remove handler** (lines ~140-160):
```c
// Comment out device info handling in vm_att_write_callback()
```

---

#### D. Optimize Compiler Flags (~20-30KB)

**File**: `SDK/apps/spp_and_le/Makefile` or build config

**Add optimization flags**:
```makefile
CFLAGS += -Os          # Optimize for size (instead of -O2)
CFLAGS += -flto        # Link-time optimization
CFLAGS += -ffunction-sections -fdata-sections
LDFLAGS += -Wl,--gc-sections  # Remove unused sections
```

---

#### E. Remove Unused BLE Services (~15-20KB)

Check if any example services are still compiled in:

**File**: `SDK/apps/spp_and_le/examples/multi_ble/ble_multi.c`

Make sure only your motor control example is active, not the default multi_ble example.

---

#### F. Disable BLE Security (NOT RECOMMENDED) (~10-15KB)

**Only if you don't need encryption**:

**File**: `SDK/apps/spp_and_le/include/app_config.h`
```c
#define CONFIG_BT_SM_SUPPORT_ENABLE  0  // Disable encryption
```

**Warning**: This removes LESC pairing. Only do this for testing.

---

### Medium Effort:

#### G. Remove Battery Monitoring (~3-5KB)

If no battery connected:

**File**: `SDK/apps/spp_and_le/examples/motor_control/vibration_motor_ble/vm_ble_service.c`

**Change** (line ~100):
```c
// Replace get_vbat_percent() with constant:
response[5] = 85;  // Always return 85%
```

---

#### H. Simplify OTA Handler (~5-10KB)

Remove progress notifications and error handling:

**File**: `SDK/apps/spp_and_le/examples/motor_control/vibration_motor_ble/vm_ble_service.c`

- Remove progress tracking
- Remove detailed error codes
- Simplify to basic write-only

---

### Build Configuration Check:

**File**: `SDK/apps/spp_and_le/board/bd19/board_ac632n_demo_global_build_cfg.h`

Verify these are disabled:
```c
#define CONFIG_APP_OTA_ENABLE           0  // ✓ Already disabled
#define CONFIG_ANC_ENABLE               0  // ✓ Already disabled  
#define CONFIG_LP_TOUCH_KEY_EN          0  // ✓ Already disabled
```

---

## Step-by-Step Reduction Plan:

### Phase 1: Quick Wins (Target: -40KB)

1. **Disable all logging** (A)
2. **Optimize compiler flags** (D)
3. **Disable debug output** (B)

**Rebuild and check**:
```bash
cd SDK
make clean_ac632n_spp_and_le
make ac632n_spp_and_le
ls -lh cpu/bd19/tools/app.bin
```

**Expected**: ~190KB

---

### Phase 2: Feature Removal (Target: -30KB)

4. **Remove device info service** (C) - if not needed
5. **Remove unused BLE services** (E)
6. **Simplify OTA handler** (H)

**Rebuild and check**:
```bash
make clean_ac632n_spp_and_le
make ac632n_spp_and_le
ls -lh cpu/bd19/tools/app.bin
```

**Expected**: ~160KB

---

### Phase 3: Aggressive Optimization (Target: -40KB)

7. **Check map file for large symbols**:
```bash
cd SDK/cpu/bd19/tools
grep -E "^\s+0x[0-9a-f]+\s+0x[0-9a-f]+" sdk.map | \
  awk '{if ($2 ~ /^0x/) print $2, $NF}' | \
  sort -t'x' -k2 -nr | head -20
```

8. **Identify and remove large unused functions**

9. **Consider removing BLE security** (F) - testing only

**Expected**: ~120KB

---

## Verification:

After each phase, check:
```bash
# 1. Check firmware size
ls -lh SDK/cpu/bd19/tools/app.bin

# 2. Test basic functionality
# - Motor control works
# - BLE connection works
# - OTA works (if size < 120KB)

# 3. Check what's using space
cd SDK/cpu/bd19/tools
size sdk.elf
```

---

## Alternative: Accept Limitation

If you can't reduce below 120KB:

### Option 1: Use UART OTA for Updates
- No size limit
- Faster than BLE
- Requires physical connection
- Good for factory/development

### Option 2: Upgrade Flash Chip
- AC6328A (1MB flash, pin-compatible)
- Cost: +$0.20 per unit
- Supports up to 500KB firmware

### Option 3: External Flash
- Add SPI flash chip
- Cost: ~$0.50 per unit
- Requires PCB modification

---

## Summary:

**Realistic target**: 120-140KB with aggressive optimization

**Easiest wins**:
1. Disable logging (A) - 5 minutes
2. Optimize compiler (D) - 10 minutes
3. Remove device info (C) - 15 minutes

**Total time**: ~30 minutes for 40-50KB reduction

**If still too large**: Consider hardware upgrade (AC6328A chip)
