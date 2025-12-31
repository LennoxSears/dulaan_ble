# Debugging Flash Erase Failure (Error 0x02)

## Current Status

You're running the new firmware, but `norflash_erase()` is failing.

## What We Need

**UART/JLink logs from the device!**

The Android logs don't show firmware debug output. We need to see:
- What address is being erased
- What the return code from `norflash_erase()` is
- Which bank is active vs target

## How to Get Logs

### Option 1: JLink RTT Viewer
```
1. Connect JLink to device
2. Open JLink RTT Viewer
3. Start OTA update
4. Copy all log output
```

### Option 2: UART Console
```
1. Connect UART (if available)
2. Open serial terminal (115200 baud)
3. Start OTA update
4. Copy all log output
```

## What to Look For

The new logging will show:

```
Custom OTA: START - size=223728, crc=0xeafe, version=1
Custom OTA: Target bank 1 at 0x04C400
Custom OTA: Erasing 75 sectors at bank 0x04C400...
Custom OTA: Active bank: 0, Target bank: 1
Custom OTA: First erase at 0x04C400
Custom OTA: Erase failed at 0x04C400, ret=X, sector 1/75
```

**Key information:**
- `ret=X` - What error code did norflash_erase() return?
- `0x04C400` - Is this the correct address?
- `Active bank: 0` - Is Bank A active? (should be)
- `Target bank: 1` - Is Bank B being erased? (should be)

## Possible Issues

### Issue 1: Wrong Eraser Parameter
```c
// Current:
ret = norflash_erase(0, addr);

// Maybe should be:
ret = norflash_erase(FLASH_SECTOR_ERASER, addr);
```

**Need to check SDK examples for correct eraser value.**

### Issue 2: Flash Protection
Some flash regions might be write-protected.

**Check:** Does SDK have flash protection APIs?

### Issue 3: Address Alignment
Flash erase might require specific address alignment.

**Check:** Is 0x04C400 properly aligned for 4KB sectors?
- 0x04C400 = 314,368 bytes
- 314,368 / 4096 = 76.75 ❌ NOT ALIGNED!

**WAIT! This might be the issue!**

Let me calculate:
- Bank A: 0x001400 = 5,120 bytes
- 5,120 / 4096 = 1.25 ❌ NOT ALIGNED!

**The bank addresses are NOT 4KB aligned!**

### Issue 4: Overlapping with Running Code
If Bank A is active and we're trying to erase Bank B, but Bank B
overlaps with code/data regions, the erase will fail.

## Immediate Actions

### Action 1: Get Device Logs
**CRITICAL:** We need UART/JLink logs to see the actual error.

### Action 2: Check Address Alignment
The bank addresses might not be 4KB aligned!

Current addresses:
- Boot Info: 0x001000 (4 KB aligned ✓)
- Bank A: 0x001400 (NOT 4KB aligned ❌)
- Bank B: 0x04C400 (NOT 4KB aligned ❌)

**Fix:** Align to 4KB boundaries:
```
- Boot Info: 0x001000 - 0x002000 (4 KB)
- Bank A:    0x002000 - 0x04E000 (304 KB)
- Bank B:    0x04E000 - 0x09A000 (304 KB)
- VM/Data:   0x09A000 - 0x100000 (408 KB)
```

### Action 3: Check SDK Examples
Find working OTA examples in SDK and check:
- What eraser parameter they use
- How they handle flash erase
- What addresses they use

## Next Steps

1. **Get device logs** (UART/JLink)
2. **Check if address alignment is the issue**
3. **Fix addresses if needed**
4. **Rebuild and test**

## Address Alignment Fix

If alignment is the issue, update custom_dual_bank_ota.h:

```c
/* Flash addresses and sizes - 4KB ALIGNED */
#define CUSTOM_BOOT_INFO_ADDR   0x001000    /* Boot info: 4 KB */
#define CUSTOM_BANK_A_ADDR      0x002000    /* Bank A start (8 KB offset) */
#define CUSTOM_BANK_B_ADDR      0x04E000    /* Bank B start */
#define CUSTOM_BANK_SIZE        (304 * 1024) /* 304 KB per bank */
```

This ensures all addresses are 4KB aligned for flash operations.

---

**Status:** ⚠️ WAITING FOR DEVICE LOGS
**Priority:** 🔴 CRITICAL - Need logs to diagnose
