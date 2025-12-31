# OTA UART Debug Guide

## Current Status

**Error:** `0x02: Flash erase failed` when starting OTA update

**What we know:**
- ✅ BLE connection successful
- ✅ MTU negotiation successful (512 bytes)
- ✅ Notifications enabled
- ✅ START command sent (size=224596, CRC=0x52ec)
- ❌ Flash erase fails immediately

**What we need:** UART logs from firmware to see detailed error

---

## UART Setup

### Hardware Connection

**Typical JieLi AC632N UART pins:**
- TX: Usually PB7 or PA5
- RX: Usually PB6 or PA4
- Baud: 1000000 (1Mbps)
- Format: 8N1

**Check your board schematic for actual pins.**

### UART Configuration in Firmware

The firmware should already have UART debug enabled. Check `isd_config.ini`:

```ini
[SYS_CFG_PARAM]
UTTX = PA05;        # UART TX pin
UTBD = 1000000;     # Baud rate: 1Mbps
UTRX = PP00;        # UART RX pin (usually not used for debug)
```

### Expected Debug Output

When OTA starts, you should see:

```
[CUSTOM_OTA] Custom OTA: START - size=224596, crc=0x52ec, version=1
[CUSTOM_OTA] Custom OTA: Erasing 55 sectors (220 KB) at bank 0x04E000...
[CUSTOM_OTA] Custom OTA: Active bank: 0, Target bank: 1
[CUSTOM_OTA] Custom OTA: Firmware size: 224596 bytes, will erase: 225280 bytes
[CUSTOM_OTA] Custom OTA: Testing first sector erase at 0x04E000
[CUSTOM_OTA_ERROR] Custom OTA: First sector erase FAILED at 0x04E000, ret=?
[CUSTOM_OTA_ERROR] Custom OTA: Flash may be write-protected or address invalid
```

The `ret=?` value will tell us why the erase failed.

---

## Possible Causes (Without UART Logs)

### 1. Flash Write Protection Still Enabled

**Most Likely Cause**

Even though we changed `isd_config.ini`, the device might still have the old firmware with protection enabled.

**Verification:**
- Did you rebuild firmware after changing `FLASH_WRITE_PROTECT = NO`?
- Did you flash the NEW `jl_isd.ufw` via USB?
- Or are you still running old firmware?

**Solution:**
```bash
# Rebuild firmware
cd SDK
make clean_ac632n_spp_and_le
make ac632n_spp_and_le

# Flash NEW firmware via USB
# File: SDK/cpu/bd19/tools/download/data_trans/jl_isd.ufw
```

### 2. Flash Address Conflict

The firmware might be trying to erase an invalid or protected address.

**Check:**
- Bank B address: `0x04E000`
- Is this address valid for your flash chip?
- Does it conflict with SDK's memory map?

### 3. Flash Chip Not Responding

Hardware issue with flash chip.

