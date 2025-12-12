# OTA Configuration for AC632N

## Flash Layout

The AC632N chip has the following flash configuration:

```
Total Flash: 512 KB (0x80000)
├── Firmware: 232 KB (0x3A000)
├── VM Storage: 80 KB (0x14000) - for OTA and data storage
├── BTIF Reserved: 4 KB (0x1000) - Bluetooth interface
└── Remaining: ~196 KB
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
VM_LEN = 80K;    # Increased to 80K to support all OTA methods
VM_OPT = 1;
```

**✅ CHANGE APPLIED**: VM_LEN increased from 68K to 80K to ensure sufficient space for all OTA methods.

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

## OTA Status

OTA is currently **ENABLED** in the application.

### Current Configuration

File: `SDK/apps/spp_and_le/board/bd19/board_ac632n_demo_global_build_cfg.h`

```c
#define CONFIG_APP_OTA_ENABLE    1       // ENABLED for BLE OTA updates
#define CONFIG_FLASH_SIZE        FLASH_SIZE_512K  // Match actual hardware
```

This automatically enables:
- `RCSP_BTMATE_EN = 1` (RCSP protocol support)
- `RCSP_UPDATE_EN = 1` (OTA update support)
- `UPDATE_MD5_ENABLE = 0` (MD5 check disabled)

### To Rebuild Firmware

```bash
cd SDK
make ac632n_spp_and_le
```

### To Flash to Device

Use the JieLi download tool to flash the new firmware.

## How to Use OTA

### Quick Start

1. **Build firmware** with OTA enabled (already done)
2. **Flash to device** using JieLi download tool
3. **Connect via BLE** to device (name: "VibMotor")
4. **Use JieLi OTA app** or custom app to send firmware update
5. **Device reboots** automatically with new firmware

### OTA Service UUID

The RCSP OTA service uses JieLi's proprietary protocol. You can:
- Use **JieLi's official OTA app** (recommended for testing)
- Integrate **RCSP protocol** into your custom app
- Use **JieLi's SDK examples** as reference

### Firmware File Format

The OTA update file is generated during build:
- File: `SDK/cpu/bd19/tools/download/jl_isd.ufw`
- Format: JieLi UFW (Update Firmware) format
- Contains: Firmware binary + metadata

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

## Disabling OTA

If you want to disable OTA to save code space:

### Step 1: Disable in Board Configuration

Edit: `SDK/apps/spp_and_le/board/bd19/board_ac632n_demo_global_build_cfg.h`

```c
#define CONFIG_APP_OTA_ENABLE    0       // Disable OTA
```

### Step 2: (Optional) Reduce VM Size

If you want to reclaim VM space, edit: `SDK/cpu/bd19/tools/isd_config.ini`

```ini
VM_LEN = 8K;    # Minimum for basic operation
```

This will reduce VM storage to 8 KB, which is sufficient for basic operation without OTA.

### Step 3: Rebuild

```bash
cd SDK
make ac632n_spp_and_le
```

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
