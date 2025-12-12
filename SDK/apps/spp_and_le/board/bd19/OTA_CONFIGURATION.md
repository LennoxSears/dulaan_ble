# OTA Configuration for AC632N

## Flash Layout

The AC632N chip has the following flash configuration:

```
Total Flash: 512 KB (0x80000)
├── Firmware: 232 KB (0x3A000)
├── VM Storage: 68 KB (0x11000) - for OTA and data storage
├── BTIF Reserved: 4 KB (0x1000) - Bluetooth interface
└── Remaining: ~208 KB
```

## VM (Virtual Machine) Storage

The VM storage area is used for:
1. **OTA Updates**: Temporary storage for firmware updates
2. **User Data**: Application data storage
3. **Configuration**: System configuration data

### Current Configuration

File: `SDK/cpu/bd19/tools/isd_config.ini`

```ini
[RESERVED_CONFIG]
VM_ADR = 0;
VM_LEN = 68K;    # Increased from 8K to support OTA
VM_OPT = 1;
```

### OTA Space Requirements

Different OTA methods require different minimum VM sizes:

| OTA Method | Required Size | Hex Value |
|------------|---------------|-----------|
| UART Upgrade | 20 KB | 0x5000 |
| USB HID Upgrade | 28 KB | 0x7000 |
| Classic BT Upgrade | 40 KB | 0xA000 |
| BLE Test Box Upgrade | 48 KB | 0xC000 |
| **BLE RCSP Upgrade** | **68 KB** | **0x11000** |

**Current setting (68 KB)** supports all OTA methods including BLE RCSP upgrade.

## Enabling OTA

OTA is currently **disabled** in the application. To enable:

### Step 1: Enable OTA in Board Configuration

Edit: `SDK/apps/spp_and_le/board/bd19/board_ac632n_demo_global_build_cfg.h`

```c
// Change from:
#define CONFIG_APP_OTA_ENABLE    0

// To:
#define CONFIG_APP_OTA_ENABLE    1
```

### Step 2: Rebuild Firmware

```bash
cd SDK
make ac632n_spp_and_le
```

### Step 3: Flash to Device

Use the JieLi download tool to flash the new firmware.

## OTA Methods

### 1. BLE RCSP (Recommended)

**Advantages**:
- Works over BLE connection
- No additional hardware needed
- Can update remotely

**Requirements**:
- VM size: 68 KB (already configured)
- `CONFIG_APP_OTA_ENABLE = 1`
- `RCSP_UPDATE_EN = 1` (automatically enabled)

**Usage**:
1. Connect to device via BLE
2. Use JieLi OTA app or custom app
3. Send firmware update file
4. Device reboots with new firmware

### 2. UART Upgrade

**Advantages**:
- Simple protocol
- Good for development

**Requirements**:
- VM size: 20 KB minimum
- UART connection (TX/RX pins)

### 3. USB HID Upgrade

**Advantages**:
- Fast transfer speed
- No drivers needed (HID)

**Requirements**:
- VM size: 28 KB minimum
- USB connection

## Disabling OTA (Current State)

OTA is currently disabled to save code space. The VM size is still set to 68 KB to:
1. Remove build warnings
2. Allow easy OTA enablement in future
3. Provide space for user data storage

If you want to reclaim the VM space:

Edit: `SDK/cpu/bd19/tools/isd_config.ini`

```ini
VM_LEN = 8K;    # Minimum for basic operation
```

This will reduce VM storage to 8 KB, which is sufficient for basic operation without OTA.

## Flash Space Analysis

With current configuration:

```
Firmware Size:     232 KB (0x3A000)
VM Storage:         68 KB (0x11000)
BTIF Reserved:       4 KB (0x1000)
Total Used:        304 KB (0x4C000)
Available:         208 KB (0x34000)
```

**Conclusion**: Plenty of flash space available. The 68 KB VM allocation is reasonable and enables future OTA capability.

## Troubleshooting

### Build Warnings About OTA

If you see warnings like:
```
FAIL: BLE RCSP升级（大小=0x10640）需要最小空间为 0x11000
```

**Solution**: These are informational warnings. If OTA is disabled (`CONFIG_APP_OTA_ENABLE = 0`), they can be ignored. The VM size has been increased to 68 KB to eliminate these warnings.

### OTA Not Working

1. **Check OTA is enabled**: `CONFIG_APP_OTA_ENABLE = 1`
2. **Check VM size**: Must be at least 68 KB for BLE RCSP
3. **Check firmware size**: Must fit in available flash
4. **Check BLE connection**: Device must be connected

### Flash Full Error

If firmware becomes too large:

1. **Disable unused features** in `board_ac632n_demo_global_build_cfg.h`
2. **Reduce VM size** if OTA not needed
3. **Optimize code** to reduce size

## References

- JieLi SDK Documentation: `SDK/doc/`
- OTA Implementation: `SDK/apps/common/update/`
- RCSP Protocol: `SDK/apps/common/third_party_profile/`
