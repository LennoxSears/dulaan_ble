# OTA Testing Workflow

## Important: Firmware Synchronization

The device must be running the **exact same firmware** that you're testing OTA with.

## Current Status

- **Bank Size:** 300 KB (307,200 bytes) - **BALANCED configuration**
- **Current app.bin:** ~220 KB ✓ (fits with 80 KB headroom)
- **VM/Data Space:** 419 KB (ample for settings, logs, bonding)
- **Device firmware:** Must match app.bin in dulaan_ota/
- **Growth potential:** Can grow to 300 KB (36% increase)

## Testing Steps

### 1. Verify Firmware Match
```bash
# Check app.bin size
ls -lh dulaan_ota/app.bin
# Should show: ~220K (220,000-224,000 bytes)

# Verify it fits in bank
echo "Max: $((300 * 1024)) bytes"
# Should show: 307,200 bytes (300 KB)
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
**Cause:** Firmware size exceeds bank size (300 KB)

**Solution:**
1. Check app.bin size: `stat -c %s dulaan_ota/app.bin`
2. Must be ≤ 307,200 bytes (300 KB)
3. If larger, optimize firmware or increase bank size

### Browser Cache Issue
**Symptom:** Web shows different size than actual file

**Fix:**
1. Hard refresh browser: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
2. Or clear browser cache
3. Reload the firmware file

## Flash Layout - Balanced Configuration

Current configuration balances firmware capacity with data storage:

```
0x000000 - 0x001000 (4 KB):   Bootloader
0x001000 - 0x001400 (1 KB):   Boot Info
0x001400 - 0x04C400 (300 KB): Bank A
0x04C400 - 0x097400 (300 KB): Bank B
0x097400 - 0x100000 (419 KB): VM/Data
```

**Why 300 KB?**
- **Firmware capacity:** 300 KB (307,200 bytes)
- **Current firmware:** ~220 KB
- **Headroom:** 80 KB (36% growth potential)
- **VM/Data space:** 419 KB (ample for settings, logs, BLE bonding)

**Comparison:**
- 216 KB banks: Too small (firmware doesn't fit)
- 256 KB banks: Conservative (still tight)
- **300 KB banks: BALANCED** ✓ (recommended)
- 445 KB banks: Maximum (but only 129 KB for data - risky!)

**Production-ready:** Provides sufficient firmware space while ensuring adequate data storage for long-term operation.

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
