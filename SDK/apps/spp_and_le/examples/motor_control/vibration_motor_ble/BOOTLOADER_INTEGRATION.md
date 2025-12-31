# Bootloader Integration for Custom Dual-Bank OTA

## Problem

The custom dual-bank OTA implementation writes firmware to Bank B and updates boot info, but **there is no bootloader to read the boot info and jump to the correct bank**.

**Current behavior:**
1. ✅ Firmware written to Bank B (0x04E000)
2. ✅ Boot info updated (active_bank = 1)
3. ✅ Device resets via `cpu_reset()`
4. ❌ **Device boots from default location (Bank A) - ignores boot info**

## Solution Options

### Option 1: Use SDK's Update Mechanism (RECOMMENDED)

The SDK provides `update_mode_api_v2()` which can trigger a dual-bank update. We need to integrate with it.

**Steps:**
1. After writing firmware to Bank B, call SDK's update API
2. SDK's bootloader will handle bank switching
3. Device reboots into new firmware

**Implementation:**

```c
#include "update/update.h"

int custom_dual_bank_ota_end(void)
{
    // ... existing CRC verification code ...
    
    /* Update boot info */
    target_info->addr = g_ota_ctx.target_bank_addr;
    target_info->size = g_ota_ctx.total_size;
    target_info->crc = calculated_crc;
    target_info->valid = 1;
    target_info->version = g_ota_ctx.target_version;
    
    /* Switch active bank */
    g_boot_info.active_bank = target_bank;
    g_boot_info.boot_count = 0;
    
    /* Write boot info */
    ret = write_boot_info();
    if (ret != 0) {
        return ret;
    }
    
    log_info("Custom OTA: Triggering SDK update mechanism...\n");
    
    /* Trigger SDK's dual-bank update */
    /* This will cause bootloader to switch to new bank on next boot */
    update_mode_api_v2(DUAL_BANK_UPDATA, NULL, NULL);
    
    /* SDK will reset device */
    return 0;
}
```

### Option 2: Modify Linker Script (COMPLEX)

Modify the linker script to place firmware at Bank A or Bank B based on boot info.

**Challenges:**
- Requires understanding SDK's linker script
- May conflict with SDK's memory management
- Difficult to maintain across SDK updates

**Not recommended** - too complex and fragile.

### Option 3: Custom Bootloader (VERY COMPLEX)

Write a custom bootloader that:
1. Runs at 0x000000 (bootloader location)
2. Reads boot info at 0x001000
3. Jumps to active bank (Bank A or Bank B)

**Challenges:**
- Requires low-level assembly/C code
- Must fit in 4KB bootloader space
- Risk of bricking device if bootloader fails
- Conflicts with SDK's bootloader

**Not recommended** - extremely risky.

## Recommended Approach

**Use SDK's update mechanism (Option 1)** with the following integration:

### 1. Verify SDK Configuration

Check `isd_config.ini`:
```ini
[EXTRA_CFG_PARAM]
FORCE_4K_ALIGN = YES;
FLASH_SIZE = 0x100000;

[RESERVED_CONFIG]
VM_ADR = 0;
VM_LEN = 500K;
```

### 2. Integrate with SDK Update API

Modify `custom_dual_bank_ota_end()` to call `update_mode_api_v2()` after writing boot info.

### 3. Test Boot Sequence

1. Flash initial firmware to Bank A
2. Perform OTA update (writes to Bank B)
3. Device resets
4. SDK bootloader reads boot info
5. SDK bootloader jumps to Bank B
6. New firmware runs

### 4. Implement Rollback

Add boot counter logic:
```c
void check_boot_success(void)
{
    if (g_boot_info.boot_count >= MAX_BOOT_TRIES) {
        log_error("Boot failed %d times, rolling back\n", g_boot_info.boot_count);
        
        /* Switch back to previous bank */
        g_boot_info.active_bank = (g_boot_info.active_bank == 0) ? 1 : 0;
        g_boot_info.boot_count = 0;
        write_boot_info();
        
        cpu_reset();
    }
    
    /* Increment boot counter */
    g_boot_info.boot_count++;
    write_boot_info();
    
    /* Mark boot as successful after 30 seconds */
    os_time_dly(3000);  /* 30 seconds */
    g_boot_info.boot_count = 0;
    write_boot_info();
}
```

## Alternative: Single-Bank OTA

If dual-bank is too complex, consider single-bank OTA:

1. Write new firmware to temporary location (VM area)
2. On next boot, SDK copies from VM to main firmware area
3. Simpler but requires more flash space

**SDK already supports this via `BLE_APP_UPDATA` type.**

## Conclusion

**Recommended:** Integrate with SDK's `update_mode_api_v2()` using `DUAL_BANK_UPDATA` type. This leverages SDK's existing bootloader and is the safest approach.

**Next Steps:**
1. Study SDK's update mechanism documentation
2. Test `update_mode_api_v2()` with simple firmware
3. Integrate into `custom_dual_bank_ota_end()`
4. Add rollback mechanism
5. Test thoroughly with power loss scenarios
