@echo off
REM Build script for Dulaan OTA Capacitor App

echo Building Dulaan OTA App...
echo.

REM Step 1: Build backend bundle
echo Step 1: Building backend SDK bundle...
cd ..\backend\client
call build-simple.bat
if errorlevel 1 (
    echo Error building backend bundle
    exit /b 1
)

REM Step 2: Copy bundle to Capacitor app
echo.
echo Step 2: Copying bundle to Capacitor app...
copy /y dulaan-browser-bundled.js ..\..\dulaan\src\dulaan-bundle.js
if errorlevel 1 (
    echo Error copying bundle
    exit /b 1
)
echo Bundle copied

REM Step 3: Build Capacitor app
echo.
echo Step 3: Building Capacitor app...
cd ..\..\dulaan

where npm >nul 2>nul
if %errorlevel% equ 0 (
    echo Building with Vite...
    call npm run build
    if errorlevel 1 (
        echo Error building with Vite
        exit /b 1
    )
    
    echo.
    echo Step 4: Syncing with Capacitor...
    call npx cap sync android
    if errorlevel 1 (
        echo Error syncing with Capacitor
        exit /b 1
    )
    
    echo.
    echo Build complete!
    echo.
    echo Next steps:
    echo 1. Open Android Studio: npx cap open android
    echo 2. Build and run on device
    echo.
) else (
    echo npm not found - skipping Vite build
    echo.
    echo Manual steps:
    echo 1. Ensure dist/ folder exists with built files
    echo 2. Run: npx cap sync android
    echo 3. Run: npx cap open android
    echo.
)

echo Done!
