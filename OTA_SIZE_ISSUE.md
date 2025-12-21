# OTA Size Issue - 217KB Firmware Too Large

## Problem

**Error**: `0x02: Firmware size too large`  
**Firmware size**: 217KB (222,898 bytes)  
**VM configured**: 240KB

## Root Cause

The JieLi SDK uses **dual-bank OTA** which requires **2x the firmware size**:
- Bank A: Current running firmware (~230KB)
- Bank B: New firmware being written (~217KB)
- **Total needed**: ~450KB

**Available space**:
```
Flash: 512KB total
├─ Code: 236KB (current firmware)
├─ VM: 240KB (configured)
├─ BTIF: 4KB
└─ Free: 32KB
```

**Problem**: Dual-bank needs ~450KB but we only have 240KB VM + 32KB free = 272KB available.

## Why Firmware is So Large

The current firmware includes:
- BLE stack (~80KB)
- Motor control
- Custom OTA handler
- Device info service
- Battery monitoring
- Debug logging

## Solutions

### Option 1: Reduce Firmware Size (Recommended)

**Target**: Get firmware under 120KB so dual-bank needs only 240KB.

**How to reduce**:

1. **Disable debug logging** (saves ~10-20KB):
   ```c
   // In vm_ble_service.c, change:
   #define log_info(fmt, ...)  // Empty
   #define log_error(fmt, ...) // Empty
   ```

2. **Remove unused BLE services** (saves ~20-30KB):
   - Check if RCSP is still compiled in
   - Remove unused characteristics

3. **Optimize build flags**:
   ```bash
   # In SDK Makefile, add:
   -Os  # Optimize for size
   -flto # Link-time optimization
   ```

4. **Remove unused SDK features**:
   - Check `board_ac632n_demo_global_build_cfg.h`
   - Disable unused features (SPP, HID, etc.)

### Option 2: Use External Flash (Hardware Change)

Add external SPI flash chip for OTA storage:
- Cost: ~$0.50 per unit
- Requires PCB modification
- SDK supports external flash OTA

### Option 3: Use UART/USB OTA (Factory Only)

For factory programming, use wired OTA:
- No size limit
- Faster than BLE
- Requires physical connection

### Option 4: Accept Limitation

If firmware must be >120KB:
- Use wired OTA for updates
- Or upgrade to chip with larger flash (AC6328A has 1MB)

## Immediate Workaround

**For testing**, temporarily reduce firmware size:

1. **Disable all logging**:
   ```c
   // In vm_ble_service.c
   #define log_info(fmt, ...)
   #define log_error(fmt, ...)
   ```

2. **Remove device info service** (if not needed):
   - Comment out device info characteristic in `vm_ble_profile.h`
   - Remove handler in `vm_ble_service.c`

3. **Rebuild and check size**:
   ```bash
   cd SDK
   make clean_ac632n_spp_and_le
   make ac632n_spp_and_le
   ls -lh cpu/bd19/tools/app.bin
   ```

**Target**: Get app.bin under 120KB (123,000 bytes)

## Recommended Action

1. **Check what's using space**:
   ```bash
   cd SDK/cpu/bd19/tools
   # Check map file for largest symbols
   grep -E "^\s+0x[0-9a-f]+" sdk.map | sort -k2 -n | tail -20
   ```

2. **Disable unused features** in `board_ac632n_demo_global_build_cfg.h`:
   - Look for `#define CONFIG_*` options
   - Disable anything not needed

3. **Rebuild and test**

## Long-term Solution

If you need large firmware (>120KB) with BLE OTA:
- **Upgrade to AC6328A chip** (1MB flash, pin-compatible)
- Cost: ~$0.20 more per unit
- Supports up to 500KB firmware with dual-bank OTA

## Technical Details

**Dual-bank OTA process**:
1. Device boots from Bank A (current firmware)
2. New firmware written to Bank B via BLE
3. After verification, bootloader switches to Bank B
4. Next update writes to Bank A

**Space requirement**:
```
Bank A: max_firmware_size
Bank B: max_firmware_size
Total: 2 × max_firmware_size
```

With 512KB flash and 236KB code, maximum firmware size for dual-bank OTA is:
```
(512KB - 236KB - 4KB BTIF) / 2 = 136KB per bank
```

Your 217KB firmware exceeds this limit.

## Summary

**Current situation**: 217KB firmware cannot use BLE OTA with 512KB flash chip.

**Quick fix**: Reduce firmware to <120KB by removing debug logs and unused features.

**Proper fix**: Upgrade to 1MB flash chip (AC6328A) for $0.20 more per unit.
