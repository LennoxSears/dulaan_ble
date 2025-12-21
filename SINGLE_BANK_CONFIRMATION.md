# Single-Bank OTA in JieLi SDK

## Question: Is there a single-bank example in the SDK?

## Answer: ✅ YES - Mesh Examples Use Single-Bank

---

## SDK Examples Using Single-Bank:

### All Mesh Examples:

```bash
SDK/apps/mesh/board/bd19/
├── board_ac632n_demo_global_build_cfg.h
├── board_ac6321a_demo_global_build_cfg.h
├── board_ac6323a_demo_global_build_cfg.h
├── board_ac6328a_demo_global_build_cfg.h
├── board_ac6329b_demo_global_build_cfg.h
├── board_ac6329c_demo_global_build_cfg.h
├── board_ac6329e_demo_global_build_cfg.h
└── board_ac6329f_demo_global_build_cfg.h
```

**All have**:
```c
#define CONFIG_DOUBLE_BANK_ENABLE  0  // Single-bank mode
```

---

## Key Discovery: Same API for Both Modes!

### The "dual_bank" API Works for Single-Bank Too:

**File**: `SDK/apps/mesh/mesh_dfu/mesh_target_node_ota.c`

```c
// Single-bank mode (CONFIG_DOUBLE_BANK_ENABLE = 0)
// But still uses "dual_bank" API:

ret = dual_bank_passive_update_init(reverse_data, file_size, OTA_WRITE_FLASH_SIZE, NULL);
if (0 == ret) {
    ret = dual_bank_update_allow_check(file_size);
    if (ret) {
        log_error("check err: %d", ret);
        status = MESH_TARGET_OTA_OP_NO_SPACE;
    }
}

// Write data
ret = dual_bank_update_write(buff, data_len, callback);

// Finish
dual_bank_update_burn_boot_info(callback);
```

**The API name is misleading!**
- API is called `dual_bank_*`
- But works for BOTH single-bank and dual-bank modes
- Mode is controlled by `CONFIG_DOUBLE_BANK_ENABLE` config
- Same code, different behavior based on config

---

## How It Works:

### Configuration Determines Behavior:

```c
// board_ac632n_demo_global_build_cfg.h
#define CONFIG_DOUBLE_BANK_ENABLE  0  // or 1

// SDK internally checks this:
#if CONFIG_DOUBLE_BANK_ENABLE
    // Dual-bank logic: needs 2x space
#else
    // Single-bank logic: needs 1x space
#endif
```

### Same API, Different Modes:

| Function | Dual-Bank Mode | Single-Bank Mode |
|----------|----------------|------------------|
| `dual_bank_passive_update_init()` | Checks for 2x space | Checks for 1x space |
| `dual_bank_update_allow_check()` | Validates 2x space | Validates 1x space |
| `dual_bank_update_write()` | Writes to Bank B | Writes to VM area |
| `dual_bank_update_burn_boot_info()` | Switches banks | Copies VM → main |

**Your code is already correct!**

---

## What This Means for You:

### Your Current Code is Already Single-Bank Compatible!

**You already have**:
```c
// board_ac632n_demo_global_build_cfg.h
#define CONFIG_DOUBLE_BANK_ENABLE  1  // Currently dual-bank
```

**Just change to**:
```c
#define CONFIG_DOUBLE_BANK_ENABLE  0  // Single-bank
```

**Your OTA code doesn't need any changes!**

The same `dual_bank_*` API calls will work in single-bank mode.

---

## Configuration Changes Needed:

### 1. Enable Single-Bank Mode:

```c
// SDK/apps/spp_and_le/board/bd19/board_ac632n_demo_global_build_cfg.h
#define CONFIG_DOUBLE_BANK_ENABLE  0  // Change from 1 to 0
```

### 2. Increase VM to Maximum:

```ini
# SDK/cpu/bd19/tools/isd_config.ini
VM_LEN = 272K;  # Change from 240K
```

```c
// SDK/apps/spp_and_le/board/bd19/board_ac632n_demo_global_build_cfg.h
#define CONFIG_VM_LEAST_SIZE  272K  # Change from 240K
```

