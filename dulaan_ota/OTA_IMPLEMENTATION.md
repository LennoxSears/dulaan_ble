# OTA Implementation Guide

## Overview

This implementation adds OTA (Over-The-Air) firmware update functionality to the Dulaan Capacitor app using the backend SDK architecture.

## Architecture

### Backend SDK (`/backend/client/`)
- **New Module**: `core/ota-controller.js` - Handles OTA update process
- **Build System**: Updated `build.js` to include OTA controller
- **Bundle**: `dulaan-browser-bundled.js` (177 KB) - Complete SDK with OTA support

### Capacitor App (`/dulaan/`)
- **OTA UI**: `src/index.html` - Simple mobile-optimized OTA interface
- **Bundle**: `src/dulaan-bundle.js` - Copy of backend bundle

## Features

### OTA Controller (`backend/client/core/ota-controller.js`)
- Device scanning for "VibMotor(BLE)"
- BLE connection management
- Firmware file loading and validation (max 240KB)
- OTA protocol implementation (V4.0):
  - START command with firmware size
  - DATA packets with sequence numbers
  - FINISH command with CRC32 verification
- Progress tracking and status updates
- Error handling with detailed error codes

### Mobile UI (`dulaan/src/index.html`)
- Clean, mobile-optimized interface
- Device connection workflow
- Firmware file selection
- Real-time progress bar
- Status updates and logging
- Error handling and display

## Protocol Details

### BLE Service & Characteristics
- **Service UUID**: `9A501A2D-594F-4E2B-B123-5F739A2D594F`
- **OTA Characteristic**: `9A531A2D-594F-4E2B-B123-5F739A2D594F`
- **Device Name**: `VibMotor(BLE)`

### OTA Commands
1. **START**: `[0x01][size_low][size_high][size_mid][size_top]`
2. **DATA**: `[0x02][seq_low][seq_high][data...]` (240 bytes max per packet)
3. **FINISH**: `[0x03][crc_low][crc_high][crc_mid][crc_top]`

### Notifications
- `0x01` - Device ready
- `0x02` - Progress update (0-100%)
- `0x03` - Update successful
- `0xFF` - Error (with error code)

## Usage

### Building the Backend Bundle

```bash
cd backend/client
./build-simple.sh
```

This creates `dulaan-browser-bundled.js` with all modules including OTA support.

### Copying to Capacitor App

```bash
cp backend/client/dulaan-browser-bundled.js dulaan/src/dulaan-bundle.js
```

### Building the Capacitor App

```bash
cd dulaan
npm install
npm run build
npx cap sync android
```

### Running on Android

```bash
cd dulaan
npx cap open android
```

Then build and run from Android Studio.

## API Usage

### Accessing OTA Controller

```javascript
// Via global SDK instance
const ota = window.dulaan.ota;

// Setup callbacks
ota.onStatusChange = (status) => console.log('Status:', status);
ota.onProgress = (percent) => console.log('Progress:', percent);
ota.onError = (error) => console.error('Error:', error);
ota.onComplete = () => console.log('Update complete!');

// Initialize and scan
await ota.initialize();
await ota.scan();

// Connect to device
await ota.connect();

// Load firmware file
const fileInfo = await ota.loadFirmware(file);

// Start update
await ota.startUpdate();
```

### Direct Access to OTA Controller Class

```javascript
// Access the class directly
const OTAController = window.DULAAN_COMPONENTS.OTAController;

// Create custom instance
const myOta = new OTAController();
```

## File Structure

```
backend/client/
├── core/
│   ├── motor-controller.js
│   ├── streaming-processor.js
│   └── ota-controller.js          # NEW: OTA functionality
├── build.js                        # Updated to include OTA
├── build-simple.sh                 # Bash build script
└── dulaan-browser-bundled.js      # Generated bundle

dulaan/
├── src/
│   ├── index.html                  # OTA interface
│   └── dulaan-bundle.js            # Copy of backend bundle
├── package.json
└── capacitor.config.json
```

## Testing

### Web Browser Testing (Development)
1. Open `dulaan/src/index.html` in Chrome/Edge
2. Requires HTTPS or localhost
3. Device must be in range and advertising

### Capacitor App Testing
1. Build and deploy to Android device
2. Enable Bluetooth
3. Launch app
4. Follow on-screen instructions

## Error Codes

| Code | Description |
|------|-------------|
| 0x01 | Invalid START command |
| 0x02 | Firmware size too large |
| 0x03 | Not in receiving state |
| 0x04 | Invalid DATA packet |
| 0x05 | Flash write failed |
| 0x06 | Not in receiving state |
| 0x07 | Invalid FINISH command |
| 0x08 | Size mismatch |
| 0x09 | CRC verification failed |
| 0xFF | Unknown command |

## Troubleshooting

### "BleClient not available"
- Ensure `@capacitor-community/bluetooth-le` is installed
- Check that Capacitor plugins are properly synced
- Verify Android permissions in `AndroidManifest.xml`

### "No devices found"
- Check device is powered on and advertising
- Verify device name is exactly "VibMotor(BLE)"
- Ensure Bluetooth is enabled on phone
- Check device is not already connected to another device

### "Firmware too large"
- Maximum firmware size is 240 KB
- Compress or optimize firmware if needed
- Check you're selecting the correct `.bin` file

### "CRC verification failed"
- File may be corrupted
- Try re-downloading firmware
- Ensure file wasn't modified during transfer

## Next Steps

1. **Test on real hardware**: Deploy to Android device and test with actual VibMotor device
2. **Add iOS support**: Test and adjust for iOS if needed
3. **Enhance UI**: Add more visual feedback, animations
4. **Add features**: 
   - Firmware version checking
   - Update history
   - Batch updates
   - Automatic retry on failure

## Notes

- The OTA controller follows the same patterns as `motor-controller.js`
- All BLE operations use Capacitor's `@capacitor-community/bluetooth-le` plugin
- The UI is mobile-optimized with touch-friendly buttons
- Progress updates come from both local calculation and device notifications
- Device automatically reboots after successful update
