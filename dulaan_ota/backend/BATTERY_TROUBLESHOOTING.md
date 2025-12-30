# Battery Info Not Working - Troubleshooting

## Symptom: "[DEVICE INFO] 📥 Received:" never appears

This means the device is NOT sending notification responses.

## What You Should See

### ✅ Working (Notifications)
```
[DEVICE INFO] 🔔 Starting notifications...
[DEVICE INFO] ✅ Notifications enabled successfully
[DEVICE INFO] 📤 Sending query: {...}
[DEVICE INFO] ✅ Query sent successfully
[DEVICE INFO] 🔔 Notification callback triggered!  ← This is key!
[DEVICE INFO] 📨 Notification received
[DEVICE INFO] 📥 Received: {battery: 85, ...}
```

### ⚠️ Fallback (Read Method)
```
[DEVICE INFO] 🔔 Starting notifications...
[DEVICE INFO] ❌ Failed to start notifications
[DEVICE INFO] 💡 This is OK - will use READ fallback
[DEVICE INFO] 📤 Sending query: {...}
[DEVICE INFO] ✅ Query sent successfully
[DEVICE INFO] ⚠️ No notification received, trying READ fallback...
[DEVICE INFO] 📖 Attempting to READ characteristic...
[DEVICE INFO] 📖 READ result: {...}
[DEVICE INFO] 📥 Received: {battery: 85, ...}
```

### ❌ Not Working
```
[DEVICE INFO] 🔔 Starting notifications...
[DEVICE INFO] ✅ Notifications enabled successfully
[DEVICE INFO] 📤 Sending query: {...}
[DEVICE INFO] ✅ Query sent successfully
[DEVICE INFO] ⚠️ No notification received, trying READ fallback...
[DEVICE INFO] 📖 Attempting to READ characteristic...
[DEVICE INFO] ❌ READ fallback failed: [error]
```

## Possible Causes

### 1. Device Firmware Not Implemented Yet
**Check:** Is the device firmware actually responding to `[0xB0, 0x00]` queries?

**Device firmware should:**
```c
void device_info_write_callback(uint8_t *data, uint16_t len) {
    if (len == 2 && data[0] == 0xB0 && data[1] == 0x00) {
        // Build response
        uint8_t response[6] = {
            0xB0,                    // header
            0x00,                    // cmd
            0x01,                    // motor_count
            FIRMWARE_VERSION_LOW,    // fw_version_low
            FIRMWARE_VERSION_HIGH,   // fw_version_high
            get_battery_level()      // battery (0-100)
        };
        
        // Send notification
        send_notification(response, 6);
    }
}
```

### 2. Characteristic Not Configured for Notify
**Check:** Device GATT configuration

The characteristic `9A521A2D-594F-4E2B-B123-5F739A2D594F` must have:
- **Properties**: Write + Notify (or Write + Read)
- **Permissions**: Encryption required

### 3. Wrong Characteristic UUID
**Check:** Are you using the correct UUID?

```javascript
// Should be:
DEVICE_INFO_CHAR_UUID = "9A521A2D-594F-4E2B-B123-5F739A2D594F"

// NOT the motor control UUID:
MOTOR_CONTROL_CHAR_UUID = "9A511A2D-594F-4E2B-B123-5F739A2D594F"
```

### 4. Device Needs Pairing First
**Check:** Is the device paired/bonded?

Some devices require pairing before they respond to queries.

## Debug Steps

### Step 1: Check Console Logs
```javascript
// After connecting, check what logs appear
await window.dulaan.motor.connect();

// Wait 2 seconds, then check
setTimeout(() => {
    console.log('Device info:', window.dulaan.motor.deviceInfo);
}, 2000);
```

### Step 2: Manually Trigger Query
```javascript
// Try manual query
await window.dulaan.motor.queryDeviceInfo();

// Watch console for:
// - Query sent ✅
// - Notification callback triggered? (if yes, notifications work)
// - READ fallback? (if yes, notifications don't work but read does)
// - Both failed? (device not responding)
```

### Step 3: Check BLE Characteristic Properties
```javascript
// In browser console, check what properties the characteristic has
// (This requires BLE Web API access)

const device = await navigator.bluetooth.requestDevice({
    filters: [{ name: 'VibMotor(BLE)' }],
    optionalServices: ['9a501a2d-594f-4e2b-b123-5f739a2d594f']
});

const server = await device.gatt.connect();
const service = await server.getPrimaryService('9a501a2d-594f-4e2b-b123-5f739a2d594f');
const char = await service.getCharacteristic('9a521a2d-594f-4e2b-b123-5f739a2d594f');

console.log('Properties:', char.properties);
// Should show: { write: true, notify: true } or { write: true, read: true }
```

### Step 4: Test with nRF Connect App
Use nRF Connect mobile app to test the device:

1. Connect to device
2. Find service `9A501A2D-594F-4E2B-B123-5F739A2D594F`
3. Find characteristic `9A521A2D-594F-4E2B-B123-5F739A2D594F`
4. Enable notifications (if available)
5. Write `[0xB0, 0x00]`
6. Check if notification arrives with 6 bytes

## Solutions

### Solution 1: Device Firmware Not Ready
**Wait for firmware update** that implements the device info query response.

**Temporary workaround:** Use mock data
```javascript
// Set mock data for testing
window.dulaan.motor.deviceInfo = {
    battery: 85,
    batteryLevel: 85,
    firmware: "1.0",
    firmwareVersion: "1.0",
    motorCount: 1,
    lastUpdated: new Date().toISOString(),
    isReady: true
};
```

### Solution 2: Use Read Instead of Notify
If device supports READ but not NOTIFY, the fallback will work automatically.

### Solution 3: Disable Battery Queries
If you don't need battery info yet:
```javascript
// Stop periodic queries
window.dulaan.motor.stopPeriodicBatteryQuery();
```

## Expected Timeline

```
0ms:    connect() called
100ms:  Connection established
150ms:  startDeviceInfoNotifications() called
200ms:  Notifications enabled (or failed)
250ms:  startPeriodicBatteryQuery() called
300ms:  First queryDeviceInfo() sent [0xB0, 0x00]
350ms:  Device should respond via notification
400ms:  handleDeviceInfoNotification() called
        deviceInfo.isReady = true ✅

OR (if notification fails):

1000ms: READ fallback triggered
1100ms: BleClient.read() called
1200ms: Device responds with 6 bytes
1250ms: handleDeviceInfoNotification() called
        deviceInfo.isReady = true ✅
```

## Next Steps

1. **Check console logs** - What do you see?
2. **Test with nRF Connect** - Does device respond?
3. **Check device firmware** - Is query handler implemented?
4. **Use mock data** - For UI development while waiting for firmware

---

**Most Likely Cause**: Device firmware doesn't implement the device info query response yet. Check with firmware team!
