# Capacitor App Fix Required

## Issue Confirmed

✅ **Device firmware is correct** - LightBlue shows WRITE_WITHOUT_RESPONSE property  
❌ **App code is wrong** - Using `write()` instead of `writeWithoutResponse()`

---

## The Problem

Your Capacitor app is calling:
```typescript
BleClient.write(deviceId, serviceUuid, otaCharUuid, data)
```

But the OTA characteristic only supports:
```typescript
BleClient.writeWithoutResponse(deviceId, serviceUuid, otaCharUuid, data)
```

**Result**: "Writing characteristic failed" because property mismatch.

---

## The Fix

### Change in Your Source Code

Find your OTA implementation (probably in `src/services/` or similar) and change:

```typescript
// ❌ WRONG - Don't use this for OTA
await BleClient.write(
  deviceId,
  '9a501a2d-594f-4e2b-b123-5f739a2d594f',
  '9a531a2d-594f-4e2b-b123-5f739a2d594f',
  command
);

// ✅ CORRECT - Use this for OTA
await BleClient.writeWithoutResponse(
  deviceId,
  '9a501a2d-594f-4e2b-b123-5f739a2d594f',
  '9a531a2d-594f-4e2b-b123-5f739a2d594f',
  command
);
```

---

## All Three OTA Commands Need This Fix

### 1. START Command

```typescript
async function sendStartCommand(deviceId: string, size: number) {
  const cmd = new Uint8Array(5);
  cmd[0] = 0x01;  // START
  cmd[1] = size & 0xFF;
  cmd[2] = (size >> 8) & 0xFF;
  cmd[3] = (size >> 16) & 0xFF;
  cmd[4] = (size >> 24) & 0xFF;
  
  // ✅ Use writeWithoutResponse
  await BleClient.writeWithoutResponse(
    deviceId,
    '9a501a2d-594f-4e2b-b123-5f739a2d594f',
    '9a531a2d-594f-4e2b-b123-5f739a2d594f',
    cmd
  );
}
```

### 2. DATA Command

```typescript
async function sendDataPacket(deviceId: string, seq: number, data: Uint8Array) {
  const cmd = new Uint8Array(3 + data.length);
  cmd[0] = 0x02;  // DATA
  cmd[1] = seq & 0xFF;
  cmd[2] = (seq >> 8) & 0xFF;
  cmd.set(data, 3);
  
  // ✅ Use writeWithoutResponse
  await BleClient.writeWithoutResponse(
    deviceId,
    '9a501a2d-594f-4e2b-b123-5f739a2d594f',
    '9a531a2d-594f-4e2b-b123-5f739a2d594f',
    cmd
  );
}
```

### 3. FINISH Command

```typescript
async function sendFinishCommand(deviceId: string, crc: number) {
  const cmd = new Uint8Array(5);
  cmd[0] = 0x03;  // FINISH
  cmd[1] = crc & 0xFF;
  cmd[2] = (crc >> 8) & 0xFF;
  cmd[3] = (crc >> 16) & 0xFF;
  cmd[4] = (crc >> 24) & 0xFF;
  
  // ✅ Use writeWithoutResponse
  await BleClient.writeWithoutResponse(
    deviceId,
    '9a501a2d-594f-4e2b-b123-5f739a2d594f',
    '9a531a2d-594f-4e2b-b123-5f739a2d594f',
    cmd
  );
}
```

---

## Reference: All Characteristics

| Characteristic | UUID | Property | Method to Use |
|----------------|------|----------|---------------|
| Motor Control | `9a511a2d-594f-4e2b-b123-5f739a2d594f` | WRITE_WITHOUT_RESPONSE | `writeWithoutResponse()` |
| Device Info | `9a521a2d-594f-4e2b-b123-5f739a2d594f` | WRITE + NOTIFY | `write()` |
| **OTA** | `9a531a2d-594f-4e2b-b123-5f739a2d594f` | **WRITE_WITHOUT_RESPONSE** | **`writeWithoutResponse()`** |

---

## How to Apply the Fix

### Step 1: Find Your Source Files

Your bundled file `dulaan-browser-bundled.js` is compiled output. You need to edit the **source** files.

Common locations:
```
src/
├── services/
│   ├── ota.service.ts          ← Likely here
│   ├── ble.service.ts          ← Or here
│   └── bluetooth.service.ts
├── utils/
│   └── ota.ts                  ← Or here
└── pages/
    └── ota/
        └── ota.page.ts         ← Or here
```

