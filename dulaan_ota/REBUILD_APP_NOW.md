# ⚠️ REBUILD APP REQUIRED

## The Problem

Your app is still using the **OLD compiled JavaScript** that doesn't have the adaptive delay + retry fixes.

**Evidence from logs:**
```
OTA: Write attempt 1/3 failed  ← Retry is working ✅
OTA: Slowing down, delay now 65ms  ← Adaptive delay is working ✅
OTA: Write attempt 2/3 failed
OTA: Write attempt 3/3 failed
OTA: Failed to send data: Writing characteristic failed ❌
```

The retry and adaptive delay code IS running, but the underlying `writeWithoutResponse` call is still failing.

**Root cause**: The bundled JavaScript file (`dulaan-browser-bundled.js`) was compiled BEFORE our fixes and still has issues.

---

## Solution: Rebuild the App

### Step 1: Navigate to App Directory

```bash
cd dulaan_ota/dulaan
```

### Step 2: Clean Previous Build

```bash
# Remove old build artifacts
rm -rf node_modules/.cache
rm -rf android/app/build
rm -rf www
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Build the App

```bash
npm run build
```

This will:
- Compile TypeScript/JavaScript
- Bundle all code including our fixes
- Create optimized production build

### Step 5: Sync with Capacitor

```bash
npx cap sync
```

This will:
- Copy web assets to native projects
- Update native dependencies
- Prepare for deployment

### Step 6: Copy to Android

```bash
npx cap copy android
```

### Step 7: Open in Android Studio

```bash
npx cap open android
```

### Step 8: Build and Run

In Android Studio:
1. Click "Build" → "Clean Project"
2. Click "Build" → "Rebuild Project"
3. Click "Run" → "Run 'app'"
4. Select your device
5. Wait for installation

---

## Verify the Fix

After rebuilding and installing:

### 1. Check Console Logs

You should see:
```
OTA: Speeding up, delay now 45ms  ← Adaptive delay working
OTA: Progress: 10%
OTA: Progress: 20%
...
OTA: Progress: 100%
OTA: Update complete! ✅
```

### 2. Check Android Logs

Should NOT see:
```
❌ onClientConnectionState() - status=8  (timeout)
```

Should see:
```
✅ Connection stays stable throughout OTA
✅ No disconnection until OTA completes
```

---

## If Still Failing After Rebuild

### Check 1: Verify Build Timestamp

In browser console, check when the file was built:
```javascript
// Look for build timestamp in bundled file
console.log('Build time:', document.querySelector('script[src*="bundled"]').src);
```

Should show recent timestamp (today's date).

### Check 2: Clear App Cache

```bash
# In Android Studio
Build → Clean Project
Build → Rebuild Project

# Or manually
rm -rf android/app/build
rm -rf android/.gradle
```

### Check 3: Uninstall Old App

On your Android device:
1. Settings → Apps → Dulaan
2. Uninstall
3. Reinstall from Android Studio

This ensures no cached code from old version.

---

## Alternative: Quick Test with Web Version

If you have a web version of the app:

```bash
cd dulaan_ota/dulaan
npm run build
npx http-server www -p 8080
```

Open in Chrome on your computer, test OTA there first.

---

## Build Script (Automated)

Create a build script to automate this:

**File**: `dulaan_ota/dulaan/rebuild.sh`

```bash
#!/bin/bash
set -e

echo "🧹 Cleaning..."
rm -rf node_modules/.cache
rm -rf android/app/build
rm -rf www

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building..."
npm run build

echo "🔄 Syncing with Capacitor..."
npx cap sync

echo "📱 Copying to Android..."
npx cap copy android

echo "✅ Build complete! Open Android Studio and run the app."
echo ""
echo "Next steps:"
echo "1. npx cap open android"
echo "2. Build → Clean Project"
echo "3. Build → Rebuild Project"
echo "4. Run → Run 'app'"
```

Make it executable:
```bash
chmod +x rebuild.sh
```

Run it:
```bash
./rebuild.sh
```

---

## Windows Build Script

**File**: `dulaan_ota/dulaan/rebuild.bat`

```batch
@echo off
echo Cleaning...
rmdir /s /q node_modules\.cache 2>nul
rmdir /s /q android\app\build 2>nul
rmdir /s /q www 2>nul

echo Installing dependencies...
call npm install

echo Building...
call npm run build

echo Syncing with Capacitor...
call npx cap sync

echo Copying to Android...
call npx cap copy android

echo Build complete! Open Android Studio and run the app.
echo.
echo Next steps:
echo 1. npx cap open android
echo 2. Build -^> Clean Project
echo 3. Build -^> Rebuild Project
echo 4. Run -^> Run 'app'
pause
```

Run it:
```batch
rebuild.bat
```

---

## Common Issues

### Issue 1: "npm: command not found"

**Solution**: Install Node.js from https://nodejs.org/

### Issue 2: "capacitor: command not found"

**Solution**:
```bash
npm install -g @capacitor/cli
```

### Issue 3: Build fails with errors

**Solution**:
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue 4: Android Studio doesn't see changes

**Solution**:
```bash
# Force clean
cd android
./gradlew clean
cd ..
npx cap sync
npx cap copy android
```

---

## Summary

**Problem**: App using old compiled code without fixes  
**Solution**: Rebuild app with `npm run build`  
**Steps**: Clean → Install → Build → Sync → Copy → Run  
**Expected**: OTA completes successfully in 30-90 seconds  

**YOU MUST REBUILD THE APP FOR THE FIXES TO TAKE EFFECT!**

---

## Quick Commands

```bash
cd dulaan_ota/dulaan
npm install
npm run build
npx cap sync
npx cap copy android
npx cap open android
```

Then in Android Studio:
1. Clean Project
2. Rebuild Project
3. Run app
4. Test OTA

**After rebuild, OTA should work!** ✅