**Check:**
- Can the device read from flash? (it's running, so probably yes)
- Is flash chip properly powered?
- Are there any hardware faults?

### 4. SDK Flash Driver Issue

The `norflash_erase()` function might not be working correctly.

**Check:**
- Is the flash driver initialized?
- Are the flash parameters correct?

---

## Diagnostic Steps (Without UART)

### Step 1: Verify Firmware Version

Check if device is running NEW firmware with protection disabled:

**Add version check to device info:**

In `vm_ble_service.c`, the device info response includes firmware version:
```c
response[3] = VM_FIRMWARE_VERSION_LOW;   // Should be updated
response[4] = VM_FIRMWARE_VERSION_HIGH;  // Should be updated
```

**Increment version in `vm_ble_service.h`:**
```c
#define VM_FIRMWARE_VERSION_HIGH  2  // Changed from 1
#define VM_FIRMWARE_VERSION_LOW   0
```

Then query device info via BLE to confirm new firmware is running.

### Step 2: Test Flash Write Capability

Add a test function that tries to write to flash before OTA:

```c
// In custom_dual_bank_ota_init()
u8 test_buf[4] = {0xAA, 0xBB, 0xCC, 0xDD};
int ret = norflash_write(CUSTOM_BANK_B_ADDR, test_buf, 4);
if (ret != 0) {
    log_error("Flash write test FAILED - protection may be enabled\n");
    return -1;
}
log_info("Flash write test SUCCESS\n");
```

This will fail if protection is still enabled.

### Step 3: Check Build Configuration

Verify `isd_config.ini` in the built firmware:

```bash
# Check if the configuration was actually used
grep "FLASH_WRITE_PROTECT" SDK/cpu/bd19/tools/isd_config.ini
# Should show: FLASH_WRITE_PROTECT = NO;
```

### Step 4: Verify Flash Layout

Check if Bank B address is valid:

```bash
# Check flash size configuration
grep "FLASH_SIZE" SDK/cpu/bd19/tools/isd_config.ini
# Should show: FLASH_SIZE = 0x100000; (1MB)

# Bank B at 0x04E000 = 320KB offset
# Should be within 1MB flash
```

---

## What to Check When You Get UART Logs

### 1. Initialization Logs

Look for:
```
[CUSTOM_OTA] Custom OTA: Initializing dual-bank OTA system
[CUSTOM_OTA] Custom OTA: Boot info loaded successfully
[CUSTOM_OTA] Custom OTA:   Active bank: 0
[CUSTOM_OTA] Custom OTA:   Bank A: addr=0x00002000, size=?, valid=1
[CUSTOM_OTA] Custom OTA:   Bank B: addr=0x0004E000, size=0, valid=0
[CUSTOM_OTA] Custom OTA: Initialization complete
```

### 2. OTA Start Logs

Look for:
```
[CUSTOM_OTA] Custom OTA: START - size=224596, crc=0x52ec, version=1
[CUSTOM_OTA] Custom OTA: Erasing 55 sectors (220 KB) at bank 0x04E000...
[CUSTOM_OTA] Custom OTA: Testing first sector erase at 0x04E000
```

### 3. Error Details

The critical line:
```
[CUSTOM_OTA_ERROR] Custom OTA: First sector erase FAILED at 0x04E000, ret=?
```

The `ret` value will tell us:
- `ret = -1` or `ret = 1`: Generic error
- `ret = specific code`: SDK error code (check SDK documentation)

### 4. Flash Protection Status

Look for any SDK messages about flash protection:
```
[SDK] Flash write protection: ENABLED/DISABLED
[SDK] Flash status register: 0x??
```

---

## Temporary Workaround (If Protection is the Issue)

If flash protection is still enabled and you can't reflash via USB right now, you could try:

### Option 1: Use SDK's Flash Protection API

Add to `custom_dual_bank_ota_start()`:

```c
// Try to disable flash protection at runtime
extern void sfc_write_protect(u8 enable);
sfc_write_protect(0);  // 0 = disable

// Or try SDK's flash unlock
extern int norflash_unlock(void);
norflash_unlock();
```

**Note:** This may or may not work depending on how protection was set.

### Option 2: Use Different Flash Region

Try using a different flash region that might not be protected:

```c
// Instead of Bank B at 0x04E000, try VM area
#define CUSTOM_BANK_B_ADDR  0x09A000  // VM area (should not be protected)
```

**Warning:** This will conflict with VM data, only for testing.

---

## Questions for Chip Owner

When you contact the chip owner, ask:

1. **UART Pin Configuration:**
   - Which pins are UART TX/RX on your board?
   - What baud rate is configured?

2. **Flash Protection:**
   - How is flash write protection implemented?
   - Can it be disabled from running firmware?
   - What's the correct way to disable it?

3. **Flash Layout:**
   - What's the actual flash memory map?
   - Which regions are protected?
   - Where should OTA firmware be written?

4. **SDK Flash API:**
   - What's the correct way to erase flash?
   - Are there any special requirements?
   - Any known issues with `norflash_erase()`?

5. **OTA Implementation:**
   - Does JieLi provide example OTA code?
   - What's the recommended OTA approach?
   - Any documentation on dual-bank OTA?

---

## Next Steps

1. **Get UART logs** - This is critical for diagnosis
2. **Verify firmware version** - Make sure new firmware is running
3. **Check flash protection** - Confirm it's actually disabled
4. **Contact chip owner** - Get technical details

Once we have UART logs, we can see exactly why the flash erase is failing and fix it properly.

---

## Expected Timeline

- **With UART logs:** Can diagnose and fix in 1-2 hours
- **Without UART logs:** Guessing, could take days

**UART logs are essential for debugging this issue.**
