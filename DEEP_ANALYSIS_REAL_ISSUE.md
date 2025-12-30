# Deep Analysis - What's Really Happening

## BLE Supervision Timeout Explained

**BLE Supervision Timeout** = Maximum time without ANY communication before connection is considered lost.

- **Interval**: 45ms (devices exchange packets every 45ms)
- **Timeout**: 5 seconds (if no packets for 5s, disconnect)

**Key point**: Even if no data is sent, devices exchange **empty keep-alive packets** every 45ms to keep connection alive.

---

## My Timeout Change - Was It Right?

### My Logic
1. Timeout is 5 seconds
2. Device disconnects after 35 seconds
3. Therefore, device was responding for 30s, then stopped for 5s
4. Increase timeout to give device more time

### The Problem With This Logic

**If device stops responding, it stops responding to ALL BLE packets, including keep-alive.**

Once device stops responding:
- Connection will timeout in 5 seconds
- NOT 35 seconds

**So why 35 seconds?**

---

## Re-examining the Timeline

```
16:35:29.825 - setCharacteristicNotification (enable notifications)
16:35:29.831 - onConnectionUpdated (timeout=500 = 5s)
16:36:04.304 - onClientConnectionState status=8 (disconnect)

Elapsed: 34.5 seconds
```

### Critical Insight

The 35 seconds is from **notification enable** to **disconnect**.

But when was START command sent? Let me check web logs:

```
OTA: Notifications enabled
Connected successfully
Loaded: app.bin (217.16 KB)
Starting OTA update...
OTA: Sending START command, size: 222372
OTA: Device ready to receive firmware
OTA Status: Sending firmware...
OTA: Device disconnected
```

**There's no timestamp!** We don't know how long between "Notifications enabled" and "START command".

---

## Hypothesis: User Delay

### Possible Timeline

```
16:35:29 - Notifications enabled
... (user selects file, clicks button)
16:35:50 - User clicks "Start OTA" (21 seconds later)
16:35:50 - START command sent
16:35:50 - READY received
16:35:50 - App tries to send DATA
16:35:50 - First write fails immediately
16:36:04 - Connection timeout (14 seconds after START)
```

### Or: App Delay

```
16:35:29 - Notifications enabled
16:35:29 - File loaded
16:35:29 - User clicks "Start OTA"
... (app does something for 30 seconds?)
16:35:59 - START command sent
16:35:59 - READY received
16:35:59 - App tries to send DATA
16:35:59 - First write fails
16:36:04 - Connection timeout (5 seconds after failure)
```

---

## The Real Question

**Why does the first DATA write fail?**

From web logs:
```
OTA: Device ready to receive firmware
OTA Status: Sending firmware...
OTA: Device disconnected  ← Happens BEFORE write
OTA: Write attempt 1/3 failed: Write timeout.
```

### Two Possibilities

#### 1. Device Disconnects BEFORE App Sends DATA

```
Device sends READY
Device immediately crashes/disconnects
App tries to send DATA
Write fails (device already gone)
```

#### 2. App Sends DATA, Device Doesn't Respond

```
Device sends READY
App sends DATA packet
Device doesn't respond (busy/crashed)
Write times out
Connection drops
```

---

## Let Me Check: Does App Wait After READY?

Looking at the code:

```javascript
case 0x01: // READY
    console.log('OTA: Device ready to receive firmware');
    this.updateStatus('Device ready');
    this.sendDataPackets();  // ← Called immediately, NOT awaited
    break;
```

`sendDataPackets()` is async but NOT awaited. It starts immediately.

Inside `sendDataPackets()`:

```javascript
async sendDataPackets() {
    this.updateStatus('Sending firmware...');
    
    try {
        while (this.sentBytes < this.totalSize) {
            // Create packet
            const packet = ...;
            
            // Try to send with retry
            for (let attempt = 0; attempt < this.maxRetries; attempt++) {
                try {
                    await BleClient.writeWithoutResponse(...);
                    sent = true;
                    break;
                } catch (error) {
                    // Retry
                }
            }
            
            // Delay
            await this.delay(150);
        }
    } catch (error) {
        console.error('OTA: Failed to send data:', error);
    }
}
```

