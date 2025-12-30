# Device Disconnect Issue - Critical

## The Problem

Device **disconnects immediately after sending READY notification**, before receiving any DATA packets.

## Evidence from Logs

### Web Logs
```
OTA: Device ready to receive firmware ✅
OTA Status: Sending firmware...
OTA: Device disconnected ❌  ← Happens BEFORE first DATA packet
OTA: Write attempt 1/3 failed: Write timeout.
OTA: Write attempt 2/3 failed: deviceId required.  ← Device already gone
```

### Android Logs
```
16:35:29.825 - setCharacteristicNotification (notifications enabled)
16:35:29.831 - onConnectionUpdated (connection stable)
... (35 seconds pass)
16:36:04.304 - onClientConnectionState() - status=8 (TIMEOUT)
```

### Timeline
```
16:35:29 - Connected ✅
16:35:29 - Notifications enabled ✅
16:35:29 - START command sent ✅
16:35:29 - READY notification received ✅
... (35 seconds of nothing)
16:36:04 - Device disconnected ❌
```

## Analysis

**35 seconds** passed between READY notification and disconnect. This is **NOT** a delay issue!

The device:
1. ✅ Received START command
2. ✅ Sent READY notification
3. ❌ Then crashed/reset/disconnected
4. ❌ Never received any DATA packets

## Root Cause

This is a **device firmware issue**, not an app issue!

Possible causes:

### 1. Device Crashed After START Command

The device firmware might be crashing when:
- Erasing flash for OTA
- Allocating memory for OTA buffer
- Initializing dual-bank update
- Watchdog timer expired

### 2. Flash Erase Failed

The START command triggers flash erase:
```c
// In device firmware
case VM_OTA_CMD_START:
    dual_bank_passive_update_init(NULL);  // ← Might fail/crash here
    ota_send_notification(READY);
    // Device crashes after this
```

### 3. Memory Allocation Failed

Device might run out of memory:
```c
// Allocate OTA buffer
buffer = malloc(OTA_BUFFER_SIZE);  // ← Might fail
if (!buffer) {
    // Device crashes instead of handling error
}
```

### 4. Watchdog Timer

Device watchdog might be resetting:
- Flash erase takes too long
- Watchdog not fed during erase
- Device resets after 30-35 seconds

## Why Retry Shows Different Errors

```
Attempt 1: Write timeout  ← Device just disconnected
Attempt 2: deviceId required  ← Device ID cleared after disconnect
Attempt 3: deviceId required  ← Still no device
```

The retry logic is working correctly, but it's trying to write to a device that's already gone.

## This Explains Everything

All previous issues make sense now:

1. **Why 50ms worked for 20 packets**: Because device never got past START command!
2. **Why 45ms failed**: Device disconnected, not delay issue!
3. **Why 150ms still fails**: Device disconnects regardless of delay!

The delay was **never the issue**. The device firmware is crashing!

## How to Confirm

### Check Device Serial Logs

If you have UART connected to device:

```
Expected logs:
[OTA] Received START command
[OTA] Erasing flash...
[OTA] Flash erase complete
[OTA] Sent READY notification
[OTA] Waiting for DATA...

Actual logs (probably):
[OTA] Received START command
[OTA] Erasing flash...
[CRASH] Watchdog reset!
or
[ERROR] Flash erase failed!
or
[ERROR] Out of memory!
```

### Test Without OTA

Try connecting and just sending motor commands (not OTA):
- If connection stays stable: OTA firmware is the issue
- If connection still drops: BLE stack issue

## Possible Fixes

### Fix 1: Check Device Firmware Logs

Connect UART and see what's happening:
```bash
# Connect to device UART (1Mbps, PB7)
screen /dev/ttyUSB0 1000000
```

Look for:
- Crash messages
- Memory errors
- Flash errors
- Watchdog resets

### Fix 2: Increase Watchdog Timeout

In device firmware, increase watchdog timeout:
```c
// Before OTA
wdt_set_timeout(60000);  // 60 seconds instead of 30
```

### Fix 3: Feed Watchdog During Flash Erase

```c
// In dual_bank_passive_update_init()
while (erasing_flash) {
    wdt_clear();  // Feed watchdog
    erase_next_sector();
}
```

### Fix 4: Check Memory Allocation

```c
// Add error handling
void *buffer = malloc(OTA_BUFFER_SIZE);
if (!buffer) {
    log_error("OTA: Out of memory!\n");
    ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0xFF);
    return;
}
```

### Fix 5: Check Flash Erase

```c
// Add error checking
int ret = dual_bank_passive_update_init(NULL);
if (ret != 0) {
    log_error("OTA: Flash init failed: %d\n", ret);
    ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0xFF);
    return;
}
```

## Testing Without Device Logs

### Test 1: Immediate DATA Packet

Try sending DATA packet immediately after READY (no delay):
- If device still disconnects: Confirms it's crashing after START
- If device receives DATA: Delay was the issue (unlikely)

### Test 2: Send START Multiple Times

Try sending START command multiple times:
- If device crashes every time: START command is the issue
- If device sometimes works: Timing/race condition

### Test 3: Smaller Firmware

Try OTA with a tiny firmware (1KB):
- If works: Flash erase size issue
- If fails: Not size-related

## App-Side Workaround

Since we can't fix device firmware easily, add better error handling:

```javascript
// Detect disconnect before sending DATA
if (!this.isConnected) {
    throw new Error('Device disconnected after START command. Device firmware may have crashed.');
}

// Add connection monitoring
this.connectionMonitor = setInterval(() => {
    if (!this.isConnected) {
        console.error('Device disconnected during OTA!');
        this.stopOTA();
    }
}, 1000);
```

## Conclusion

**The 150ms delay is NOT the issue!**

The device is **crashing/resetting after receiving START command**, before any DATA packets are sent.

This is a **device firmware bug**, not an app bug.

## Next Steps

1. **Connect UART** to device and check logs
2. **Look for crash messages** after START command
3. **Check watchdog timer** settings
4. **Check flash erase** implementation
5. **Check memory allocation** in OTA handler
6. **Fix device firmware** based on findings

## Temporary Solution

If device firmware can't be fixed immediately:

1. **Add connection monitoring** in app
2. **Detect disconnect** before sending DATA
3. **Show clear error** to user: "Device firmware crashed during OTA preparation"
4. **Don't retry** - it won't help

## Summary

❌ **Not a delay issue** - Device disconnects regardless of delay  
❌ **Not an app issue** - App is working correctly  
✅ **Device firmware issue** - Device crashes after START command  
✅ **Need device logs** - Connect UART to diagnose  
✅ **Fix device firmware** - Check watchdog, flash erase, memory  

**The app code is correct. The device firmware needs to be fixed.**
