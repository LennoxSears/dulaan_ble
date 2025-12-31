# Flash Layout Verification

## SDK Configuration (isd_config.ini)

```ini
[EXTRA_CFG_PARAM]
FLASH_SIZE = 0x100000;      # 1MB total flash
FORCE_4K_ALIGN = YES;

[RESERVED_CONFIG]
PRCT_ADR = 0;               # Code starts at 0 (auto)
PRCT_LEN = CODE_LEN;        # Code length (auto-calculated)

VM_ADR = 0;                 # VM partition (auto-allocated)
VM_LEN = 500K;              # 500KB VM partition

BTIF_ADR = AUTO;            # Bluetooth info (auto-allocated)
BTIF_LEN = 0x1000;          # 4KB
```

## Custom Flash Layout

```
0x000000 - 0x001000 (4 KB)     Bootloader (SDK managed)
0x001000 - 0x001400 (1 KB)     Custom Boot Info (Primary)
0x001400 - 0x001800 (1 KB)     Custom Boot Info (Backup)
0x001800 - 0x002000 (2 KB)     Reserved/Unused
0x002000 - 0x04E000 (304 KB)   Bank A (app.bin)
0x04E000 - 0x09A000 (304 KB)   Bank B (app.bin)
0x09A000 - 0x100000 (408 KB)   VM/Data Partition
```

## Potential Conflicts

### 1. VM Partition Location

**SDK Config:** `VM_ADR = 0` (auto-allocated)

**Risk:** SDK may auto-allocate VM partition starting at 0x001000, which conflicts with our custom boot info.

**Verification Needed:**
- Check where SDK actually places VM partition
- Verify SDK doesn't overwrite 0x001000-0x09A000 range

### 2. Code Size

**Current firmware:** ~220KB

**Bank size:** 304KB

**Risk:** If firmware grows beyond 304KB, it will overflow into next bank.

**Mitigation:** Monitor firmware size during builds.

### 3. BTIF Location

**SDK Config:** `BTIF_ADR = AUTO` (auto-allocated)

**Risk:** SDK may place BTIF in our custom area.

## Recommended Verification Steps

### 1. Check Actual Memory Map

After building, check the generated memory map:

```bash
cd SDK/cpu/bd19/tools
# Look for memory map file or use objdump
```

### 2. Verify VM Partition Location

Add runtime check in `custom_dual_bank_ota_init()`:

```c
extern BOOT_INFO boot_info;

int custom_dual_bank_ota_init(void)
{
    // ... existing code ...
    
    /* Verify VM partition doesn't conflict */
    u32 vm_start = boot_info.vm.vm_saddr;
    u32 vm_end = vm_start + boot_info.vm.vm_size;
    
    log_info("Custom OTA: SDK VM partition: 0x%08x - 0x%08x (%d KB)\n",
             vm_start, vm_end, boot_info.vm.vm_size / 1024);
    
    /* Check for conflicts */
    if (vm_start < CUSTOM_BANK_B_ADDR + CUSTOM_BANK_SIZE) {
        log_error("Custom OTA: VM partition conflicts with custom banks!\n");
        log_error("  VM: 0x%08x - 0x%08x\n", vm_start, vm_end);
        log_error("  Banks: 0x%08x - 0x%08x\n", 
                 CUSTOM_BOOT_INFO_ADDR, 
                 CUSTOM_BANK_B_ADDR + CUSTOM_BANK_SIZE);
        return -1;
    }
    
    return 0;
}
```

### 3. Update isd_config.ini

Explicitly configure VM partition to avoid conflicts:

```ini
[RESERVED_CONFIG]
# Explicitly place VM partition after our custom banks
VM_ADR = 0x9A000;           # Start at 632KB (after Bank B)
VM_LEN = 408K;              # 408KB (rest of flash)
```

### 4. Test Flash Operations

Add test function to verify flash operations don't conflict:

```c
void test_flash_layout(void)
{
    u8 test_buf[256];
    int ret;
    
    /* Test boot info write */
    log_info("Testing boot info write at 0x%08x\n", CUSTOM_BOOT_INFO_ADDR);
    ret = norflash_write(CUSTOM_BOOT_INFO_ADDR, test_buf, 256);
    if (ret != 0) {
        log_error("Boot info write failed!\n");
    }
    
    /* Test Bank A write */
    log_info("Testing Bank A write at 0x%08x\n", CUSTOM_BANK_A_ADDR);
    ret = norflash_write(CUSTOM_BANK_A_ADDR, test_buf, 256);
    if (ret != 0) {
        log_error("Bank A write failed!\n");
    }
    
    /* Test Bank B write */
    log_info("Testing Bank B write at 0x%08x\n", CUSTOM_BANK_B_ADDR);
    ret = norflash_write(CUSTOM_BANK_B_ADDR, test_buf, 256);
    if (ret != 0) {
        log_error("Bank B write failed!\n");
    }
    
    log_info("Flash layout test complete\n");
}
```

## Alternative: Use SDK's Flash Allocation

Instead of hardcoding addresses, query SDK for available flash regions:

```c
/* Query SDK for available flash regions */
u32 get_available_flash_start(void)
{
    extern BOOT_INFO boot_info;
    
    /* Calculate end of code section */
    u32 code_end = boot_info.sfc.app_addr + /* code size */;
    
    /* Align to 4KB */
    code_end = (code_end + 0xFFF) & ~0xFFF;
    
    return code_end;
}
```

## Conclusion

**Action Required:**
1. Update `isd_config.ini` to explicitly set `VM_ADR = 0x9A000`
2. Add runtime verification in `custom_dual_bank_ota_init()`
3. Test flash operations before OTA
4. Monitor firmware size to prevent overflow

**Risk Level:** HIGH - Flash conflicts can cause data corruption or device bricking.
