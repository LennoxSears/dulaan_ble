# Quick Start Guide for Windows

## Step-by-Step Instructions

### 1. Install Prerequisites

#### Node.js and npm
1. Download from [https://nodejs.org/](https://nodejs.org/)
2. Run the installer
3. Restart your computer
4. Verify installation:
   ```cmd
   node --version
   npm --version
   ```

#### Android Studio
1. Download from [https://developer.android.com/studio](https://developer.android.com/studio)
2. Run the installer
3. Open Android Studio and complete setup
4. Install Android SDK (API 33 or higher recommended)

### 2. Clone or Download Project

If you have Git:
```cmd
git clone https://github.com/LennoxSears/dulaan_ota.git
cd dulaan_ota
```

Or download and extract the ZIP file.

### 3. Build the App

Open Command Prompt or PowerShell in the project folder:

```cmd
cd dulaan
build-ota.bat
```

**What this does:**
- Builds the backend SDK bundle
- Copies it to the Capacitor app
- Builds the web app with Vite
- Syncs with Android platform

### 4. Open in Android Studio

```cmd
npx cap open android
```

This will open the project in Android Studio.

### 5. Connect Your Android Device

1. Enable **Developer Options** on your Android device:
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times
   - Go back to Settings → Developer Options
   - Enable "USB Debugging"

2. Connect device via USB cable

3. Allow USB debugging when prompted on device

### 6. Build and Run

In Android Studio:
1. Wait for Gradle sync to complete
2. Select your device from the device dropdown
3. Click the green "Run" button (▶️)
4. App will install and launch on your device

### 7. Use the App

1. **Enable Bluetooth** on your device
2. **Launch the app**
3. **Tap "Connect to Device"** - it will scan for VibMotor(BLE)
4. **Select firmware file** - tap "Select Firmware File" and choose your `.bin` file
5. **Start update** - tap "Start Update"
6. **Wait** - monitor the progress bar
7. **Done** - device will reboot automatically

## Troubleshooting

### "npm is not recognized"
- Node.js is not installed or not in PATH
- Install Node.js from [nodejs.org](https://nodejs.org/)
- Restart Command Prompt after installation

### "build-ota.bat is not recognized"
- You're not in the correct directory
- Make sure you're in the `dulaan` folder:
  ```cmd
  cd C:\path\to\dulaan_ota\dulaan
  ```

### "Cannot find module"
- Dependencies not installed
- Run:
  ```cmd
  npm install
  ```

### Batch Script Fails
Use manual steps:

```cmd
REM Step 1: Build backend
cd backend\client
build-simple.bat

REM Step 2: Copy bundle
copy dulaan-browser-bundled.js ..\..\dulaan\src\dulaan-bundle.js

REM Step 3: Build app
cd ..\..\dulaan
npm install
npm run build
npx cap sync android
npx cap open android
```

### Android Studio Issues

**Gradle sync fails:**
1. File → Invalidate Caches / Restart
2. Try again

**Device not detected:**
1. Check USB cable is data cable (not charge-only)
2. Check USB debugging is enabled
3. Try different USB port
4. Install device drivers if needed

**Build fails:**
1. Tools → SDK Manager
2. Install Android SDK Platform 33
3. Install Android SDK Build-Tools
4. Try again

### App Issues

**"No devices found":**
- Check VibMotor device is powered on
- Check device name is "VibMotor(BLE)"
- Check Bluetooth is enabled on phone
- Move closer to device

**"BleClient not available":**
- App didn't build correctly
- Clean and rebuild:
  ```cmd
  cd dulaan
  rmdir /s /q node_modules
  rmdir /s /q dist
  npm install
  npm run build
  npx cap sync android
  ```

**"Firmware too large":**
- File must be less than 240 KB
- Check you selected the correct `.bin` file

## Testing Without Device

You can test the UI in a web browser:

```cmd
cd dulaan\src
python -m http.server 8000
```

Then open: `http://localhost:8000/index.html`

Note: Actual BLE connection won't work in browser without real device.

## File Locations

- **Backend SDK**: `backend\client\`
- **Capacitor App**: `dulaan\`
- **OTA Interface**: `dulaan\src\index.html`
- **SDK Bundle**: `dulaan\src\dulaan-bundle.js`
- **Android Project**: `dulaan\android\`

## Common Commands

### Rebuild Everything
```cmd
cd dulaan
build-ota.bat
```

### Rebuild Backend Only
```cmd
cd backend\client
build-simple.bat
```

### Rebuild App Only
```cmd
cd dulaan
npm run build
npx cap sync android
```

### Clean Build
```cmd
cd dulaan
rmdir /s /q node_modules
rmdir /s /q dist
del package-lock.json
npm install
build-ota.bat
```

### View Logs
In Android Studio:
- View → Tool Windows → Logcat
- Filter by "dulaan" or "OTA"

## Next Steps

Once the app is working:
1. Test with real VibMotor(BLE) device
2. Try updating firmware
3. Check error handling
4. Test on different Android versions

## Getting Help

If you're stuck:
1. Check error messages carefully
2. Review [BUILD_WINDOWS.md](./BUILD_WINDOWS.md) for detailed instructions
3. Check [OTA_IMPLEMENTATION.md](./OTA_IMPLEMENTATION.md) for technical details
4. Check Android Studio Logcat for runtime errors

## Summary

**Minimum steps to get running:**
1. Install Node.js and Android Studio
2. Run `cd dulaan && build-ota.bat`
3. Run `npx cap open android`
4. Click Run in Android Studio
5. Use the app!
