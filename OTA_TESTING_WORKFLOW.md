# OTA Testing Workflow

## Important: Firmware Synchronization

The device must be running the **exact same firmware** that you're testing OTA with.

## Current Status

- **Bank Size:** 216 KB (221,184 bytes)
- **Current app.bin:** 219,320 bytes ✓ (fits)
- **Device firmware:** Must match app.bin in dulaan_ota/

## Testing Steps

### 1. Verify Firmware Match
```bash
# Check app.bin size
ls -lh dulaan_ota/app.bin
# Should show: 215K (219,320 bytes)

# Verify it fits in bank
echo "Max: $((216 * 1024)) bytes"
# Should show: 221,184 bytes
```

### 2. Flash Device (First Time)
```bash
# Use JLink or other flashing tool to program:
SDK/cpu/bd19/tools/app.bin

# This ensures device is running the correct firmware
```

### 3. Test OTA Update
```bash
# Open dulaan_ota web interface
# Load: dulaan_ota/app.bin (219,320 bytes)
# Start OTA update
# Device should accept the firmware size
```

## Common Issues

### Error: "Invalid START command" (0x01)
**Cause:** Firmware size exceeds bank size (216 KB)

**Solution:**
1. Check app.bin size: `stat -c %s dulaan_ota/app.bin`
2. Must be ≤ 221,184 bytes
3. If larger, use SDK/cpu/bd19/tools/app.bin instead

### Wrong app.bin in dulaan_ota/
**Symptom:** File is 222,372 bytes (too large)

**Fix:**
```bash
cp SDK/cpu/bd19/tools/app.bin dulaan_ota/app.bin
```

## Future: Increasing Bank Size

If firmware grows beyond 216 KB:

1. **Update custom_dual_bank_ota.h:**
   - Increase `CUSTOM_BANK_SIZE`
   - Update `CUSTOM_BANK_B_ADDR`
   - Update flash layout comments

2. **Rebuild firmware** with new bank size

3. **Flash device** with new firmware

4. **Then test OTA** with same firmware

**Never mix firmware versions with different bank sizes!**

## File Locations

- **Source firmware:** `SDK/cpu/bd19/tools/app.bin`
- **OTA test firmware:** `dulaan_ota/app.bin`
- **Build output:** `SDK/apps/spp_and_le/board/bd19/app.bin` (after rebuild)

## Verification Checklist

- [ ] app.bin size ≤ 221,184 bytes
- [ ] Device flashed with matching firmware
- [ ] dulaan_ota/app.bin is correct file
- [ ] Web interface loads firmware successfully
- [ ] OTA START command accepted (no 0x01 error)
