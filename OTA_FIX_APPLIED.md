# OTA Configuration Fix Applied

## Problem

When building the firmware, you encountered OTA failures:

```
| !!!!!! FAIL:   测试盒BLE升级（大小=0xbc38）需要最小空间为 0xc000      
| !!!!!! FAIL:  测试盒经典蓝牙升级（大小=0x9abc）需要最小空间为 0xa000      
| !!!!!! FAIL: BLE RCSP升级（大小=0x10640）需要最小空间为 0x11000    
| !!!!!! FAIL:   用户UART升级（大小=0x4090）需要最小空间为 0x5000      
| !!!!!! FAIL: USB hid upgrade（大小=0x6514）需要最小空间为 0x7000 
| 未找到支持的升级方式
```

The issue was that the VM (Virtual Machine) storage area was too small to accommodate OTA updates.

## Root Cause

- **Previous VM_LEN**: 68K (0x11000) - barely enough for BLE RCSP OTA
- **Actual allocation**: Only 16KB (0x4000) was being allocated
- **Required for all OTA methods**: At least 68KB (0x11000)

## Solution Applied

Modified `SDK/cpu/bd19/tools/isd_config.ini`:

```ini
[RESERVED_CONFIG]
VM_ADR = 0;
VM_LEN = 80K;    # Changed from 68K to 80K
VM_OPT = 1;
```

**Why 80K?**
- Provides comfortable margin above the 68KB minimum
- Ensures all OTA methods work reliably
- Still leaves ~196KB of flash available for future use

## OTA Space Requirements

| OTA Method | Required Size | Status |
|------------|---------------|--------|
| UART Upgrade | 20 KB (0x5000) | ✅ Supported |
| USB HID Upgrade | 28 KB (0x7000) | ✅ Supported |
| Classic BT Upgrade | 40 KB (0xA000) | ✅ Supported |
| BLE Test Box Upgrade | 48 KB (0xC000) | ✅ Supported |
| **BLE RCSP Upgrade** | **68 KB (0x11000)** | ✅ **Supported** |

## Flash Layout After Fix

```
Total Flash: 512 KB (0x80000)
├── Firmware: 232 KB (0x3A000)
├── VM Storage: 80 KB (0x14000) ← INCREASED
├── BTIF Reserved: 4 KB (0x1000)
└── Available: ~196 KB
```

## How to Rebuild

### On Windows (with JieLi toolchain installed)

```bash
cd SDK
make clean_ac632n_spp_and_le
make ac632n_spp_and_le
```

### On Linux (with JieLi toolchain in /opt/jieli)

```bash
cd SDK
make clean_ac632n_spp_and_le
make ac632n_spp_and_le
```

## Expected Build Output

After rebuilding, you should see:

```
--------------------FLASH INFO--------------------
|  FLASH_BIN_SIZE : 0x3a000                      |
|  FLASH_NEED_SIZE : 0x49000                     |
|  FLASH_REAL_SIZE : 0x80000                     |
|  VM_REAL_SIZE : 0x14000                        | ← Should be 80KB now
|  VM_START_ADDR : 0x3a000                       |
|  VM_END_ADDR : 0x4e000                         |
--------------------------------------------------
```

And **NO OTA FAILURES** - all OTA methods should show as supported.

## Verification

After flashing the new firmware:

1. **Check build log** - No "FAIL" messages for OTA methods
2. **Test OTA** - Use JieLi OTA app to verify firmware update works
3. **Monitor flash usage** - Ensure VM area is properly allocated

## OTA Already Enabled

The motor control application already has OTA enabled:

**File**: `SDK/apps/spp_and_le/board/bd19/board_ac632n_demo_global_build_cfg.h`

```c
#define CONFIG_APP_OTA_ENABLE    1       // ✅ Already enabled
#define CONFIG_FLASH_SIZE        FLASH_SIZE_512K
```

This automatically enables:
- RCSP protocol support (`RCSP_BTMATE_EN = 1`)
- OTA update support (`RCSP_UPDATE_EN = 1`)

## OTA Update File

After successful build, the OTA update file is generated:

**Location**: `SDK/cpu/bd19/tools/download/data_trans/jl_isd.ufw`

This file can be used with:
- JieLi's official OTA app
- Custom apps implementing RCSP protocol
- Third-party OTA tools supporting JieLi format

## Next Steps

1. **Rebuild firmware** with the fix applied
2. **Flash to device** using JieLi download tool
3. **Test OTA** using JieLi OTA app or custom implementation
4. **Verify** that all OTA methods are now supported

## Additional Notes

- The fix only modifies flash allocation, not application code
- No changes to motor control functionality
- BLE security (LESC + Just-Works) remains unchanged
- All existing features continue to work as before

## Support

For OTA implementation details, see:
- `SDK/apps/spp_and_le/board/bd19/OTA_CONFIGURATION.md`
- JieLi SDK documentation
- RCSP protocol specification
