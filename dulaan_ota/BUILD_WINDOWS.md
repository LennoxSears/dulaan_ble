# Building on Windows

## Prerequisites

1. **Node.js and npm** - Download from [nodejs.org](https://nodejs.org/)
2. **Android Studio** - Download from [developer.android.com](https://developer.android.com/studio)
3. **Git Bash** (optional) - For running .sh scripts

## Option 1: Using Batch Scripts (Recommended)

### Quick Build

Open Command Prompt or PowerShell in the project root:

```cmd
cd dulaan
build-ota.bat
```

This will:
1. Build the backend bundle
2. Copy it to the Capacitor app
3. Build the Capacitor app with Vite
4. Sync with Android

### Manual Steps

If the batch script doesn't work, follow these steps:

#### Step 1: Build Backend Bundle

```cmd
cd backend\client
build-simple.bat
```

This creates `dulaan-browser-bundled.js` (177 KB)

#### Step 2: Copy Bundle to App

```cmd
copy dulaan-browser-bundled.js ..\..\dulaan\src\dulaan-bundle.js
```

#### Step 3: Build Capacitor App

```cmd
cd ..\..\dulaan
npm install
npm run build
```

#### Step 4: Sync with Android

```cmd
npx cap sync android
```

#### Step 5: Open in Android Studio

```cmd
npx cap open android
```

Then build and run from Android Studio.

## Option 2: Using Git Bash

If you have Git Bash installed, you can use the .sh scripts:

```bash
cd dulaan
./build-ota.sh
```

## Option 3: Manual File Combination (No Scripts)

If scripts don't work, you can manually combine the files:

### Step 1: Create Bundle Header

Create a new file `backend\client\dulaan-browser-bundled.js` and add:

```javascript
/**
 * Dulaan Browser Bundle
 */
(function(window) {
    'use strict';
```

### Step 2: Append Files in Order

Copy and paste the content of these files (remove import/export lines):

1. `utils/constants.js`
2. `utils/audio-utils.js`
3. `utils/motor-patterns.js`
4. `core/motor-controller.js`
5. `core/streaming-processor.js`
6. `core/ota-controller.js`
7. `services/api-service.js`
8. `services/consent-service.js`
9. `services/remote-service.js`
10. `services/motor-pattern-library.js`
11. `modes/ai-voice-control.js`
12. `modes/ambient-control.js`
13. `modes/touch-control.js`
14. `modes/pattern-control.js`
15. `dulaan-sdk.js`

### Step 3: Add Bundle Footer

Add at the end:

```javascript
    // Initialize
    let dulaan = null;
    setTimeout(() => {
        try {
            dulaan = new DulaanSDK();
            window.dulaan = dulaan;
            dulaan.initialize().catch(error => {
                console.error('Initialization failed:', error);
            });
        } catch (error) {
            console.error('Failed to create SDK:', error);
        }
    }, 100);

    window.dulaan = dulaan;
    window.DulaanSDK = DulaanSDK;
    window.DULAAN_COMPONENTS = {
        MotorController: typeof MotorController !== 'undefined' ? MotorController : null,
        OTAController: typeof OTAController !== 'undefined' ? OTAController : null
    };
})(window);
```

### Step 4: Copy to Capacitor App

Copy `backend\client\dulaan-browser-bundled.js` to `dulaan\src\dulaan-bundle.js`

### Step 5: Build and Deploy

```cmd
cd dulaan
npm install
npm run build
npx cap sync android
npx cap open android
```

## Troubleshooting

### "npm is not recognized"

Install Node.js from [nodejs.org](https://nodejs.org/)

After installation, restart Command Prompt and verify:
```cmd
npm --version
```

### "npx is not recognized"

npx comes with npm. If it's not working:
```cmd
npm install -g npx
```

### "The system cannot find the path specified"

Make sure you're in the correct directory:
```cmd
cd C:\path\to\dulaan_ota\dulaan
```

### Batch Script Errors

If the batch script fails, use the manual steps instead.

### Build Errors

If Vite build fails:
1. Delete `node_modules` folder
2. Delete `package-lock.json`
3. Run `npm install` again
4. Run `npm run build`

## Quick Reference

### Build Backend Only
```cmd
cd backend\client
build-simple.bat
```

### Build Capacitor App Only
```cmd
cd dulaan
npm run build
npx cap sync android
```

### Open Android Studio
```cmd
cd dulaan
npx cap open android
```

### Clean Build
```cmd
cd dulaan
rmdir /s /q node_modules
rmdir /s /q dist
del package-lock.json
npm install
npm run build
npx cap sync android
```

## Testing Without Building

You can test the OTA interface in a web browser:

1. Open Command Prompt in `dulaan\src`
2. Run a local server:
   ```cmd
   python -m http.server 8000
   ```
   Or if you have Node.js:
   ```cmd
   npx http-server -p 8000
   ```
3. Open browser to `http://localhost:8000/index.html`

Note: Web Bluetooth requires HTTPS or localhost, and won't work with `file://` URLs.

## Next Steps After Building

1. Connect Android device via USB
2. Enable Developer Mode and USB Debugging on device
3. Open project in Android Studio
4. Click "Run" button
5. Select your device
6. App will install and launch

## Support

If you encounter issues:
1. Check Node.js is installed: `node --version`
2. Check npm is installed: `npm --version`
3. Check you're in the correct directory
4. Try the manual steps instead of batch scripts
5. Check the error messages carefully
