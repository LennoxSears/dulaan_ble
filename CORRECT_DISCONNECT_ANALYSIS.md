# Correct Disconnect Analysis

## Your Questions Answered

### 1. How Do I Know Error Arose Before First Packet?

From web logs sequence:
```
OTA: Device ready to receive firmware
OTA Status: Sending firmware...
OTA: Device disconnected  ← This event fires FIRST
OTA: Write attempt 1/3 failed: Write timeout.
```

The **"Device disconnected"** message appears **before** the write attempt error. This is a BLE disconnect event from the system, not from our write attempt.

### 2. Check the Firmware Code

You're right! Let me analyze the actual firmware:

**File**: `SDK/apps/spp_and_le/examples/motor_control/vibration_motor_ble/vm_ble_service.c`

```c
case VM_OTA_CMD_START:
    // 1. Initialize dual-bank update
    uint32_t ret = dual_bank_passive_update_init(0, ota_total_size, 240, NULL);
    if (ret != 0) {
        // Would send ERROR notification, not disconnect
        ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0x02);
        return 0x0E;
    }
    
    // 2. Check if enough space
    ret = dual_bank_update_allow_check(ota_total_size);
    if (ret != 0) {
        // Would send ERROR notification, not disconnect
        dual_bank_passive_update_exit(NULL);
        ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0x02);
        return 0x0E;
    }
    
    // 3. Send READY notification
    ota_send_notification(conn_handle, VM_OTA_STATUS_READY, 0x00);
    break;
```

**The firmware code looks correct!** It has proper error handling.

---

## The Real Issue: Connection Supervision Timeout

### Connection Parameters

From Android logs:
```
onConnectionUpdated() - interval=36 latency=0 timeout=500
```

This means:
- **Connection interval**: 36 × 1.25ms = 45ms
- **Slave latency**: 0 (no latency)
- **Supervision timeout**: 500 × 10ms = **5 seconds**

### What Supervision Timeout Means

If the device doesn't respond to **any** BLE packets for 5 seconds, the connection drops.

### Timeline Analysis

```
16:35:29 - Notifications enabled
16:35:29 - Connection parameters set (timeout=5s)
... (35 seconds pass)
16:36:04 - Connection drops (status=8)
```

**35 seconds is 7× longer than the 5-second timeout!**

This means:
- ✅ Device WAS responding for 30+ seconds
- ✅ Connection stayed alive
- ❌ Device suddenly stopped responding
- ❌ After 5 seconds of no response, connection timed out

---

## What's Really Happening

### Theory 1: Device is Busy, Not Crashed

The device might be:
1. ✅ Receives START command
2. ✅ Sends READY notification
3. ⏳ **Busy erasing flash** (takes 30+ seconds!)
4. ⏳ Still responding to BLE keep-alive packets
5. ⏳ But NOT checking for incoming DATA packets
6. ❌ Eventually stops responding (flash erase done or crashed)
7. ❌ Connection times out after 5 seconds of silence

### Theory 2: Flash Erase Blocks BLE

The `dual_bank_passive_update_init()` might:
- Erase flash sectors (slow operation)
- Block interrupts during erase
- Prevent BLE stack from responding
- Eventually cause connection timeout

### Theory 3: Watchdog or System Issue

The device might have:
- Watchdog timer that fires after 30 seconds
- System task that blocks BLE
- Memory issue that develops over time

---

## Why App Never Sends DATA Packets

Looking at the web logs more carefully:

```
OTA: Device ready to receive firmware  ← READY received
OTA Status: Sending firmware...        ← App starts sending
OTA: Device disconnected               ← Disconnect event fires
OTA: Write attempt 1/3 failed          ← First write fails
```

The app **DID try to send** DATA packets, but:
1. Device disconnected **just as** app was about to send
2. Or device disconnected **while** first packet was being sent
3. Write failed because device was already gone

---

## The Smoking Gun: 35 Seconds

**35 seconds is too long for flash erase to block BLE!**

Possible explanations:

### 1. Device is Waiting for Something

Maybe the device firmware is:
```c
// After sending READY
while (!some_condition) {
    // Waiting for something
    // Still responding to BLE keep-alive
    // But not ready for DATA packets
}
// Eventually times out or crashes
```

### 2. Race Condition

Maybe there's a race between:
- App sending DATA packets
- Device finishing flash erase
- BLE connection timing out

### 3. Flash Erase is Asynchronous

Maybe `dual_bank_passive_update_init()` returns immediately but:
- Flash erase happens in background
- Takes 30+ seconds
- Eventually fails or completes
- Device then crashes or becomes unresponsive

