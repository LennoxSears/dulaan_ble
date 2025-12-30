#!/bin/bash

# Simple build script for Dulaan Browser Bundle
# Combines all modular files into a single browser-compatible bundle

OUTPUT_FILE="dulaan-browser-bundled.js"
TEMP_FILE="temp-bundle.js"

echo "🔨 Building Dulaan Browser Bundle..."

# Create bundle header
cat > "$TEMP_FILE" << 'EOF'
/**
 * Dulaan Browser Bundle - Auto-generated from modular sources
 * Generated on: $(date -Iseconds)
 * 
 * This file combines all modular ES6 files into a single browser-compatible bundle.
 */

(function(window) {
    'use strict';

EOF

# Function to process a file
process_file() {
    local file=$1
    if [ -f "$file" ]; then
        echo "📄 Processing: $file"
        echo "" >> "$TEMP_FILE"
        echo "    // ============================================================================" >> "$TEMP_FILE"
        echo "    // $file" >> "$TEMP_FILE"
        echo "    // ============================================================================" >> "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
        
        # Remove import/export statements and add to bundle
        sed -e '/^import /d' \
            -e '/^export /d' \
            -e 's/export default //g' \
            -e 's/export {[^}]*};//g' \
            "$file" >> "$TEMP_FILE"
        
        echo "" >> "$TEMP_FILE"
    else
        echo "⚠️  Warning: File not found: $file"
    fi
}

# Process files in order
process_file "utils/constants.js"
process_file "utils/audio-utils.js"
process_file "utils/motor-patterns.js"
process_file "core/motor-controller.js"
process_file "core/streaming-processor.js"
process_file "core/ota-controller.js"
process_file "services/api-service.js"
process_file "services/consent-service.js"
process_file "services/remote-service.js"
process_file "services/motor-pattern-library.js"
process_file "modes/ai-voice-control.js"
process_file "modes/ambient-control.js"
process_file "modes/touch-control.js"
process_file "modes/pattern-control.js"
process_file "dulaan-sdk.js"

# Add bundle footer
cat >> "$TEMP_FILE" << 'EOF'

    // ============================================================================
    // Bundle Initialization
    // ============================================================================

    // Create global instance with error handling and delayed initialization
    let dulaan = null;
    
    // Use setTimeout to ensure all classes are fully defined
    setTimeout(() => {
        try {
            console.log('🔍 Checking available classes before DulaanSDK creation:', {
                DulaanSDK: typeof DulaanSDK,
                MotorController: typeof MotorController,
                OTAController: typeof OTAController,
                StreamingProcessor: typeof StreamingProcessor,
                ApiService: typeof ApiService
            });
            
            dulaan = new DulaanSDK();
            console.log('✅ DulaanSDK instance created successfully');
            
            // Update global reference
            window.dulaan = dulaan;
            
            // Initialize automatically
            dulaan.initialize().catch(error => {
                console.error('❌ DulaanSDK initialization failed:', error);
            });
        } catch (error) {
            console.error('❌ Failed to create DulaanSDK instance:', error);
            console.error('Error details:', error.stack);
        }
    }, 100);

    // Export to global scope
    window.dulaan = dulaan;
    window.DulaanSDK = DulaanSDK;

    // Export individual components for advanced usage
    window.DULAAN_COMPONENTS = {
        MotorController: typeof MotorController !== 'undefined' ? MotorController : null,
        StreamingProcessor: typeof StreamingProcessor !== 'undefined' ? StreamingProcessor : null,
        OTAController: typeof OTAController !== 'undefined' ? OTAController : null,
        ApiService: typeof ApiService !== 'undefined' ? ApiService : null,
        ConsentService: typeof ConsentService !== 'undefined' ? ConsentService : null,
        RemoteService: typeof RemoteService !== 'undefined' ? RemoteService : null,
        AIVoiceControl: typeof AIVoiceControl !== 'undefined' ? AIVoiceControl : null,
        AmbientControl: typeof AmbientControl !== 'undefined' ? AmbientControl : null,
        TouchControl: typeof TouchControl !== 'undefined' ? TouchControl : null,
        PatternControl: typeof PatternControl !== 'undefined' ? PatternControl : null,
        MotorPatternLibrary: typeof MotorPatternLibrary !== 'undefined' ? MotorPatternLibrary : null,
        RingBuffer: typeof RingBuffer !== 'undefined' ? RingBuffer : null,
        UTILS: typeof UTILS !== 'undefined' ? UTILS : null
    };

    console.log('🚀 Dulaan Browser Bundle loaded successfully');
    console.log('📦 Available components:', Object.keys(window.DULAAN_COMPONENTS));

})(window);
EOF

# Move temp file to output
mv "$TEMP_FILE" "$OUTPUT_FILE"

# Get file size
SIZE=$(wc -c < "$OUTPUT_FILE")
SIZE_KB=$((SIZE / 1024))

echo "✅ Bundle created: $OUTPUT_FILE"
echo "📊 Bundle size: ${SIZE_KB} KB"
echo ""
echo "🎉 Build completed successfully!"
