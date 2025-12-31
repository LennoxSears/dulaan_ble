# OTA Flash Protection - Complete Solution

## Problem

You're trying to update via OTA (`app.bin`), but the **current firmware on the device has flash write protection enabled**, preventing flash erase operations.

**Error:** `0x02: Flash erase failed`

---

## Why This Happens

1. Device was initially flashed with firmware built with `FLASH_WRITE_PROTECT = YES`
2. Flash protection is **hardware-level** - set during initial programming
3. Once enabled, it **cannot be disabled from running firmware**
4. OTA update tries to erase flash → **BLOCKED by hardware protection**

---

## Solution: One-Time USB Flash Required

### Step 1: Build Firmware with Protection Disabled

```bash
cd SDK
make clean_ac632n_spp_and_le
make ac632n_spp_and_le
```

**Configuration change already applied:**
- `SDK/cpu/bd19/tools/isd_config.ini`
- `FLASH_WRITE_PROTECT = NO`

### Step 2: Flash via USB (ONE TIME ONLY)

**Use JieLi Download Tool:**

1. Connect device via USB
2. Open JieLi download tool
3. Flash file: `SDK/cpu/bd19/tools/download/data_trans/jl_isd.ufw`
4. Wait for completion

**This installs firmware with flash protection disabled.**

### Step 3: OTA Will Now Work

After USB flash:
- Device has firmware with `FLASH_WRITE_PROTECT = NO`
- Flash erase/write operations are allowed
- OTA updates with `app.bin` will work
- **No more USB flashing needed** - all future updates via OTA

---

## Why You Can't Skip USB Flash

### What Happens If You Try OTA Without USB Flash:

```
Current Device State:
├── Running firmware: Built with FLASH_WRITE_PROTECT = YES
├── Flash protection: ENABLED (hardware level)
└── OTA attempt: FAILS (can't erase flash)

After USB Flash:
├── Running firmware: Built with FLASH_WRITE_PROTECT = NO  
├── Flash protection: DISABLED
└── OTA attempt: SUCCESS (can erase flash)
```

### Why Runtime Disable Doesn't Work:

Flash write protection is set by the **download tool during initial programming**, not by the firmware. Once set, it's **hardware-locked** until next USB programming.

---

## Alternative: Use SDK's OTA Mechanism

If you absolutely cannot do USB flash, you mentioned SDK's built-in dual-bank OTA didn't work. Let's try to fix that instead:

### Check SDK OTA Configuration

1. **Enable SDK OTA in build config:**
   ```c
   // In board_ac632n_demo_global_build_cfg.h
   #define CONFIG_APP_OTA_ENABLE  1
   ```

2. **Use SDK's OTA API:**
   ```c
   #include "update/update.h"
   
   // Instead of custom OTA, use SDK's mechanism
   void trigger_sdk_ota(void)
   {
       update_mode_api_v2(DUAL_BANK_UPDATA, NULL, NULL);
   }
   ```

3. **SDK handles flash protection internally**

**Why SDK OTA might not have worked before:**
- Incorrect configuration
- Wrong firmware format
- Missing VM partition setup

---

## Comparison: Custom OTA vs SDK OTA

### Custom OTA (Current Implementation)
**Pros:**
- Full control over process
- Works with raw `app.bin`
- No SDK dependencies

**Cons:**
- ❌ Requires USB flash to disable protection
- ❌ No bootloader integration yet
- ❌ More complex to maintain

### SDK OTA (Built-in)
**Pros:**
- ✅ Handles flash protection automatically
- ✅ Bootloader integration included
- ✅ Tested and supported by SDK

**Cons:**
- May require specific firmware format
- Less control over process
- SDK-specific configuration

---

## Recommended Path Forward

### Option A: Continue with Custom OTA (Current)

1. ✅ Do one-time USB flash with `FLASH_WRITE_PROTECT = NO`
2. ✅ Test OTA with `app.bin` - should work
3. ⏳ Integrate bootloader (see `BOOTLOADER_INTEGRATION.md`)
4. ⏳ Add rollback mechanism
5. ⏳ Test thoroughly

**Timeline:** 1-2 days (after USB flash)

### Option B: Switch to SDK OTA

1. Study SDK OTA documentation
2. Configure SDK OTA properly
3. Test with SDK's firmware format
4. May need to adjust build process

**Timeline:** 2-3 days (research + implementation)

---

## Immediate Action Required

**YOU MUST DO ONE OF:**

### Choice 1: USB Flash (Recommended)
```bash
# Build firmware
cd SDK
make clean_ac632n_spp_and_le
make ac632n_spp_and_le

# Flash via USB
# File: SDK/cpu/bd19/tools/download/data_trans/jl_isd.ufw
# Tool: JieLi Download Tool

# After flash, OTA will work
```

### Choice 2: Investigate SDK OTA
```bash
# Research SDK's built-in OTA
# Check why it didn't work before
# May be simpler than custom implementation
```

---

## FAQ

### Q: Can I disable flash protection from running firmware?
**A:** No. Flash protection is hardware-level, set during USB programming. Cannot be changed from running firmware.

### Q: Why does SDK OTA work without USB flash?
**A:** SDK OTA may use different flash regions or have special handling. Need to investigate SDK implementation.

### Q: Can I use `app.bin` for initial flash?
**A:** No. Initial flash requires `jl_isd.ufw` which includes bootloader, configuration, and firmware. `app.bin` is only for OTA updates.

### Q: Will I need USB flash for every update?
**A:** No. Only **one time** to install firmware with protection disabled. After that, all updates via OTA.

### Q: Is it safe to disable flash protection?
**A:** For development: Yes. For production: Add firmware signature verification and authentication.

---

## Summary

**Current State:**
- Device has flash protection enabled
- OTA fails with error 0x02 (erase failed)
- Cannot be fixed from running firmware

**Solution:**
- One-time USB flash with `FLASH_WRITE_PROTECT = NO`
- After that, OTA will work permanently
- No more USB flashing needed

**Action Required:**
1. Build firmware (already configured)
2. USB flash `jl_isd.ufw` (one time)
3. Test OTA with `app.bin` (should work)

**Alternative:**
- Investigate SDK's built-in OTA mechanism
- May avoid need for custom implementation
