# Dulaan OTA - Firmware Update App

Capacitor-based mobile app for OTA (Over-The-Air) firmware updates to VibMotor(BLE) devices.

## Features

- 📱 Mobile-optimized OTA interface
- 🔵 Bluetooth LE device scanning and connection
- 📦 Firmware file validation (max 240KB)
- 📊 Real-time progress tracking
- ✅ CRC32 verification
- 🔄 Automatic device reboot after update
- ⚠️ Detailed error reporting

## Project Structure

```
dulaan_ota/
├── backend/                    # Backend SDK with OTA support
│   └── client/
│       ├── core/
│       │   ├── motor-controller.js
│       │   ├── streaming-processor.js
│       │   └── ota-controller.js      # OTA implementation
│       ├── build.js
│       ├── build-simple.sh            # Build script
│       └── dulaan-browser-bundled.js  # Generated bundle
│
├── dulaan/                     # Capacitor app
│   ├── src/
│   │   ├── index.html         # OTA interface
│   │   └── dulaan-bundle.js   # SDK bundle
│   ├── android/               # Android platform
│   ├── package.json
│   ├── capacitor.config.json
│   └── build-ota.sh           # Build script
│
├── extras/                     # Reference implementation
│   └── ota-web-tool.html      # Web Bluetooth version
│
├── 蓝牙震动马达控制协议.md      # BLE protocol specification
└── OTA_IMPLEMENTATION.md       # Detailed implementation guide
```

## Quick Start

### Prerequisites

- Node.js and npm (for building)
- Android Studio (for Android deployment)
- Bluetooth-enabled Android device
- VibMotor(BLE) device with firmware file

### Build and Deploy

**Linux/Mac:**
```bash
cd dulaan
./build-ota.sh
npx cap open android
```

**Windows:**
```cmd
cd dulaan
build-ota.bat
npx cap open android
```

**See [BUILD_WINDOWS.md](./BUILD_WINDOWS.md) for detailed Windows instructions.**

### Manual Build Steps

**Linux/Mac:**
```bash
# 1. Build backend bundle
cd backend/client
./build-simple.sh

# 2. Copy to Capacitor app
cp dulaan-browser-bundled.js ../../dulaan/src/dulaan-bundle.js

# 3. Build Capacitor app
cd ../../dulaan
npm install
npm run build

# 4. Sync with Android
npx cap sync android

# 5. Open in Android Studio
npx cap open android
```

**Windows:**
```cmd
REM 1. Build backend bundle
cd backend\client
build-simple.bat

REM 2. Copy to Capacitor app
copy dulaan-browser-bundled.js ..\..\dulaan\src\dulaan-bundle.js

REM 3. Build Capacitor app
cd ..\..\dulaan
npm install
npm run build

REM 4. Sync with Android
npx cap sync android

REM 5. Open in Android Studio
npx cap open android
```

## Usage

1. **Launch App**: Open the app on your Android device
2. **Connect**: Tap "Connect to Device" to scan for VibMotor(BLE)
3. **Select Firmware**: Tap "Select Firmware File" and choose your `.bin` file
4. **Update**: Tap "Start Update" to begin the OTA process
5. **Wait**: Monitor progress bar until completion
6. **Done**: Device will automatically reboot with new firmware

## BLE Protocol

### Service & Characteristics
- **Service UUID**: `9A501A2D-594F-4E2B-B123-5F739A2D594F`
- **OTA Characteristic**: `9A531A2D-594F-4E2B-B123-5F739A2D594F`
- **Device Name**: `VibMotor(BLE)`

### OTA Commands
1. **START**: `[0x01][size_low][size_high][size_mid][size_top]`
2. **DATA**: `[0x02][seq_low][seq_high][data...]` (240 bytes/packet)
3. **FINISH**: `[0x03][crc_low][crc_high][crc_mid][crc_top]`

### Notifications
- `0x01` - Device ready
- `0x02` - Progress (0-100%)
- `0x03` - Success
- `0xFF` - Error

## Development

### Backend SDK

The backend SDK is modular and can be built into a single bundle:

```bash
cd backend/client
./build-simple.sh
```

This creates `dulaan-browser-bundled.js` (177 KB) with all modules including:
- Motor Controller
- OTA Controller
- Streaming Processor
- API Services
- Control Modes

### Adding Features

To add new features to the SDK:

1. Create module in appropriate directory (`core/`, `services/`, `modes/`)
2. Update `build-simple.sh` to include the new file
3. Rebuild bundle
4. Copy to Capacitor app

### Testing

**Web Browser (Development)**:
```bash
# Serve the OTA page
cd dulaan/src
python3 -m http.server 8000
# Open http://localhost:8000/index.html
```

**Android Device**:
1. Build and deploy via Android Studio
2. Enable Bluetooth on device
3. Ensure VibMotor device is in range

## Troubleshooting

### Build Issues

**"npm not found"**:
- Install Node.js: https://nodejs.org/

**"BleClient not available"**:
- Ensure `@capacitor-community/bluetooth-le` is in `package.json`
- Run `npm install` in dulaan directory
- Run `npx cap sync android`

### Runtime Issues

**"No devices found"**:
- Check device is powered on
- Verify device name is "VibMotor(BLE)"
- Ensure Bluetooth is enabled
- Check device isn't connected elsewhere

**"Firmware too large"**:
- Maximum size is 240 KB
- Check you're using the correct `.bin` file

**"CRC verification failed"**:
- File may be corrupted
- Re-download firmware
- Ensure file wasn't modified

## Documentation

- **[OTA_IMPLEMENTATION.md](./OTA_IMPLEMENTATION.md)** - Detailed implementation guide
- **[蓝牙震动马达控制协议.md](./蓝牙震动马达控制协议.md)** - BLE protocol specification (Chinese)
- **[backend/client/README.md](./backend/client/README.md)** - Backend SDK documentation

## License

See [LICENSE](./backend/LICENSE) file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the implementation guide
3. Check the BLE protocol specification
4. Review console logs for error details
