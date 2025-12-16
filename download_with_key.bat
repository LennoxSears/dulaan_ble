@echo off
@rem ========================================
@rem Flash firmware with KEY
@rem Use this with board that has key pre-written
@rem (Get pre-keyed board from manufacturer)
@rem ========================================

cd %~dp0

copy ..\..\tone.cfg .
copy ..\..\cfg_tool.bin .
copy ..\..\app.bin .
copy ..\..\bd19loader.bin .
copy ..\..\p11_code.bin .
copy ..\..\script.ver .
copy ..\..\flash_params.bin

echo ========================================
echo Flashing firmware with KEY
echo ========================================

..\..\isd_download.exe ..\..\isd_config.ini -tonorflash -dev bd19 -boot 0x2000 -div8 -wait 300 -uboot ..\..\uboot.boot -app ..\..\app.bin ..\..\cfg_tool.bin -res ..\..\p11_code.bin -uboot_compress -flash-params flash_params.bin -key AC690X-A2E8.key
@rem Note: Removed -format all to preserve key

if errorlevel 1 (
    echo.
    echo ========================================
    echo ERROR: Failed to flash firmware
    echo ========================================
    pause
    exit /b 1
)

@rem Delete temporary files
if exist *.mp3 del *.mp3 
if exist *.PIX del *.PIX
if exist *.TAB del *.TAB
if exist *.res del *.res
if exist *.sty del *.sty

@rem Generate upgrade file
echo.
echo ========================================
echo Generating OTA upgrade file (.ufw)
echo ========================================

..\..\fw_add.exe -noenc -fw jl_isd.fw -add ..\..\ota.bin -type 100 -out jl_isd.fw
..\..\fw_add.exe -noenc -fw jl_isd.fw -add script.ver -out jl_isd.fw
..\..\ufw_maker.exe -fw_to_ufw jl_isd.fw
copy jl_isd.ufw update.ufw
del jl_isd.ufw

echo.
echo ========================================
echo Firmware flashed successfully!
echo OTA file: update.ufw
echo ========================================

ping /n 2 127.1>null
IF EXIST null del null

pause