### Step 2: Search and Replace

**Search for:**
```typescript
BleClient.write(
```

**In OTA-related code, replace with:**
```typescript
BleClient.writeWithoutResponse(
```

**Important**: Only change OTA writes! Device Info should still use `write()`.

### Step 3: Rebuild App

```bash
# Install dependencies (if needed)
npm install

# Build the app
npm run build
# or
ionic build
# or
npx cap sync
```

### Step 4: Deploy to Device

```bash
# For Android
npx cap copy android
npx cap open android
# Then build and run in Android Studio

# For iOS
npx cap copy ios
npx cap open ios
# Then build and run in Xcode
```

### Step 5: Test

1. Open app on device
2. Connect to VibMotor
3. Load firmware file
4. Start OTA update
5. Should work! ✅

---

## Expected Behavior After Fix

### Before Fix
```
App: Tries to write START command
Device: Rejects (no WRITE property)
App: "Writing characteristic failed" ❌
```

### After Fix
```
App: Writes START command (without response)
Device: Accepts and processes
Device: Sends READY notification (01 00)
App: Sends DATA packets
Device: Sends PROGRESS notifications (02 0A, 02 14, ...)
App: Sends FINISH command
Device: Sends SUCCESS notification (03 00)
Device: Reboots with new firmware ✅
```

---

## Debugging Tips

### Check Which Method is Being Used

Add logging to your OTA code:

```typescript
console.log('Using writeWithoutResponse for OTA');
await BleClient.writeWithoutResponse(deviceId, serviceUuid, charUuid, data);
```

### Verify in Android Logs

After fix, you should see:

```
D BluetoothGatt: writeCharacteristic() - uuid: 9a531a2d... writeType: 1
                                                            ^^^^^^^^^^^^
                                                            1 = NO_RESPONSE
```

Before fix, you would see:
```
D BluetoothGatt: writeCharacteristic() - uuid: 9a531a2d... writeType: 2
                                                            ^^^^^^^^^^^^
                                                            2 = DEFAULT (requires response)
```

### Test with LightBlue First

Before rebuilding your app, test manually in LightBlue:

1. Connect to VibMotor
2. Find OTA characteristic (9a531a2d...)
3. Enable notifications
4. **Write WITHOUT RESPONSE**: `01 14 64 03 00`
5. Should receive: `01 00` (READY notification)

If this works, your device is fine and you just need to fix the app.

---

## Common Mistakes

### ❌ Wrong: Using write() for OTA
```typescript
await BleClient.write(deviceId, serviceUuid, otaCharUuid, data);
// Fails because OTA char doesn't have WRITE property
```

### ❌ Wrong: Changing Device Info to writeWithoutResponse
```typescript
await BleClient.writeWithoutResponse(deviceId, serviceUuid, deviceInfoCharUuid, data);
// Fails because Device Info char doesn't have WRITE_WITHOUT_RESPONSE property
```

### ✅ Correct: Use appropriate method for each characteristic
```typescript
// OTA - use writeWithoutResponse
await BleClient.writeWithoutResponse(deviceId, serviceUuid, otaCharUuid, otaData);

// Device Info - use write
await BleClient.write(deviceId, serviceUuid, deviceInfoCharUuid, infoQuery);

// Motor Control - use writeWithoutResponse
await BleClient.writeWithoutResponse(deviceId, serviceUuid, motorCharUuid, motorCmd);
```

---

## Alternative: Check Capacitor BLE Plugin Version

Some older versions of `@capacitor-community/bluetooth-le` might have issues. Make sure you're using a recent version:

```bash
npm list @capacitor-community/bluetooth-le
```

If outdated, update:

```bash
npm install @capacitor-community/bluetooth-le@latest
npx cap sync
```

---

## Summary

**Problem**: App uses `write()` for OTA characteristic  
**Solution**: Change to `writeWithoutResponse()` for OTA characteristic  
**Files to Edit**: Your source TypeScript/JavaScript files (not the bundled .js)  
**After Fix**: Rebuild app, deploy, test  

**Expected Result**: OTA completes in 10-15 seconds ✅

---

## Need Help Finding the Code?

If you can't find where the OTA writes are happening, search your source code for:

```bash
# Search for BLE write calls
grep -r "BleClient.write" src/

# Search for OTA characteristic UUID
grep -r "9a531a2d" src/

# Search for START command (0x01)
grep -r "0x01" src/ | grep -i ota
```

Or share your OTA service/component code and I can point out exactly what to change.
