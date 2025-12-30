#!/usr/bin/env node

/**
 * Build Script for Dulaan Browser Bundle
 * Combines all modular ES6 files into a single browser-compatible bundle
 */

const fs = require('fs');
const path = require('path');

// File order for bundling (dependencies first)
const FILES_TO_BUNDLE = [
    // 1. Constants and utilities first
    'utils/constants.js',
    'utils/audio-utils.js',
    'utils/motor-patterns.js',
    
    // 2. Core components
    'core/motor-controller.js',
    'core/streaming-processor.js',
    'core/ota-controller.js',
    
    // 3. Services
    'services/api-service.js',
    'services/consent-service.js',
    'services/remote-service.js',
    'services/motor-pattern-library.js',
    
    // 4. Control modes
    'modes/ai-voice-control.js',
    'modes/ambient-control.js',
    'modes/touch-control.js',
    'modes/pattern-control.js',
    

    
    // 6. Main SDK (last)
    'dulaan-sdk.js'
];

// Mock files to include when --mock flag is used
const MOCK_FILES = [
    'mocks/mock-ble.js',
    'mocks/mock-voice-recorder.js'
];

/**
 * Convert ES6 module to browser-compatible code
 */
function convertModuleToBrowser(content, filename) {
    let converted = content;
    
    // Remove import statements and collect them
    const imports = [];
    converted = converted.replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, (match) => {
        imports.push(match);
        return ''; // Remove import
    });
    
    // Remove export statements but keep the declarations
    converted = converted.replace(/export\s+\{[^}]*\};?\s*/g, ''); // Remove export { ... }
    converted = converted.replace(/export\s+default\s+/g, ''); // Remove export default
    converted = converted.replace(/export\s+/g, ''); // Remove export keyword
    
    // Add comment header
    const header = `\n    // ============================================================================\n    // ${filename}\n    // ============================================================================\n\n`;
    
    return header + converted;
}

/**
 * Create the browser bundle
 */
function createBundle(useMocks = false) {
    const buildType = useMocks ? 'Mock' : 'Production';
    console.log(`🔨 Building Dulaan Browser Bundle (${buildType})...`);
    
    // Determine which files to bundle
    const filesToBundle = [...FILES_TO_BUNDLE];
    if (useMocks) {
        // Add mock files at the beginning (before other files)
        filesToBundle.unshift(...MOCK_FILES);
    }
    
    let bundleContent = `/**
 * Dulaan Browser Bundle - Auto-generated from modular sources
 * Generated on: ${new Date().toISOString()}
 * Build type: ${buildType}
 * 
 * This file combines all modular ES6 files into a single browser-compatible bundle.
 * 
 * Source files:
${filesToBundle.map(f => ` * - ${f}`).join('\n')}
 */

(function(window) {
    'use strict';

`;

    // Process each file
    for (const filePath of filesToBundle) {
        const fullPath = path.join(__dirname, filePath);
        
        if (!fs.existsSync(fullPath)) {
            console.warn(`⚠️  Warning: File not found: ${filePath}`);
            continue;
        }
        
        console.log(`📄 Processing: ${filePath}`);
        
        const content = fs.readFileSync(fullPath, 'utf8');
        const converted = convertModuleToBrowser(content, filePath);
        
        bundleContent += converted + '\n';
    }

    // Add bundle footer
    bundleContent += `
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
                StreamingProcessor: typeof StreamingProcessor,
                ApiService: typeof ApiService,
                ConsentService: typeof ConsentService,
                RemoteService: typeof RemoteService,
                RingBuffer: typeof RingBuffer
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
    }, 100); // 100ms delay to ensure all classes are defined

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
    ${useMocks ? `console.log('🧪 Mock mode enabled - BLE and VoiceRecorder are simulated');` : ''}

})(window);
`;

    // Write the bundle
    const filename = useMocks ? 'dulaan-browser-bundled-mock.js' : 'dulaan-browser-bundled.js';
    const outputPath = path.join(__dirname, filename);
    fs.writeFileSync(outputPath, bundleContent);
    
    console.log(`✅ Bundle created: ${outputPath}`);
    console.log(`📊 Bundle size: ${(bundleContent.length / 1024).toFixed(1)} KB`);
    
    // Create a backup of the old bundle
    const oldBundlePath = path.join(__dirname, 'dulaan-browser.js');
    if (fs.existsSync(oldBundlePath)) {
        const backupPath = path.join(__dirname, 'dulaan-browser-old.js');
        fs.copyFileSync(oldBundlePath, backupPath);
        console.log(`💾 Old bundle backed up to: dulaan-browser-old.js`);
    }
    
    return outputPath;
}

/**
 * Update HTML files to use the new bundle
 */
function updateHtmlFiles() {
    console.log('🔄 Updating HTML files...');
    
    const htmlFiles = [
        'remote-control-demo.html',
        'test-consent.html',
        'test-new-structure.html'
    ];
    
    for (const htmlFile of htmlFiles) {
        const htmlPath = path.join(__dirname, htmlFile);
        
        if (!fs.existsSync(htmlPath)) {
            console.warn(`⚠️  HTML file not found: ${htmlFile}`);
            continue;
        }
        
        let content = fs.readFileSync(htmlPath, 'utf8');
        
        // Replace old bundle reference with new one
        if (content.includes('dulaan-browser.js')) {
            content = content.replace(/dulaan-browser\.js/g, 'dulaan-browser-bundled.js');
            fs.writeFileSync(htmlPath, content);
            console.log(`✅ Updated: ${htmlFile}`);
        }
    }
}

/**
 * Replace main bundle and clean up
 */
function deployBundle() {
    const bundledPath = path.join(__dirname, 'dulaan-browser-bundled.js');
    const mainPath = path.join(__dirname, 'dulaan-browser.js');
    const oldPath = path.join(__dirname, 'dulaan-browser-old.js');
    
    if (fs.existsSync(bundledPath)) {
        fs.copyFileSync(bundledPath, mainPath);
        fs.unlinkSync(bundledPath);
        
        if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
        }
        
        console.log('✅ Bundle deployed and cleaned up');
    }
}

// Main execution
if (require.main === module) {
    try {
        // Check for mock flag
        const useMocks = process.argv.includes('--mock');
        
        const bundlePath = createBundle(useMocks);
        
        // Only update HTML files for normal builds
        if (!useMocks) {
            updateHtmlFiles();
        }
        
        // Auto-deploy if --deploy flag is passed (only for normal builds)
        if (process.argv.includes('--deploy') && !useMocks) {
            deployBundle();
        }
        
        console.log('\n🎉 Build completed successfully!');
        
        if (useMocks) {
            console.log('\n🧪 Mock build created for testing:');
            console.log('- BLE operations will be simulated');
            console.log('- Voice recording will generate mock audio');
            console.log('- Perfect for development and testing without hardware');
        } else if (!process.argv.includes('--deploy')) {
            console.log('\n📋 Next steps:');
            console.log('1. Test the new bundle in your HTML files');
            console.log('2. Run "node build.js --deploy" to replace main bundle');
            console.log('3. Continue developing in the modular files');
            console.log('4. Use "node build.js --mock" to create a mock version for testing');
        }
        
    } catch (error) {
        console.error('❌ Build failed:', error.message);
        process.exit(1);
    }
}

module.exports = { createBundle, updateHtmlFiles };