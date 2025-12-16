@echo off
@rem ========================================
@rem Step 1: Write KEY to virgin chip
@rem This must be done ONCE on a new chip
@rem ========================================

cd %~dp0

echo ========================================
echo Writing KEY to chip (first time only)
echo ========================================

@rem Write key to chip without firmware
..\..\isd_download.exe ..\..\isd_config.ini -tonorflash -dev bd19 -boot 0x2000 -div8 -wait 300 -key AC690X-A2E8.key -format all

if errorlevel 1 (
    echo.
    echo ========================================
    echo ERROR: Failed to write KEY to chip
    echo ========================================
    pause
    exit /b 1
)

echo.
echo ========================================
echo KEY written successfully!
echo Now you can flash firmware with key
echo ========================================
pause
