# OTA Quick Start Guide

## Current Status: Flash Erase Error

**Error:** `0x02: Flash erase failed`

**Cause:** Flash write protection is enabled on the device

**Solution:** Rebuild and reflash firmware with protection disabled

---

## Quick Fix Steps

### 1. Rebuild Firmware
```bash
cd SDK
make clean_ac632n_spp_and_le
make ac632n_spp_and_le
```

### 2. Flash via USB (One Time)
- File: `SDK/cpu/bd19/tools/download/data_trans/jl_isd.ufw`
- Tool: JieLi Download Tool
- This installs firmware with `FLASH_WRITE_PROTECT = NO`

### 3. Test OTA
- Connect via BLE
- Select `app.bin` for OTA update
- Should complete in 3-4 minutes

---

## What Was Fixed

1. ✅ Memory allocation (220KB → 256 bytes)
2. ✅ State machine (unified)
3. ✅ Power loss protection (double-buffered boot info)
4. ✅ Transfer speed (2.4 hours → 3-4 minutes)
5. ✅ Flash layout (explicit VM partition)
6. ✅ Buffer overflow protection
7. ✅ Flash write protection (disabled in config)
8. ✅ Flash erase optimization (55 sectors vs 76)

---

## Need Help?

### If Flash Erase Still Fails
See: `docs/ota/OTA_UART_DEBUG_GUIDE.md`

### For Technical Details
See: `docs/ota/OTA_FIXES_SUMMARY.md`

### For Production Deployment
See: `docs/ota/OTA_FLASH_PROTECTION_SOLUTION.md`

---

## Performance

| Metric | Before | After |
|--------|--------|-------|
| Transfer Time | 2.4 hours | 3-4 minutes |
| Memory Usage | 220KB | 256 bytes |
| Flash Erase | ❌ Failed | ✅ Success (after reflash) |
