@echo off
REM Simple build script for Dulaan Browser Bundle
REM Combines all modular files into a single browser-compatible bundle

setlocal enabledelayedexpansion

set OUTPUT_FILE=dulaan-browser-bundled.js
set TEMP_FILE=temp-bundle.js

echo Building Dulaan Browser Bundle...

REM Create bundle header
(
echo /**
echo  * Dulaan Browser Bundle - Auto-generated from modular sources
echo  * Generated on: %date% %time%
echo  * 
echo  * This file combines all modular ES6 files into a single browser-compatible bundle.
echo  */
echo.
echo ^(function^(window^) {
echo     'use strict';
echo.
) > %TEMP_FILE%

REM Function to process a file
set "files=utils/constants.js utils/audio-utils.js utils/motor-patterns.js core/motor-controller.js core/streaming-processor.js core/ota-controller.js services/api-service.js services/consent-service.js services/remote-service.js services/motor-pattern-library.js modes/ai-voice-control.js modes/ambient-control.js modes/touch-control.js modes/pattern-control.js dulaan-sdk.js"

for %%f in (%files%) do (
    if exist "%%f" (
        echo Processing: %%f
        echo. >> %TEMP_FILE%
        echo     // ============================================================================ >> %TEMP_FILE%
        echo     // %%f >> %TEMP_FILE%
        echo     // ============================================================================ >> %TEMP_FILE%
        echo. >> %TEMP_FILE%
        
        REM Remove import/export statements and add to bundle
        findstr /v /r "^import.*from" "%%f" | findstr /v /r "^export" >> %TEMP_FILE%
        echo. >> %TEMP_FILE%
    ) else (
        echo Warning: File not found: %%f
    )
)

REM Add bundle footer
(
echo.
echo     // ============================================================================
echo     // Bundle Initialization
echo     // ============================================================================
echo.
echo     // Create global instance with error handling and delayed initialization
echo     let dulaan = null;
echo.    
echo     // Use setTimeout to ensure all classes are fully defined
echo     setTimeout^(^(^) =^> {
echo         try {
echo             console.log^('Checking available classes before DulaanSDK creation:', {
echo                 DulaanSDK: typeof DulaanSDK,
echo                 MotorController: typeof MotorController,
echo                 OTAController: typeof OTAController,
echo                 StreamingProcessor: typeof StreamingProcessor,
echo                 ApiService: typeof ApiService
echo             }^);
echo.            
echo             dulaan = new DulaanSDK^(^);
echo             console.log^('DulaanSDK instance created successfully'^);
echo.            
echo             // Update global reference
echo             window.dulaan = dulaan;
echo.            
echo             // Initialize automatically
echo             dulaan.initialize^(^).catch^(error =^> {
echo                 console.error^('DulaanSDK initialization failed:', error^);
echo             }^);
echo         } catch ^(error^) {
echo             console.error^('Failed to create DulaanSDK instance:', error^);
echo             console.error^('Error details:', error.stack^);
echo         }
echo     }, 100^);
echo.
echo     // Export to global scope
echo     window.dulaan = dulaan;
echo     window.DulaanSDK = DulaanSDK;
echo.
echo     // Export individual components for advanced usage
echo     window.DULAAN_COMPONENTS = {
echo         MotorController: typeof MotorController !== 'undefined' ? MotorController : null,
echo         StreamingProcessor: typeof StreamingProcessor !== 'undefined' ? StreamingProcessor : null,
echo         OTAController: typeof OTAController !== 'undefined' ? OTAController : null,
echo         ApiService: typeof ApiService !== 'undefined' ? ApiService : null,
echo         ConsentService: typeof ConsentService !== 'undefined' ? ConsentService : null,
echo         RemoteService: typeof RemoteService !== 'undefined' ? RemoteService : null,
echo         AIVoiceControl: typeof AIVoiceControl !== 'undefined' ? AIVoiceControl : null,
echo         AmbientControl: typeof AmbientControl !== 'undefined' ? AmbientControl : null,
echo         TouchControl: typeof TouchControl !== 'undefined' ? TouchControl : null,
echo         PatternControl: typeof PatternControl !== 'undefined' ? PatternControl : null,
echo         MotorPatternLibrary: typeof MotorPatternLibrary !== 'undefined' ? MotorPatternLibrary : null,
echo         RingBuffer: typeof RingBuffer !== 'undefined' ? RingBuffer : null,
echo         UTILS: typeof UTILS !== 'undefined' ? UTILS : null
echo     };
echo.
echo     console.log^('Dulaan Browser Bundle loaded successfully'^);
echo     console.log^('Available components:', Object.keys^(window.DULAAN_COMPONENTS^)^);
echo.
echo }^)^(window^);
) >> %TEMP_FILE%

REM Move temp file to output
move /y %TEMP_FILE% %OUTPUT_FILE% >nul

REM Get file size
for %%A in (%OUTPUT_FILE%) do set SIZE=%%~zA
set /a SIZE_KB=%SIZE% / 1024

echo.
echo Bundle created: %OUTPUT_FILE%
echo Bundle size: %SIZE_KB% KB
echo.
echo Build completed successfully!

endlocal
