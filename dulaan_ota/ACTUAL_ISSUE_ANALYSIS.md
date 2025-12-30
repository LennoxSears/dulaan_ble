# Actual Issue Analysis

## You're Right! 

The app **IS** using the updated code (retry + adaptive delay are working).

**Evidence**:
```
OTA: Write attempt 1/3 failed  ← NEW code
OTA: Slowing down, delay now 65ms  ← NEW code
OTA: Write attempt 2/3 failed  ← NEW code
```

## The Real Problem

The issue is **NOT** old code. The issue is that **`writeWithoutResponse` is failing immediately**.

### Error Analysis

**Web log**:
```
OTA: Failed to send data: CapacitorException: Writing characteristic failed.
```

**Android log**:
```
12-30 16:05:56.811 D BluetoothGatt: onClientConnectionState() - status=8
                                                                ^^^^^^^^
                                                                Connection timeout
```

**Status 8** = `GATT_CONN_TIMEOUT` = Device disconnected or not responding

---

## Root Cause

The device is **disconnecting** or **not responding** during OTA. This could be:

### 1. Device Firmware Issue

The device might be:
- Crashing when receiving DATA packets
- Running out of memory
- Flash write taking too long
- Watchdog timer resetting device

### 2. BLE Stack Issue

The BLE stack might be:
- Dropping connection due to errors
- Not handling writeWithoutResponse correctly
- Queue overflow on device side

### 3. Connection Parameter Issue

Connection interval of 36ms might be:
- Too slow for the data rate
- Causing buffer overflow on device
- Not matching app expectations

---

## Diagnostic Steps

### Step 1: Check if START Command Works

The logs show:
```
OTA: Device ready to receive firmware ✅
```

So START command works! The device responds with READY notification.

### Step 2: Check First DATA Packet

The logs show:
```
OTA: Speeding up, delay now 45ms  ← After 20 successful packets!
OTA: Write attempt 1/3 failed  ← Then fails
```

**Wait!** This means **20 packets succeeded** before the first failure!

The adaptive delay reduced from 50ms to 45ms, which only happens after 20 consecutive successes.

So the issue is:
- First 20 packets: ✅ Success
- Packet 21: ❌ Fails
- Retries: ❌ All fail
- Device: Disconnects

---

## The Real Issue: Device Can't Keep Up

### Analysis

1. **First 20 packets succeed** (50ms delay)
2. **Delay reduces to 45ms** (speeding up)
3. **Packet 21 fails** (device overwhelmed)
4. **Device stops responding** (buffer full or crashed)
5. **Connection times out** (status=8)

### Conclusion

The **45ms delay is too fast** for your device after it has received ~20 packets (4.8KB of data).

The device's flash write or buffer is getting overwhelmed.

---

## Solutions

### Solution 1: Don't Speed Up (Recommended)

Keep delay at 50ms, don't reduce it.

**Edit `ota-controller.js` line 529**:

```javascript
// BEFORE
if (this.consecutiveSuccesses >= 20) {
    this.currentDelay = Math.max(this.minDelay, this.currentDelay - 5);
    this.consecutiveSuccesses = 0;
    console.log(`OTA: Speeding up, delay now ${this.currentDelay}ms`);
}

// AFTER - Comment out the speed-up logic
/*
if (this.consecutiveSuccesses >= 20) {
    this.currentDelay = Math.max(this.minDelay, this.currentDelay - 5);
    this.consecutiveSuccesses = 0;
    console.log(`OTA: Speeding up, delay now ${this.currentDelay}ms`);
}
*/
```

This keeps delay at 50ms throughout the entire OTA.

---

### Solution 2: Increase Minimum Delay

Don't let delay go below 50ms.

**Edit `ota-controller.js` line 64**:

```javascript
// BEFORE
this.minDelay = 30;

// AFTER
this.minDelay = 50;  // Don't go below 50ms
```

---

### Solution 3: Increase Initial Delay

Start with a slower delay.

**Edit `ota-controller.js` line 62**:

```javascript
// BEFORE
this.currentDelay = 50;

// AFTER
this.currentDelay = 80;  // Start slower
```

---

### Solution 4: Add Longer Delay After Batch

Add extra delay every N packets to let device catch up.

**Edit `ota-controller.js` after line 560**:

```javascript
this.sentBytes += chunkSize;
this.currentSequence++;

// Update progress
const progress = Math.floor((this.sentBytes / this.totalSize) * 100);
this.updateProgress(progress);

// ADD THIS: Extra delay every 50 packets
if (this.currentSequence % 50 === 0) {
    console.log(`OTA: Batch complete, letting device catch up...`);
    await this.delay(500);  // 500ms pause every 50 packets
}

// Adaptive delay
await this.delay(this.currentDelay);
```

This gives device 500ms to catch up every 50 packets (12KB).

---

## Recommended Fix

**Combine Solution 2 + Solution 4**:

1. Set `minDelay = 50` (don't speed up)
2. Add 500ms pause every 50 packets (let device catch up)

### Code Changes

**File**: `dulaan_ota/backend/client/core/ota-controller.js`

**Change 1** (line 64):
```javascript
this.minDelay = 50;  // Changed from 30
```

**Change 2** (after line 560):
```javascript
// Update progress
const progress = Math.floor((this.sentBytes / this.totalSize) * 100);
this.updateProgress(progress);

// Extra delay every 50 packets to let device catch up
if (this.currentSequence % 50 === 0) {
    console.log(`OTA: Batch ${Math.floor(this.currentSequence / 50)} complete, pausing...`);
    await this.delay(500);
}

// Adaptive delay
await this.delay(this.currentDelay);
```

---

## Expected Behavior After Fix

```
OTA: Device ready ✅
OTA: Sending firmware...
OTA: Progress: 5%
OTA: Batch 1 complete, pausing...  ← Every 50 packets
OTA: Progress: 10%
OTA: Progress: 15%
OTA: Batch 2 complete, pausing...
OTA: Progress: 20%
...
OTA: Progress: 100%
OTA: Update complete! ✅
```

**Total time**: ~60-70 seconds (slower but reliable)

---

## Why This Happens

### Device-Side Bottleneck

The JieLi AC632N device:
1. Receives BLE packet (fast)
2. Writes to flash (slow - can take 10-50ms per write)
3. If packets arrive faster than flash writes, buffer fills up
4. Device crashes or stops responding
5. Connection times out

### The Fix

By adding pauses every 50 packets:
- Device has time to finish flash writes
- Buffer doesn't overflow
- Connection stays stable
- OTA completes successfully

---

## Testing

After making the changes:

1. Rebuild app:
```bash
cd dulaan_ota/dulaan
npm run build
npx cap sync
npx cap copy android
```

2. Reinstall and test

3. Watch for:
```
✅ No "Write attempt X/3 failed" messages
✅ "Batch X complete, pausing..." messages
✅ Progress reaches 100%
✅ "Update complete!" message
```

---

## Alternative: Check Device Firmware

If the above doesn't work, the issue might be in device firmware.

**Check device logs** (if you have UART connected):
- Look for crash messages
- Check memory usage
- Verify flash write success

**Possible device issues**:
- Flash write buffer too small
- Watchdog timer too short
- Memory leak in OTA handler
- Interrupt priority issues

---

## Summary

✅ **App code is updated** (retry + adaptive delay working)  
❌ **Device can't keep up** (crashes after ~20 packets)  
✅ **Solution**: Don't speed up, add pauses every 50 packets  
✅ **Expected**: OTA completes in ~60-70 seconds  

**The issue is device-side performance, not app-side code!**