**No delay before first packet!** App tries to send immediately after READY.

---

## The Smoking Gun

### Web Log Sequence

```
OTA: Device ready to receive firmware
OTA Status: Sending firmware...
OTA: Device disconnected
OTA: Write attempt 1/3 failed: Write timeout.
```

**"Device disconnected" appears BEFORE "Write attempt 1/3 failed"**

This means:
1. App received READY
2. App started sending
3. **Disconnect event fired** (from BLE system)
4. Then write attempt failed

### This Tells Us

**The device disconnected BEFORE the app even attempted the first write!**

Or more precisely:
- App started write operation
- Device disconnected during the write
- Write failed because device was gone

---

## Root Cause Analysis

### What We Know

1. ✅ START command works (READY received)
2. ✅ Firmware code looks correct
3. ✅ Size validation passes (222KB < 500KB)
4. ✅ All error checks pass (got READY, not ERROR)
5. ❌ Device disconnects shortly after READY
6. ❌ First DATA write fails

### Possible Causes

#### A. Device Firmware Issue

After sending READY, device:
- Enters a bad state
- Crashes
- Watchdog fires
- Memory corruption
- BLE stack fails

#### B. Timing Issue

Device needs time after READY before accepting DATA:
- Flash erase happens AFTER READY (not during init)
- Device is busy and can't respond
- Connection times out

#### C. BLE Stack Issue

Android BLE stack:
- Has a bug
- Doesn't handle writeWithoutResponse correctly
- Disconnects for unknown reason

---

## Testing Without UART

### Test 1: Add Delay After READY

Modify app to wait 5 seconds after READY before sending DATA:

```javascript
case 0x01: // READY
    console.log('OTA: Device ready to receive firmware');
    this.updateStatus('Device ready');
    
    // Wait 5 seconds before sending DATA
    console.log('OTA: Waiting 5 seconds before sending DATA...');
    await this.delay(5000);
    
    this.sendDataPackets();
    break;
```

**If this works**: Device needs time after READY  
**If this fails**: Device crashes regardless of delay

### Test 2: Send Smaller Firmware

Try OTA with a tiny firmware (10KB instead of 217KB):

**If this works**: Size-related issue  
**If this fails**: Not size-related

### Test 3: Check Connection Before Write

Add connection check:

```javascript
async sendDataPackets() {
    // Check if still connected
    if (!this.deviceAddress) {
        throw new Error('Device disconnected before sending DATA');
    }
    
    console.log('OTA: Device still connected, sending DATA...');
    
    // Continue with sending...
}
```

This will tell us if device is already gone before we try to send.

---

## My Timeout Change - Should We Keep It?

### Pros
- Gives device more time if it's busy
- Can't hurt (worst case: longer wait on failure)
- Might help if device is slow

### Cons
- Doesn't address root cause if device crashes
- Longer timeout means longer wait on failure
- May not fix the issue at all

### Recommendation

**Keep the timeout change** because:
1. It's a reasonable safety margin
2. Won't cause harm
3. Might help in edge cases
4. But also add Test 1 (delay after READY) to app

---

## Summary

### What I Got Wrong
- Assumed 35 seconds was all from timeout
- Didn't account for user/app delays
- Didn't realize device disconnects BEFORE first write

### What's Really Happening
- Device sends READY
- Device disconnects shortly after (seconds, not 35 seconds)
- App tries to write
- Write fails (device already gone)

### Real Issue
- Device firmware problem after sending READY
- OR device needs time after READY before accepting DATA
- OR BLE stack issue

### Next Steps
1. **Keep timeout change** (can't hurt)
2. **Add delay after READY** in app (Test 1)
3. **Test with smaller firmware** (Test 2)
4. **If all fail**: Need UART logs

---

## Conclusion

**BLE Supervision Timeout change might help, but it's not addressing the root cause.**

The real issue is: **Device disconnects shortly after sending READY, before app can send DATA.**

We need to either:
- Give device time after READY (add delay in app)
- Fix device firmware (need UART to diagnose)
- Or both

**My timeout change is a good safety measure, but we should also add a delay after READY in the app.**
