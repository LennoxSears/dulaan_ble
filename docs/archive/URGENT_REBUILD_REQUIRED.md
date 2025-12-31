# URGENT: Rebuild and Reflash Required!

## Current Error

**Error 0x02: Flash erase failed**

This means:
- ✅ Device accepted firmware size (223,728 bytes < 300 KB)
- ✅ Device is running NEW firmware with 300 KB banks
- ❌ Flash erase operation is FAILING

## Root Cause

The flash erase is failing. Possible reasons:
1. **Device needs to be reflashed** with latest firmware
2. Flash write protection enabled
3. Trying to erase active bank (shouldn't happen)
4. norflash_erase() parameter issue

## IMMEDIATE ACTION REQUIRED

### Step 1: Rebuild Firmware
```
1. Open Code::Blocks
2. Open: SDK/apps/spp_and_le/board/bd19/AC632N_spp_and_le.cbp
3. Select "Release" build configuration
4. Click "Build" (or press F9)
5. Wait for compilation to complete
6. Check for errors
```

### Step 2: Locate New Firmware
```
After successful build, find:
SDK/apps/spp_and_le/board/bd19/app.bin

OR

SDK/cpu/bd19/tools/app.bin
```

### Step 3: Flash Device
```
Use JLink or your flashing tool to program the device with:
- app.bin (the newly built firmware)

This ensures the device is running the LATEST code with:
- 300 KB bank size
- All bug fixes
- custom_dual_bank_ota implementation
```

### Step 4: Copy to OTA Folder
```bash
# After flashing device, copy the SAME firmware for OTA testing
cp SDK/cpu/bd19/tools/app.bin dulaan_ota/app.bin
```

### Step 5: Test OTA
```
1. Hard refresh browser (Ctrl+Shift+R)
2. Load firmware file
3. Start OTA update
4. Should now work!
```

## Why This is Necessary

The device firmware MUST be rebuilt because:
1. Code changes were made (300 KB banks, bug fixes)
2. Build configuration was updated (custom_dual_bank_ota.c added)
3. The device needs to run the NEW firmware before OTA can work

## Error Code Reference

Firmware error codes (custom_dual_bank_ota.c):
- 0x01: Invalid size (too large or zero)
- **0x02: Flash erase failed** ← CURRENT ERROR
- 0x03: Flash write failed
- 0x04: CRC verification failed
- 0x05: Boot info update failed
- 0x06: OTA not initialized
- 0x07: Invalid state

## If Erase Still Fails After Rebuild

If error 0x02 persists after reflashing:

### Check 1: Verify Bank Addresses
```c
// In custom_dual_bank_ota.h
#define CUSTOM_BANK_A_ADDR      0x001400    // Bank A start
#define CUSTOM_BANK_B_ADDR      0x04C400    // Bank B start
```

### Check 2: Verify Active Bank
The code should erase the INACTIVE bank, not the active one.
Check logs for which bank is being erased.

### Check 3: Flash Protection
Some devices have flash protection that needs to be disabled.
Check SDK documentation for flash protection settings.

### Check 4: norflash_erase() Parameters
```c
// Current call:
ret = norflash_erase(0, addr);

// First parameter (0) is chip select
// Second parameter is address
// Verify this matches SDK examples
```

## Expected Behavior After Fix

1. START command accepted (size OK)
2. Flash erase succeeds (no 0x02 error)
3. Data packets accepted
4. CRC verification passes
5. Device reboots with new firmware

## Next Steps

1. **REBUILD firmware NOW**
2. **FLASH device with new firmware**
3. **Test OTA again**
4. If still fails, check flash protection settings

---

**Status:** ⚠️ WAITING FOR FIRMWARE REBUILD
**Priority:** 🔴 CRITICAL - Cannot proceed without rebuild
