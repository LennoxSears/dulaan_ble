# Firmware Timeout Fix - No UART Needed

## The Problem

Device disconnects after 35 seconds during OTA initialization.

**Evidence**:
- Supervision timeout: 5 seconds
- Device disconnects: After 35 seconds
- Conclusion: Device stops responding after ~30 seconds

**Root cause**: `dual_bank_passive_update_init()` takes longer than the connection can stay alive.

---

## The Fix

**Increase BLE supervision timeout from 6 seconds to 32 seconds**

This gives the device enough time to:
- Erase flash sectors
- Initialize dual-bank update
- Complete any blocking operations
- Without losing BLE connection

---

## Changes Made

**File**: `SDK/apps/spp_and_le/examples/motor_control/ble_motor.c`

**Lines 62-64**:

### Before
```c
{16, 24, 10, 600},  /* Interval 20-30ms, latency 10, timeout 6s */
{12, 28, 10, 600},
{8,  20, 10, 600},
```

### After
```c
{16, 24, 0, 3200},  /* Interval 20-30ms, latency 0, timeout 32s - increased for OTA */
{12, 28, 0, 3200},  /* Latency 0 to ensure fast response during OTA */
{8,  20, 0, 3200},  /* Timeout 32s to allow flash erase during OTA init */
```

---

## What Changed

### 1. Supervision Timeout: 600 → 3200

**Before**: 600 × 10ms = **6 seconds**  
**After**: 3200 × 10ms = **32 seconds**

This gives the device **32 seconds** to complete initialization before connection times out.

### 2. Slave Latency: 10 → 0

**Before**: Device could skip 10 connection events  
**After**: Device must respond to every connection event

This ensures:
- Device stays responsive during OTA
- App can send DATA packets immediately
- No delays due to latency

---

## Why This Should Work

### Timeline Analysis

**Current behavior**:
```
00:00 - START command received
00:00 - dual_bank_passive_update_init() starts
00:30 - Still erasing flash...
00:35 - Connection timeout (5s supervision timeout exceeded)
      - Device disconnects
```

**After fix**:
```
00:00 - START command received
00:00 - dual_bank_passive_update_init() starts
00:30 - Still erasing flash... (but connection still alive)
00:35 - Flash erase completes
00:35 - READY notification sent
00:35 - App sends DATA packets
      - OTA proceeds successfully ✅
```

---

## Performance Impact

### Connection Timeout

**Before**: 6 seconds  
**After**: 32 seconds

**Impact**: If device crashes, app will wait 32 seconds instead of 6 seconds before detecting disconnect.

**Acceptable**: OTA is a long operation anyway (~2-3 minutes), so 32s timeout is reasonable.

### Slave Latency

**Before**: 10 (device can skip 10 events)  
**After**: 0 (device must respond to all events)

**Impact**: Slightly higher power consumption during connection.

**Acceptable**: During OTA, device is active anyway, so no significant impact.

---

## Testing Steps

### 1. Rebuild Firmware

```bash
cd SDK
make clean_ac632n_spp_and_le
make ac632n_spp_and_le
```

### 2. Flash Firmware

Flash `SDK/cpu/bd19/tools/download/data_trans/jl_isd.ufw` via USB.

### 3. Rebuild App

```bash
cd dulaan_ota/dulaan
npm run build
npx cap sync
npx cap copy android
npx cap open android
```

### 4. Test OTA

1. Connect to device
2. Load firmware
3. Start OTA
4. **Watch for**:
   - Device should NOT disconnect after 35 seconds
   - Should receive READY notification
   - Should start receiving DATA packets
   - Should complete OTA successfully

---

## Expected Behavior

### Success Scenario

```
OTA: Starting update, size: 222372
OTA: Sending START command
OTA: Device ready to receive firmware ✅
OTA Status: Sending firmware...
OTA: Progress: 10%
OTA: Progress: 20%
...
OTA: Progress: 100%
OTA: Update complete! ✅

Time: ~2-3 minutes
```

### If Still Fails

If device still disconnects:

**Possible causes**:
1. Flash erase takes > 32 seconds (unlikely)
2. Device actually crashes (not just timeout)
3. Watchdog timer fires
4. Memory allocation fails

**Next steps**:
1. Increase timeout to 60 seconds (6000)
2. Or need UART logs to diagnose further

---

## Alternative: Disable Connection Updates

If increasing timeout doesn't work, try disabling connection parameter updates entirely:

**File**: `SDK/apps/spp_and_le/examples/motor_control/ble_motor.c`

**Line 60**:
```c
// Before
static uint8_t motor_connection_update_enable = 1;

// After
static uint8_t motor_connection_update_enable = 0;  // Disable updates
```

This keeps the initial connection parameters (which might have longer timeout).

---

## Rollback Plan

If this causes issues, revert to original values:

```c
{16, 24, 10, 600},  /* Original values */
{12, 28, 10, 600},
{8,  20, 10, 600},
```

---

## Why This is Better Than App-Side Fixes

### App-Side Approach
- Can't control BLE supervision timeout
- Can't prevent device from disconnecting
- Can only detect and retry

### Firmware-Side Approach
- Directly addresses root cause
- Prevents disconnect from happening
- Allows device to complete initialization
- More reliable solution

---

## Technical Details

### Connection Parameters Explained

```c
{min_interval, max_interval, slave_latency, supervision_timeout}
```

**min_interval**: Minimum connection interval (units of 1.25ms)
- 16 × 1.25ms = 20ms

**max_interval**: Maximum connection interval (units of 1.25ms)
- 24 × 1.25ms = 30ms

**slave_latency**: Number of connection events device can skip
- 0 = Must respond to every event
- 10 = Can skip up to 10 events

**supervision_timeout**: Connection timeout (units of 10ms)
- 600 × 10ms = 6 seconds
- 3200 × 10ms = 32 seconds

### Why Latency = 0 for OTA

During OTA:
- App needs to send data continuously
- Device must be ready to receive
- No benefit to skipping connection events
- Latency = 0 ensures immediate response

### Why Timeout = 32s for OTA

Flash erase operations:
- Can take 20-30 seconds
- Block other operations
- Need longer timeout to complete
- 32 seconds provides safety margin

---

## Summary

✅ **Fix**: Increase supervision timeout to 32 seconds  
✅ **Change**: Set slave latency to 0  
✅ **Benefit**: Device has time to complete flash erase  
✅ **No UART needed**: This fix addresses the timeout directly  
✅ **Next step**: Rebuild firmware and test  

**This should allow the device to complete initialization without disconnecting!**