---

## How to Debug This

### Option 1: Add Serial Logging (Best)

Connect UART to device and add logs:

```c
case VM_OTA_CMD_START:
    log_info("OTA: START received, size=%d\n", ota_total_size);
    
    log_info("OTA: Calling dual_bank_passive_update_init...\n");
    uint32_t ret = dual_bank_passive_update_init(0, ota_total_size, 240, NULL);
    log_info("OTA: Init returned: %d\n", ret);
    
    if (ret != 0) {
        log_error("OTA: Init failed!\n");
        ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0x02);
        return 0x0E;
    }
    
    log_info("OTA: Checking space...\n");
    ret = dual_bank_update_allow_check(ota_total_size);
    log_info("OTA: Space check returned: %d\n", ret);
    
    if (ret != 0) {
        log_error("OTA: Not enough space!\n");
        dual_bank_passive_update_exit(NULL);
        ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0x02);
        return 0x0E;
    }
    
    log_info("OTA: Sending READY notification\n");
    ota_send_notification(conn_handle, VM_OTA_STATUS_READY, 0x00);
    log_info("OTA: READY sent, waiting for DATA...\n");
    break;
```

Then watch serial output to see where it hangs.

### Option 2: Send ERROR Instead of READY

Temporarily modify firmware to send ERROR instead of READY:

```c
// Test: Send ERROR instead of READY
ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0xFF);
// ota_send_notification(conn_handle, VM_OTA_STATUS_READY, 0x00);
```

If device still disconnects: Issue is in the init functions
If device stays connected: Issue is after sending READY

### Option 3: Skip Init Functions

Temporarily skip the init:

```c
case VM_OTA_CMD_START:
    // Skip init for testing
    // uint32_t ret = dual_bank_passive_update_init(...);
    // ret = dual_bank_update_allow_check(...);
    
    ota_state = OTA_STATE_RECEIVING;
    ota_send_notification(conn_handle, VM_OTA_STATUS_READY, 0x00);
    break;
```

If device stays connected: Init functions are the problem
If device still disconnects: Issue is elsewhere

---

## Possible Firmware Fixes

### Fix 1: Feed Watchdog

If watchdog is the issue:

```c
case VM_OTA_CMD_START:
    wdt_clear();  // Feed watchdog before init
    
    uint32_t ret = dual_bank_passive_update_init(0, ota_total_size, 240, NULL);
    
    wdt_clear();  // Feed watchdog after init
    
    ret = dual_bank_update_allow_check(ota_total_size);
    
    wdt_clear();  // Feed watchdog after check
    
    ota_send_notification(conn_handle, VM_OTA_STATUS_READY, 0x00);
    break;
```

### Fix 2: Increase Supervision Timeout

In `ble_motor.c`, increase timeout:

```c
static const struct conn_update_param_t motor_connection_param_table[] = {
    {16, 24, 10, 1200},  // Changed from 600 to 1200 (12 seconds)
    {12, 28, 10, 1200},
    {8,  20, 10, 1200},
};
```

### Fix 3: Send Keep-Alive During Init

If init takes long, send periodic notifications:

```c
case VM_OTA_CMD_START:
    // Start init
    uint32_t ret = dual_bank_passive_update_init(0, ota_total_size, 240, NULL);
    
    // If init is async, send periodic keep-alive
    while (init_in_progress()) {
        os_time_dly(100);  // 1 second
        // BLE stack can respond during this delay
    }
    
    ota_send_notification(conn_handle, VM_OTA_STATUS_READY, 0x00);
    break;
```

---

## Summary

### What We Know

1. ✅ Device receives START command
2. ✅ Device sends READY notification
3. ⏳ 35 seconds pass (device still connected)
4. ❌ Device suddenly stops responding
5. ❌ Connection times out after 5 seconds
6. ❌ App's first write attempt fails

### What We Don't Know

- What happens during those 35 seconds?
- Why does device stop responding?
- Is flash erase blocking?
- Is watchdog firing?
- Is there a memory issue?

### Next Steps

1. **Add serial logging** to firmware (best option)
2. **Watch serial output** during OTA
3. **See where device hangs** or crashes
4. **Fix based on findings**

### Temporary Workaround

None - this is a device firmware issue that needs debugging with serial logs.

---

## Conclusion

- ✅ Your questions were valid
- ✅ Firmware code looks correct
- ❌ But something happens during init that causes disconnect
- 🔍 Need serial logs to diagnose further

**The app is working correctly. The device firmware needs debugging with UART logs.**
