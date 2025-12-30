# BLE Write vs Notifications - Explained

## The Two-Way Communication

### 1. BleClient.write() - Phone → Device
**Purpose**: Send commands/queries TO the device

```javascript
// Send query request [0xB0, 0x00]
await BleClient.write(
    deviceAddress,
    serviceUUID,
    characteristicUUID,
    dataView  // Contains [0xB0, 0x00]
);
```

**What happens:**
- Phone sends 2 bytes to device
- Device receives the query
- **No return value** - write() just confirms the send was successful
- Device will respond via notification (separate channel)

### 2. BleClient.startNotifications() - Device → Phone
**Purpose**: Listen for data FROM the device

```javascript
// Set up listener for responses
await BleClient.startNotifications(
    deviceAddress,
    serviceUUID,
    characteristicUUID,
    (data) => {
        // This callback fires when device sends data
        console.log('Received:', data);
    }
);
```

**What happens:**
- Phone subscribes to notifications
- When device has data, it sends a notification
- **Callback fires** with the data
- This is asynchronous - can happen anytime

## The Flow for Battery Info

```
Step 1: Enable Notifications (once, on connection)
┌─────────────────────────────────────────────┐
│ BleClient.startNotifications(               │
│     deviceAddress,                          │
│     serviceUUID,                            │
│     deviceInfoCharUUID,                     │
│     (data) => handleNotification(data)      │ ← Callback registered
│ )                                           │
└─────────────────────────────────────────────┘

Step 2: Send Query (every 30 seconds)
┌─────────────────────────────────────────────┐
│ BleClient.write(                            │
│     deviceAddress,                          │
│     serviceUUID,                            │
│     deviceInfoCharUUID,                     │
│     [0xB0, 0x00]                            │ ← Query packet
│ )                                           │
└─────────────────────────────────────────────┘
         │
         │ Phone → Device: "Give me battery info"
         ↓
    [Device processes]
         │
         │ Device → Phone: [0xB0, 0x00, 1, 2, 1, 85]
         ↓
┌─────────────────────────────────────────────┐
│ Notification callback fires!                │
│ handleNotification(data) {                  │
│     // Parse 6 bytes                        │
│     // Update deviceInfo                    │
│     // Trigger user callback                │
│ }                                           │
└─────────────────────────────────────────────┘
```

## Why Two Separate Calls?

**Notifications must be enabled BEFORE sending queries**

```javascript
// ❌ WRONG - Query before notifications enabled
await queryDeviceInfo();              // Sends query
await startDeviceInfoNotifications(); // Too late! Response already lost

// ✅ CORRECT - Enable notifications first
await startDeviceInfoNotifications(); // Ready to receive
await queryDeviceInfo();              // Send query, response will be caught
```

## Current Implementation

```javascript
async connect() {
    // ... connection code ...
    
    // 1. Enable notifications (sets up listener)
    await this.startDeviceInfoNotifications();
    
    // 2. Start periodic queries (sends first query immediately)
    this.startPeriodicBatteryQuery();
    //   ↓ This calls queryDeviceInfo() which sends [0xB0, 0x00]
    //   ↓ Device responds via notification
    //   ↓ handleDeviceInfoNotification() is called
    //   ↓ deviceInfo is updated
}
```

## Debug Logging

With the new debug logs, you'll see:

```
[DEVICE INFO] 🔔 Starting notifications...
[DEVICE INFO] ✅ Notifications enabled successfully
[DEVICE INFO] 🔄 Periodic query started (interval: 30000ms)
[DEVICE INFO] 📤 Sending query: {deviceAddress: "...", ...}
[DEVICE INFO] ✅ Query sent successfully, waiting for notification...
[DEVICE INFO] 🔔 Notification callback triggered!
[DEVICE INFO] 📨 Notification received, data: DataView {...}
[DEVICE INFO] 📊 Parsed bytes: [176, 0, 1, 2, 1, 85]
[DEVICE INFO] 🔍 Parsed values: {motorCount: 1, fwVersionLow: 2, ...}
[DEVICE INFO] 📥 Received: {motorCount: 1, firmwareVersion: "1.2", ...}
```

## Troubleshooting

### If you see query sent but no notification:

**Check 1: Are notifications enabled?**
```javascript
// Should see this BEFORE any queries
[DEVICE INFO] ✅ Notifications enabled successfully
```

**Check 2: Is device responding?**
- Device might not support the characteristic
- Device might need pairing first
- Check device firmware logs

**Check 3: Is callback being called?**
```javascript
// Should see this when device responds
[DEVICE INFO] 🔔 Notification callback triggered!
```

**Check 4: Data format issues?**
```javascript
// Should see parsed bytes
[DEVICE INFO] 📊 Parsed bytes: [176, 0, 1, 2, 1, 85]
```

### Common Issues

**Issue 1: "Notification callback never fires"**
- Notifications not enabled before query
- Device not responding
- Wrong characteristic UUID

**Issue 2: "Invalid response length"**
- Device sending wrong format
- Check device firmware implementation

**Issue 3: "Invalid header/command"**
- Device not following protocol
- Check bytes received: should start with [0xB0, 0x00]

## Testing in Console

```javascript
// 1. Check if notifications are enabled
// (Should happen automatically on connect)

// 2. Manually trigger query
await window.dulaan.motor.queryDeviceInfo();

// 3. Watch console for logs:
// - Query sent
// - Notification callback triggered
// - Data parsed
// - deviceInfo updated

// 4. Check result
console.log(window.dulaan.motor.deviceInfo);
```

## Summary

- **write()** = Send data TO device (query request)
- **startNotifications()** = Listen for data FROM device (query response)
- **Must enable notifications BEFORE sending queries**
- **Response comes via callback, not return value**
- **Check console logs to debug the flow**

---

**Key Point**: `write()` doesn't return the battery info. It just sends the query. The response comes later via the notification callback!
