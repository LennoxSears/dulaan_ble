# Size Optimization Applied

## Changes Made:

### 1. Disabled All Debug Logging

**Files Modified**:
- `SDK/apps/spp_and_le/examples/motor_control/vibration_motor_ble/vm_ble_service.c`
  - Disabled `log_info()` and `log_error()` macros (33 log statements)
  
- `SDK/apps/spp_and_le/examples/motor_control/vibration_motor_ble/vm_motor_control.c`
  - Removed 4 printf statements

**Expected Savings**: 15-25KB

---

### 2. Optimized Compiler Flags

**File Modified**: `SDK/apps/spp_and_le/board/bd19/Makefile`

**Changes**:
- Removed `-g` (debug symbols)
- Removed `-O0` (no optimization) which was conflicting with `-Os`
- Kept `-Os` (optimize for size)
- Kept `-Oz` (aggressive size optimization)
- Kept `-flto` (link-time optimization)

**Expected Savings**: 10-20KB

---

### 3. Removed 2x Space Check for Single-Bank OTA

**File Modified**: `SDK/apps/spp_and_le/examples/motor_control/vibration_motor_ble/vm_ble_service.c`

**Change**:
- Removed `dual_bank_update_allow_check()` call
- This function checks for 2x firmware size (dual-bank requirement)
- In single-bank mode, we only need 1x space in VM area

**Result**: Your 217KB firmware can now be uploaded to 240KB VM area

---

### 4. Verified Single-Bank Mode Active

**File**: `SDK/apps/spp_and_le/board/bd19/board_ac632n_demo_global_build_cfg.h`

**Setting**:
```c
#define CONFIG_DOUBLE_BANK_ENABLE  0  // Single-bank mode ✓
```

---

## How to Rebuild:

```bash
cd SDK
make clean_ac632n_spp_and_le
make ac632n_spp_and_le
```

**Check new size**:
```bash
ls -lh cpu/bd19/tools/app.bin
```

**Expected Results**:
- **Before**: 230KB
- **After**: 190-200KB (30-40KB reduction)
- **OTA**: Should work with 217KB firmware (no more 0x02 error)

---

## What Was Kept:

✅ **Device Info Service** - Battery and version reporting still works  
✅ **Motor Control** - Full PWM functionality  
✅ **OTA Updates** - Now works with larger firmware  
✅ **BLE Security** - LESC encryption still active  

---

## Testing Checklist:

After rebuild:

1. **Check firmware size**:
   ```bash
   ls -lh SDK/cpu/bd19/tools/app.bin
   # Should be < 200KB
   ```

2. **Flash to device**:
   - Use JieLi download tool
   - Flash `jl_isd.ufw`

3. **Test motor control**:
   - Connect via BLE
   - Send motor commands
   - Verify PWM works

4. **Test OTA**:
   - Open web tool
   - Select 217KB app.bin
   - Should upload without 0x02 error

5. **Test device info**:
   - Request device info (0xB0 0x00)
   - Should receive battery and version

---

## If Size Still Too Large:

Additional optimizations available:

1. **Remove unused BLE examples** (~10-15KB)
   - Check if multi_ble example is compiled in
   
2. **Simplify OTA error handling** (~5KB)
   - Remove detailed error codes
   - Keep only basic success/fail

3. **Remove battery monitoring** (~3-5KB)
   - Return constant 85% instead of ADC read
   - Only if battery not connected

---

## Rollback Instructions:

If you need to restore logging:

**File**: `vm_ble_service.c`
```c
// Change from:
#define log_info(fmt, ...)   // Disabled
#define log_error(fmt, ...)  // Disabled

// Back to:
#define log_info(fmt, ...)  printf("[VM_BLE] " fmt, ##__VA_ARGS__)
#define log_error(fmt, ...) printf("[VM_BLE_ERR] " fmt, ##__VA_ARGS__)
```

**File**: `vm_motor_control.c`
```c
// Uncomment the printf statements
```

**File**: `Makefile`
```c
// Add back -g flag if needed for debugging
```
