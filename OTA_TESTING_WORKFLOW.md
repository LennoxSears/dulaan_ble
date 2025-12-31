# OTA Testing Workflow

## Important: Firmware Synchronization

The device must be running the **exact same firmware** that you're testing OTA with.

## Current Status

- **Bank Size:** 445 KB (455,680 bytes) - **MAXIMIZED for 1MB flash**
- **Current app.bin:** ~220 KB ✓ (fits with 225 KB headroom)
- **Device firmware:** Must match app.bin in dulaan_ota/
- **Future-proof:** Can grow to 445 KB (2x current size)

## Testing Steps

### 1. Verify Firmware Match
```bash
# Check app.bin size
ls -lh dulaan_ota/app.bin
# Should show: ~220K (220,000-224,000 bytes)

# Verify it fits in bank
echo "Max: $((445 * 1024)) bytes"
# Should show: 455,680 bytes (445 KB)
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
**Cause:** Firmware size exceeds bank size (445 KB)

**Solution:**
1. Check app.bin size: `stat -c %s dulaan_ota/app.bin`
2. Must be ≤ 455,680 bytes (445 KB)
3. If larger, firmware is too big for 1MB flash (unlikely!)

### Browser Cache Issue
**Symptom:** Web shows different size than actual file

**Fix:**
1. Hard refresh browser: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
2. Or clear browser cache
3. Reload the firmware file

## Flash Layout - Maximized for 1MB

Current configuration uses **maximum safe bank size**:

```
0x000000 - 0x001000 (4 KB):   Bootloader
0x001000 - 0x001400 (1 KB):   Boot Info
0x001400 - 0x06F800 (445 KB): Bank A (max firmware)
0x06F800 - 0x0DDC00 (445 KB): Bank B (max firmware)
0x0DDC00 - 0x100000 (129 KB): VM/Data (minimum required)
```

**Benefits:**
- Maximum firmware capacity: 445 KB (455,680 bytes)
- Current firmware: ~220 KB
- **Headroom: 225 KB** (can more than double in size)
- Future-proof for feature additions

**Note:** Bank size cannot be increased further without reducing VM/Data below minimum requirements.

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
