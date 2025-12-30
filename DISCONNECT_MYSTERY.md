# Disconnect Mystery - Need Clarification

## The Contradiction

### Test 1: No DATA Packets (Worked)
**Code:**
```javascript
// After READY notification
console.log('Not sending DATA packets, waiting 30 seconds...');
await this.delay(30000);
// Device stayed connected ✅
```

**Result:** Device stayed connected for 30+ seconds

---

### Current Test: Trying to Send Packets (Failed)
**Code:**
```javascript
// After READY notification
console.log('Sending 927 packets with 2000ms delay...');
while (this.sentBytes < this.totalSize) {
    // Build packet
    // Try to send
}
// Device disconnected after 25 seconds ❌
```

**Result:** Device disconnected after ~25 seconds, BEFORE first packet sent

---

## The Question

**Why does the device behave differently?**

In both cases:
- ✅ Same START command sent
- ✅ Same READY notification received
- ✅ Same firmware state (OTA_STATE_RECEIVING)
- ✅ Same app waiting (not sending DATA yet)

**But:**
- Test 1: Device stays connected
- Current: Device disconnects

---

## Possible Explanations

### 1. Different Firmware
**Question:** Is the firmware the same between Test 1 and Current test?
- If different: Firmware might have different timeout behavior
- If same: Rules out firmware difference

### 2. Timing Coincidence
**Question:** Did the device just happen to crash at that moment?
- Try the test multiple times
- See if it always disconnects at ~25 seconds

### 3. Hidden State
**Question:** Does the firmware have internal state that differs?
- Maybe firmware tracks "attempted writes"?
- Maybe BLE stack has different state?

### 4. App Behavior Difference
**Question:** Does the app do something different that triggers firmware behavior?
- Test 1: Just waits (no BLE activity)
- Current: Enters loop, builds packets (still no BLE writes)

---

## What We Need to Know

1. **Same firmware?**
   - Is this the exact same firmware as Test 1?
   - Or was firmware rebuilt/reflashed?

2. **Reproducible?**
   - Does it always disconnect at ~25 seconds?
   - Or is it random?

3. **BLE activity?**
   - In Test 1, was there any BLE activity during the 30-second wait?
   - In Current test, is there any BLE activity before disconnect?

4. **Firmware logs?**
   - Can we get UART logs to see what firmware is doing?
   - This would show if firmware has a timeout or crashes

---

## My Current Theory (Needs Verification)

**Theory:** The firmware has a timeout that starts when:
1. `dual_bank_passive_update_init()` is called
2. READY is sent
3. Firmware waits for first DATA packet
4. If no DATA packet within ~25 seconds → timeout/disconnect

**But this doesn't explain Test 1!**

In Test 1, we also didn't send DATA packets for 30 seconds, but device stayed connected.

**Unless...**

Maybe in Test 1, the firmware wasn't actually in OTA mode? Maybe something was different?

---

## Next Steps

1. **Verify firmware version** - Same as Test 1?
2. **Repeat Test 1** - Does it still work?
3. **Get UART logs** - See what firmware is doing
4. **Try sending first packet immediately** - Does it help?

---

## Current Status

**Latest change:** Modified app to send first packet immediately (no delay)

**Hypothesis:** Device expects first DATA packet quickly after READY

**Need to test:** Does sending first packet immediately prevent disconnect?

**But still unclear:** Why did Test 1 work without sending any packets?
