#!/bin/bash

# Build script for Dulaan OTA Capacitor App

set -e

echo "🔨 Building Dulaan OTA App..."

# Step 1: Build backend bundle
echo ""
echo "📦 Step 1: Building backend SDK bundle..."
cd ../backend/client
./build-simple.sh

# Step 2: Copy bundle to Capacitor app
echo ""
echo "📋 Step 2: Copying bundle to Capacitor app..."
cp dulaan-browser-bundled.js ../../dulaan/src/dulaan-bundle.js
echo "✅ Bundle copied"

# Step 3: Build Capacitor app (if vite/npm available)
echo ""
echo "🏗️  Step 3: Building Capacitor app..."
cd ../../dulaan

if command -v npm &> /dev/null; then
    echo "Building with Vite..."
    npm run build
    
    echo ""
    echo "🔄 Step 4: Syncing with Capacitor..."
    npx cap sync android
    
    echo ""
    echo "✅ Build complete!"
    echo ""
    echo "📱 Next steps:"
    echo "1. Open Android Studio: npx cap open android"
    echo "2. Build and run on device"
    echo ""
else
    echo "⚠️  npm not found - skipping Vite build"
    echo ""
    echo "📱 Manual steps:"
    echo "1. Ensure dist/ folder exists with built files"
    echo "2. Run: npx cap sync android"
    echo "3. Run: npx cap open android"
    echo ""
fi

echo "🎉 Done!"
