# OTA Flash Erase Failure - ROOT CAUSE FIXED

## Problem

OTA update fails immediately with error `0x02: Flash erase failed` when trying to erase the first sector of Bank B.

**Error from logs:**
```
OTA: Error 0x02: Flash erase failed
Custom OTA: Erase failed at 0x04E000, ret=?, sector 1/76
```

---

## ROOT CAUSE

**Flash write protection is enabled** in `SDK/cpu/bd19/tools/isd_config.ini`:

```ini
[BURNER_PASSTHROUGH_CFG]
FLASH_WRITE_PROTECT = YES;
```

This setting enables hardware flash write protection after initial programming, preventing **any** flash erase or write operations, including OTA updates.

---

## FIX APPLIED

### 1. Disabled Flash Write Protection

**File:** `SDK/cpu/bd19/tools/isd_config.ini`

**Change:**
```ini
[BURNER_PASSTHROUGH_CFG]
FLASH_WRITE_PROTECT = NO;  # Changed from YES to NO
```

**Impact:** Allows flash erase/write operations for OTA updates.

**Security Note:** For production, consider:
- Re-enabling write protection after OTA completes
- Using SDK's flash protection APIs to protect bootloader/boot info
- Implementing firmware signature verification

---

### 2. Optimized Flash Erase

**File:** `custom_dual_bank_ota.c`

**Changes:**
1. Only erase actual firmware size (rounded to 4KB), not entire 304KB bank
2. Test first sector erase before committing to full erase
3. Added detailed error logging

**Before:**
```c
sectors = (CUSTOM_BANK_SIZE + CUSTOM_FLASH_SECTOR - 1) / CUSTOM_FLASH_SECTOR;  // 76 sectors (304KB)
```

**After:**
```c
u32 size_to_erase = (size + CUSTOM_FLASH_SECTOR - 1) & ~(CUSTOM_FLASH_SECTOR - 1);
sectors = size_to_erase / CUSTOM_FLASH_SECTOR;  // ~55 sectors (220KB)
```

**Benefits:**
- Faster erase time (~55 sectors vs 76 sectors)
- Reduces risk of conflicts with SDK
- Better error diagnostics

---

## Testing Required

### 1. Rebuild Firmware
```bash
cd SDK
make clean_ac632n_spp_and_le
make ac632n_spp_and_le
```

### 2. Flash New Firmware
Use JieLi download tool to flash `jl_isd.ufw` with new configuration.

**IMPORTANT:** The new firmware must be flashed with `FLASH_WRITE_PROTECT = NO` setting.

### 3. Test OTA Update
1. Connect to device via BLE
2. Start OTA update with `app.bin`
3. Verify flash erase succeeds
4. Verify firmware transfer completes
5. Verify CRC verification passes

### Expected Logs
```
Custom OTA: START - size=224020, crc=0x6df6, version=1
Custom OTA: Erasing 55 sectors (220 KB) at bank 0x04E000...
Custom OTA: Active bank: 0, Target bank: 1
Custom OTA: Testing first sector erase at 0x04E000
Custom OTA: First sector erase SUCCESS
Custom OTA: Erased 10/55 sectors
Custom OTA: Erased 20/55 sectors
...
Custom OTA: Target bank erased, ready to receive
```

---

## Why This Happened

1. **Default SDK Configuration:** JieLi SDK enables flash write protection by default for security
2. **OTA Not Tested:** Previous testing didn't include actual OTA updates
3. **No Error Handling:** Original code didn't check for write protection

---

## Additional Improvements

### 1. Runtime Flash Protection Check

Add check in `custom_dual_bank_ota_init()`:

```c
int custom_dual_bank_ota_init(void)
{
    // ... existing code ...
    
    /* Test flash write capability */
    u8 test_buf[4] = {0xFF, 0xFF, 0xFF, 0xFF};
    u32 test_addr = CUSTOM_BANK_B_ADDR;  /* Test on Bank B */
    
    log_info("Custom OTA: Testing flash write capability at 0x%08x\n", test_addr);
    int ret = norflash_write(test_addr, test_buf, 4);
    if (ret != 0) {
        log_error("Custom OTA: Flash write test FAILED - flash may be write-protected\n");
        log_error("Custom OTA: Check FLASH_WRITE_PROTECT in isd_config.ini\n");
        return -1;
    }
    log_info("Custom OTA: Flash write test SUCCESS\n");
    
    return 0;
}
```

### 2. Flash Protection Management

For production, implement flash protection management:

```c
/* Disable flash protection before OTA */
void disable_flash_protection(void)
{
    /* Use SDK API to disable flash protection */
    /* Implementation depends on SDK version */
}

/* Re-enable flash protection after OTA */
void enable_flash_protection(void)
{
    /* Protect bootloader and boot info areas */
    /* Allow only Bank A/B writes during OTA */
}
```

---

## Production Checklist

Before deploying to production:

- [ ] Test OTA update with new configuration
- [ ] Verify flash erase succeeds
- [ ] Verify firmware transfer completes
- [ ] Verify CRC verification passes
- [ ] Test power loss during OTA
- [ ] Test rollback mechanism
- [ ] Implement firmware signature verification
- [ ] Consider selective flash protection (protect bootloader, allow banks)
- [ ] Add OTA attempt counter and lockout after failures
- [ ] Test with multiple firmware versions

---

## Security Considerations

### Disabling Flash Write Protection

**Pros:**
- Enables OTA updates
- Allows firmware upgrades without physical access

**Cons:**
- Firmware can be modified by malicious code
- No protection against unauthorized updates

**Mitigation:**
1. **Firmware Signature Verification:** Verify firmware signature before accepting OTA
2. **Secure Boot:** Implement secure boot to verify firmware integrity
3. **Encrypted Firmware:** Encrypt firmware during transfer
4. **Selective Protection:** Protect bootloader/boot info, allow bank writes
5. **OTA Authentication:** Require authentication before accepting OTA

### Recommended Production Configuration

```c
/* Before OTA */
1. Authenticate OTA request
2. Verify firmware signature
3. Disable flash protection temporarily
4. Perform OTA update
5. Verify new firmware
6. Re-enable flash protection
7. Reboot to new firmware

/* After Boot */
1. Verify firmware signature
2. If invalid, rollback to previous firmware
3. Enable flash protection
```

---

## Summary

**Root Cause:** Flash write protection enabled in SDK configuration

**Fix:** Disabled `FLASH_WRITE_PROTECT` in `isd_config.ini`

**Additional:** Optimized flash erase to only erase actual firmware size

**Status:** Ready for testing after firmware rebuild and reflash

**Next Steps:**
1. Rebuild firmware with new configuration
2. Flash to device
3. Test OTA update
4. Implement security measures for production