### 3. Update Max Size:

```c
// SDK/apps/spp_and_le/examples/motor_control/vibration_motor_ble/vm_ble_service.h
#define VM_OTA_MAX_SIZE  (272*1024)  # Change from 240KB
```

### 4. No Code Changes Needed!

Your OTA handler already uses the correct API:
```c
// vm_ble_service.c - NO CHANGES NEEDED
dual_bank_passive_update_init(0, ota_total_size, 240, NULL);
dual_bank_update_allow_check(ota_total_size);
dual_bank_update_write(firmware_data, data_len, NULL);
dual_bank_update_burn_boot_info(NULL);
```

**This code works for both single-bank and dual-bank!**

---

## Rebuild and Test:

```bash
cd SDK
make clean_ac632n_spp_and_le
make ac632n_spp_and_le
```

**Expected result**:
- Firmware: 217KB
- VM: 272KB
- Single-bank mode: ✅ Fits!
- OTA should work

---

## Verification:

### Check Build Output:

```
VM_REAL_SIZE: 0x44000 = 272KB  ← Should show 272KB
CONFIG_DOUBLE_BANK_ENABLE: 0   ← Should be 0
```

### Test OTA:

1. Flash firmware to device
2. Upload 217KB firmware via web tool
3. Should succeed (no error 0x02)
4. Device reboots with new firmware

---

## Comparison with Mesh Example:

### Mesh OTA (Single-Bank):

```c
// mesh_target_node_ota.c
dual_bank_passive_update_init(reverse_data, file_size, OTA_WRITE_FLASH_SIZE, NULL);
dual_bank_update_allow_check(file_size);
dual_bank_update_write(buff, data_len, callback);
dual_bank_update_burn_boot_info(callback);
```

### Your OTA (Single-Bank):

```c
// vm_ble_service.c
dual_bank_passive_update_init(0, ota_total_size, 240, NULL);
dual_bank_update_allow_check(ota_total_size);
dual_bank_update_write(firmware_data, data_len, NULL);
dual_bank_update_burn_boot_info(NULL);
```

**Exact same pattern!** ✅

---

## Safety Considerations:

### Single-Bank Risks:

1. **Power loss during bootloader copy**:
   - VM has new firmware
   - Main flash being overwritten
   - If power lost: Device may not boot
   - Recovery: UART programming

2. **Corrupted firmware**:
   - No rollback to previous version
   - Device stuck with bad firmware
   - Recovery: UART programming

### Mitigations:

1. **Battery check before OTA**:
   ```c
   uint8_t battery = get_vbat_percent();
   if (battery < 30) {
       return ERROR_LOW_BATTERY;
   }
   ```

2. **Warn user**:
   - "Do not power off during update"
   - "Keep device charged"
   - "Update takes ~15 seconds"

3. **Fast update**:
   - 217KB at 240 bytes/chunk = ~900 packets
   - At 20ms per packet = ~18 seconds
   - Minimize risk window

---

## Summary:

### Is there a single-bank example? ✅ YES

**Location**: `SDK/apps/mesh/mesh_dfu/mesh_target_node_ota.c`

**Configuration**: All mesh examples use `CONFIG_DOUBLE_BANK_ENABLE = 0`

**API**: Same `dual_bank_*` functions work for both modes

**Your code**: Already compatible, just change config

---

## Action Items:

### To Enable Single-Bank OTA:

1. ✅ Set `CONFIG_DOUBLE_BANK_ENABLE = 0`
2. ✅ Set `VM_LEN = 272K`
3. ✅ Set `CONFIG_VM_LEAST_SIZE = 272K`
4. ✅ Set `VM_OTA_MAX_SIZE = 272KB`
5. ✅ Rebuild
6. ✅ Test

**No code changes needed - your implementation already follows SDK pattern!**

---

## Conclusion:

**Single-bank examples exist in SDK (mesh apps).**

**Your code is already compatible.**

**Just change configuration and rebuild.**

**217KB firmware will work with single-bank OTA on 512KB flash.**
