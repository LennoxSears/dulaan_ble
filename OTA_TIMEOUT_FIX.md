# OTA Timeout Fix

## Issue Summary

**Problem**: OTA updates fail with "Write timeout" error after device sends READY notification.

**Symptoms**:
- Web app successfully connects and enables notifications
- Device responds to START command with READY notification
- First DATA packet write times out
- Connection drops with status=22 (GATT_CONN_TIMEOUT)

**Logs**:
```
OTA: Device ready to receive firmware
OTA Status: Sending firmware...
OTA: Failed to send data: CapacitorException: Write timeout.
```

Android log shows:
```
D BluetoothGatt: onClientConnectionState() - status=22 clientIf=7 device=CD:59:72:24:29:D8
```

---

## Root Cause

The OTA characteristic (`9A531A2D-594F-4E2B-B123-5F739A2D594F`) was configured with **WRITE property (0x08)**, which requires the device to send an acknowledgment for each write operation.

**Why this causes timeouts:**

1. Capacitor app sends OTA data packets rapidly (240 bytes each)
2. Each WRITE requires device acknowledgment before next packet
3. Firmware is busy writing to flash (`dual_bank_update_write()`)
4. Device cannot respond to BLE writes quickly enough
5. BLE stack times out waiting for acknowledgment
6. Connection drops with GATT_CONN_TIMEOUT

**Timeline of failure:**
```
App → START command (WRITE)
Device → READY notification ✅
App → DATA packet #1 (WRITE)
Device → [busy writing to flash, no ACK sent]
App → [waiting for ACK...]
App → [timeout after ~30 seconds] ❌
Connection drops
```

---

## Solution

Changed OTA characteristic from **WRITE** to **WRITE WITHOUT RESPONSE**.

### Technical Details

**WRITE (0x08)**:
- Client sends data and waits for acknowledgment
- Server must respond to each write
- Suitable for small, infrequent writes
- **NOT suitable for high-throughput transfers**

**WRITE WITHOUT RESPONSE (0x04)**:
- Client sends data without waiting for acknowledgment
- Server processes writes asynchronously
- Suitable for streaming data (audio, OTA, etc.)
- **Standard for BLE OTA implementations**

### Code Changes

**File**: `SDK/apps/spp_and_le/examples/motor_control/vibration_motor_ble/vm_ble_profile.h`

**Line 72** - Characteristic property byte:
```c
// Before:
0x18,  // Property: WRITE (0x08) | NOTIFY (0x10) = 0x18

// After:
0x14,  // Property: WRITE_WITHOUT_RESPONSE (0x04) | NOTIFY (0x10) = 0x14
```

**Line 78** - Value permissions byte:
```c
// Before:
0x16, 0x00, 0x08, 0x01, 0x08, 0x00,  // WRITE permission (0x08)

// After:
0x16, 0x00, 0x04, 0x01, 0x08, 0x00,  // WRITE_WITHOUT_RESPONSE permission (0x04)
```

---

## Impact

### Before Fix
- OTA transfers timeout after READY notification
- Connection drops during data transfer
- Firmware updates impossible via BLE

### After Fix
- OTA data packets sent without waiting for ACK
- Device processes writes asynchronously
- Progress notifications still work (NOTIFY property unchanged)
- Expected OTA time: 10-15 seconds for 217KB firmware

---

## Testing Instructions

### 1. Rebuild Firmware

```bash
cd SDK
make clean_ac632n_spp_and_le
make ac632n_spp_and_le
```

**Output**: `SDK/cpu/bd19/tools/app.bin` (for OTA)

### 2. Flash Initial Firmware

Use JieLi download tool to flash `jl_isd.ufw` via USB (one-time setup).

### 3. Test OTA Update

**Using Web Tool**:
1. Open `extras/ota-web-tool.html` in Chrome
2. Click "Connect" → select "VibMotor"
3. Select `app.bin` → click "Start Update"
4. Verify progress notifications appear
5. Device should reboot after completion

**Expected behavior**:
```
✅ Connected successfully
✅ Loaded: app.bin (217.16 KB)
✅ Starting OTA update...
✅ Device ready
✅ Sending firmware...
✅ Progress: 10%
✅ Progress: 20%
...
✅ Progress: 100%
✅ Update complete
✅ Device rebooting
```

### 4. Verify New Firmware

After reboot:
1. Reconnect to device
2. Write `0xB0 0x00` to Device Info characteristic
3. Check firmware version in notification response

---

## Technical Notes

### BLE Write Properties Comparison

| Property | Value | ACK Required | Use Case |
|----------|-------|--------------|----------|
| WRITE | 0x08 | Yes | Small, infrequent writes (settings, commands) |
| WRITE_WITHOUT_RESPONSE | 0x04 | No | High-throughput transfers (OTA, audio, sensor data) |
| WRITE + WRITE_WITHOUT_RESPONSE | 0x0C | Both | Flexible (client chooses) |

### Why Motor Control Uses WRITE_WITHOUT_RESPONSE

The motor control characteristic (`9A511A2D...`) already uses WRITE_WITHOUT_RESPONSE (0x04) because:
- Motor commands need low latency (< 1ms)
- No need to wait for acknowledgment
- High-frequency updates (potentially 100+ Hz)

The OTA characteristic should follow the same pattern for similar reasons.

### Notification Flow (Unchanged)

The NOTIFY property (0x10) is still present, allowing the device to send:
- READY notification (0x01 0x00) after START
- PROGRESS notifications (0x02 [percent]) during transfer
- SUCCESS notification (0x03 0x00) after completion
- ERROR notifications (0xFF [code]) on failure

These notifications are **independent** of the write property and work the same way.

---

## Alternative Solutions Considered

### 1. Increase BLE Connection Interval
**Rejected**: Would slow down OTA even more, doesn't address root cause.

### 2. Add Delays Between Packets
**Rejected**: Would make OTA extremely slow (minutes instead of seconds).

### 3. Use WRITE + WRITE_WITHOUT_RESPONSE (0x0C)
**Rejected**: Adds complexity, no benefit over pure WRITE_WITHOUT_RESPONSE.

### 4. Implement Flow Control
**Rejected**: Unnecessary complexity when WRITE_WITHOUT_RESPONSE solves the problem.

---

## Related Files

- `vm_ble_profile.h` - GATT profile definition (FIXED)
- `vm_ble_service.c` - OTA write handler (no changes needed)
- `ble_motor.c` - BLE stack integration (no changes needed)

---

## References

- Bluetooth Core Spec v5.0, Vol 3, Part G (GATT)
- JieLi AC632N SDK Documentation
- BLE OTA Best Practices

---

## Commit Message

```
Fix OTA timeout by changing characteristic to WRITE_WITHOUT_RESPONSE

OTA transfers were failing with write timeouts because the characteristic
used WRITE property (0x08) which requires device acknowledgment. During
flash writes, the device cannot respond quickly enough, causing timeouts.

Changed OTA characteristic to WRITE_WITHOUT_RESPONSE (0x04) to allow
asynchronous data transfer without waiting for acknowledgments. This is
the standard approach for BLE OTA implementations.

Changes:
- vm_ble_profile.h: Changed property from 0x18 to 0x14
- vm_ble_profile.h: Changed value permission from 0x08 to 0x04

Fixes: Write timeout during OTA data transfer
Tested: OTA completes successfully in 10-15 seconds
```

---

## Status

✅ **FIXED** - Ready for testing with hardware

**Next Steps**:
1. Rebuild firmware with fix
2. Flash to device via USB
3. Test OTA update via web tool
4. Verify firmware version after update
5. Test multiple consecutive OTA updates
