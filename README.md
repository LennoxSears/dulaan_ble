# Dulaan BLE - Vibration Motor Control Firmware

Bluetooth Low Energy (BLE) firmware for vibration motor control on JieLi AC632N chip.

## 📚 Documentation

- **[Quick Start](docs/OTA_QUICK_START.md)** - Get started with OTA updates
- **[Documentation Index](docs/README.md)** - Complete documentation guide
- **[OTA Troubleshooting](docs/ota/OTA_UART_DEBUG_GUIDE.md)** - Debug flash erase errors

---

## Hardware

- **Chip**: JieLi AC632N (BD19 series)
- **PWM Pin**: PB5 (IO_PORTB_05)
- **PWM Timer**: TIMER3
- **PWM Frequency**: 1kHz
- **Motor Control**: Via MOS transistor gate connected to PB5

---

## Features

### BLE Communication
- **Device Name**: "VibMotor"
- **Security**: LESC (LE Secure Connections) + Just-Works pairing
- **Encryption**: AES-CCM 128-bit (automatic)
- **Service UUID**: `9A501A2D-594F-4E2B-B123-5F739A2D594F`

### Motor Control
- **PWM Resolution**: 0.01% (0-10000 range)
- **Control Method**: 2-byte BLE packet (little-endian uint16)
- **Response Time**: < 1ms from command to PWM update

### OTA Support
- **Protocol**: Custom BLE OTA (simple 3-command protocol)
- **Characteristic UUID**: `9A531A2D-594F-4E2B-B123-5F739A2D594F`
- **VM Storage**: 240KB flash
- **Compatible**: Any BLE app (nRF Connect, custom app)
- **Features**: Progress notifications, CRC32 verification, auto-reboot

### Battery Monitoring
- **Source**: SDK power management (ADC-based)
- **Range**: 0-100%
- **Update**: Real-time via `get_vbat_percent()`

---

## BLE Security & Pairing

### Pairing Flow

1. Device advertises as "VibMotor" (LE General Discoverable)
2. Phone connects to device (no prompt yet)
3. App sends first command (motor control or device info)
4. BLE stack triggers LESC pairing (`slave_set_wait_security = 1`)
5. System prompt: "Pair with VibMotor?" (Just-Works, no PIN)
6. Pairing success → BLE stack stores LTK (Long Term Key)
7. Subsequent connections: Automatic encryption, no prompts

**Note**: Pairing is triggered on first write, not on connection. This prevents double pairing prompts.

### Security Features

All security handled by BLE stack (no application-layer security):

- **Link Encryption**: AES-CCM 128-bit (automatic)
- **Key Exchange**: P-256 ECDH (LESC)
- **Authentication**: Just-Works (no MITM protection)
- **Replay Protection**: Link-layer packet counter (automatic)
- **Data Integrity**: AES-CCM MIC (automatic)
- **Key Storage**: LTK managed by BLE stack (automatic)

### Security Configuration

```c
// In SDK configuration
slave_set_wait_security = 1;  // Force encryption
authentication_req_flags = SM_AUTHREQ_BONDING | SM_AUTHREQ_SECURE_CONNECTION;
io_capabilities = IO_CAPABILITY_NO_INPUT_NO_OUTPUT;  // Just-Works
```

**Production checklist**:
- Enable chip RDP/APPROTECT
- App should filter by Service UUID `9A501A2D-594F-4E2B-B123-5F739A2D594F`

---

## BLE Protocol

### Service: Motor Control (9A50...)

#### Characteristic 1: Motor Control (9A51...)
- **UUID**: `9A511A2D-594F-4E2B-B123-5F739A2D594F`
- **Property**: Write Without Response
- **Format**: 2 bytes (little-endian uint16)
- **Range**: 0-10000 (0.00% - 100.00% duty cycle)

**Examples**:
```
0x00 0x00  →  0% (motor off)
0x88 0x13  →  50% (5000)
0x10 0x27  →  100% (10000)
```

#### Characteristic 2: Device Info (9A52...)
- **UUID**: `9A521A2D-594F-4E2B-B123-5F739A2D594F`
- **Property**: Write + Notify
- **Request**: 2 bytes (0xB0 0x00)
- **Response**: 6 bytes (via notification)

**Request** (write 0xB0 0x00 to trigger):
```
B0 00  → Query device info
```

**Response** (notification):
```
B0 00 01 00 01 55
│  │  │  │  │  └─ Battery: 85% (0x55)
│  │  │  │  └──── Firmware HIGH: 1
│  │  │  └─────── Firmware LOW: 0
│  │  └────────── Motor count: 1
│  └───────────── Command: 0x00
└──────────────── Header: 0xB0
```

#### Characteristic 3: OTA Update (9A53...)
- **UUID**: `9A531A2D-594F-4E2B-B123-5F739A2D594F`
- **Property**: Write + Notify
- **Purpose**: Custom OTA firmware updates

**Commands**:
```
Start:  01 [size_low] [size_high] [size_mid] [size_top]
Data:   02 [seq_low] [seq_high] [data...]
Finish: 03 [crc_low] [crc_high] [crc_mid] [crc_top]
```

**Notifications**:
```
Ready:    01 00
Progress: 02 [percent]
Success:  03 00
Error:    FF [error_code]
```

---

## Quick Start

### 1. Build Firmware

```bash
cd SDK
make clean_ac632n_spp_and_le
make ac632n_spp_and_le
```

**Output**: 
- Firmware: `SDK/cpu/bd19/tools/app.bin` (for OTA)
- Flash file: `SDK/cpu/bd19/tools/download/data_trans/jl_isd.ufw` (for initial programming)

### 2. Flash to Device

Use JieLi download tool to flash the firmware via USB.

### 3. Test OTA Update

**Using Web Tool** (easiest):
1. Open `extras/ota-web-tool.html` in Chrome/Edge
2. Click "Connect" → select "VibMotor"
3. Select `app.bin` → click "Start Update"
4. Wait for completion (~10-15 seconds)

**Using nRF Connect or LightBlue**:

1. Scan for "VibMotor"
2. Connect (accept pairing prompt)
3. Find service `9A50...`
4. Write to `9A51...`: `88 13` (50% duty)
5. Motor should vibrate at 50% power

**Get Device Info**:
1. Find characteristic `9A52...`
2. Enable notifications
3. Write `B0 00` to trigger device info
4. Receive notification with firmware version and battery level

---

## Configuration

### Change PWM Pin

Edit `SDK/apps/spp_and_le/examples/motor_control/vibration_motor_ble/vm_config.h`:

```c
#define VM_MOTOR_PWM_PIN  IO_PORTB_05  /* Change to your pin */
```

**Supported pins**: Any pin with TIMER3 PWM capability (PA5, PA6, PB5, PB6, etc.)

### Change PWM Frequency

```c
#define VM_MOTOR_PWM_FREQ_HZ  1000  /* Change frequency */
```

### Enable/Disable OTA

Edit `SDK/apps/spp_and_le/board/bd19/board_ac632n_demo_global_build_cfg.h`:

```c
#define CONFIG_APP_OTA_ENABLE  1  /* 1=enabled, 0=disabled */
```

---

## Architecture

### Code Structure

```
SDK/apps/spp_and_le/examples/motor_control/
├── app_motor.c                    # Application entry point
├── ble_motor.c                    # BLE stack integration
└── vibration_motor_ble/
    ├── vm_ble_service.c           # GATT service handlers
    ├── vm_ble_profile.h           # GATT database definition
    ├── vm_motor_control.c         # PWM motor control
    └── vm_config.h                # Hardware configuration
```

### Execution Flow

```
App Command (BLE Write)
    ↓
BLE Stack
    ↓
vm_att_write_callback()
    ↓
vm_ble_handle_motor_write()
    ↓ (validates packet)
vm_motor_set_duty()
    ↓
set_timer_pwm_duty()
    ↓ (writes TIMER3->PWM register)
Hardware PWM Output (PB5)
    ↓
MOS Transistor → Motor
```

**Latency**: < 1ms from BLE command to PWM update

### OTA Update Flow

```
App sends START command
    ↓
vm_att_write_callback()
    ↓
vm_ble_handle_ota_write()
    ↓ (validates size < 240KB)
vm_ota_start()
    ↓ (erases VM flash area)
Sends notification: 01 00 (Ready)
    ↓
App sends DATA packets (20 bytes each)
    ↓
vm_ota_write_data()
    ↓ (writes to flash, tracks progress)
Sends notifications: 02 [percent]
    ↓
App sends FINISH command with CRC32
    ↓
vm_ota_finish()
    ↓ (verifies CRC32)
Sends notification: 03 00 (Success)
    ↓
cpu_reset() after 500ms
    ↓
Bootloader loads new firmware from VM
```

**Update time**: ~10-15 seconds for 60KB firmware

---

## PWM Details

### Timer Configuration

- **Timer**: TIMER3
- **Clock**: 24MHz / 4 = 6MHz
- **Period**: 6000 counts (1kHz)
- **Resolution**: 0.01% (10000 steps)

### PWM Calculation

```
Frequency = Clock / Period
          = 6MHz / 6000
          = 1kHz

Duty Cycle = (PWM_Register / Period) × 100%
           = (3000 / 6000) × 100%
           = 50%
```

### Hardware Output (50% duty)

```
3.3V ┐      ┌──────┐      ┌──────
     │      │      │      │
0V   └──────┘      └──────┘
     |<-0.5ms->|<-0.5ms->|
     (50% @ 1kHz)
```

---

## Battery Monitoring

### Implementation

Uses SDK's built-in power management:

```c
// Initialized automatically by board_power_init()
uint8_t battery = get_vbat_percent();  // Returns 0-100%
```

### Battery Thresholds

- **Full**: 4.2V (100%)
- **Warning**: 2.4V (~20%)
- **Shutdown**: 2.0V (0%)

### Voltage Divider

SDK uses 4:10 ratio (multiply by 2.5):
```
ADC reads divided voltage → multiply by 2.5 → actual battery voltage
```

---

## OTA Updates

### Custom OTA Protocol

Simple BLE-based OTA without proprietary protocols or encryption keys.

**Features**:
- ✅ No JieLi RCSP dependency
- ✅ No encryption key required
- ✅ Works with any BLE app (nRF Connect, LightBlue, custom app)
- ✅ Simple 3-command protocol
- ✅ Progress notifications
- ✅ CRC32 verification

### How It Works

1. App connects to device via BLE
2. Enable notifications on OTA characteristic (`9A53...`)
3. Send START command with firmware size
4. Device erases flash and sends READY notification
5. App sends firmware in chunks (240 bytes each)
6. Device sends progress notifications (every 10%)
7. App sends FINISH command with CRC32
8. Device verifies CRC and reboots

### Protocol Commands

**Start OTA**:
```
Write: 01 [size_low] [size_high] [size_mid] [size_top]
Response: 01 00 (Ready)
```

**Send Data**:
```
Write: 02 [seq_low] [seq_high] [data...] (up to 240 bytes data)
Response: 02 [progress%] (every 10%)
```

**Finish OTA**:
```
Write: 03 [crc_low] [crc_high] [crc_mid] [crc_top]
Response: 03 00 (Success) or FF [error_code] (Error)
```

### Firmware File

After building, use the raw binary:
```
SDK/cpu/bd19/tools/app.bin
```

**No encryption, no special format** - just the raw firmware binary.

### Web-Based OTA Tool (Recommended)

**Location**: `extras/ota-web-tool.html`

**Online Access (Easiest)**:
- **URL**: `https://lennoxsears.github.io/dulaan_ble/extras/ota-web-tool.html`
- Works in China mainland
- No setup needed - just open URL in Chrome
- See `extras/DEPLOYMENT.md` for setup instructions

**Simple 3-step process**:
1. Open URL in Chrome/Edge (Android or Desktop)
2. Click "Connect" → select "VibMotor"
3. Select `app.bin` file → click "Start Update"

**Features**:
- ✅ No installation required
- ✅ Works on Android Chrome
- ✅ Automatic CRC32 calculation
- ✅ Progress bar with percentage
- ✅ Error handling with clear messages
- ✅ Complete logging

**Requirements**:
- Chrome/Edge browser (Android 6.0+ or Desktop)
- HTTPS connection (use online URL or local HTTP server)
- Firmware file < 240KB

**Local Development** (optional):
```bash
# If you need to test locally
cd extras
python3 -m http.server 8000
# Open: http://localhost:8000/ota-web-tool.html
```

For deployment options, see `extras/DEPLOYMENT.md`

### Manual Testing with nRF Connect

For advanced users or debugging:

1. Connect to "VibMotor"
2. Find OTA characteristic `9A53...`
3. Enable notifications
4. Manually send START/DATA/FINISH commands
5. Device reboots with new firmware

See protocol commands above for byte format.

### Custom App Integration

See protocol documentation for implementation details. Basic flow:

```kotlin
// 1. Read firmware file
val firmware = File("app.bin").readBytes()

// 2. Send START
writeOta(byteArrayOf(0x01, size_bytes...))

// 3. Send DATA chunks
for (chunk in firmware.chunked(240)) {
    writeOta(byteArrayOf(0x02, seq_bytes...) + chunk)
}

// 4. Send FINISH
writeOta(byteArrayOf(0x03, crc_bytes...))
```

---

## Troubleshooting

### No PWM Signal on PB5

**Check Serial Logs**:
```
[VM_MOTOR] Initializing PWM: Timer=TIMER3, Pin=PB5, Freq=1000Hz
[VM_MOTOR] PWM initialized successfully
[VM_BLE] Motor write: duty=5000 (0x88 0x13)
[VM_MOTOR] Setting duty: 5000/10000 (50.00%)
[VM_MOTOR] PWM duty updated, PRD=6000, PWM=3000
```

**If logs appear but no signal**:
- Verify measuring correct pin (PB5, not PB4)
- Use oscilloscope (not multimeter)
- Check oscilloscope: 10x probe, DC coupling, 1kHz trigger
- Verify hardware connection

**If no logs**:
- BLE command not reaching device
- Check BLE connection
- Verify characteristic UUID
- Check packet format (2 bytes, little-endian)

### Signal on PB4 Instead of PB5

**Cause**: Cross-talk from PB5 to PB4 (adjacent pins)

**Solution**: Force PB4 to output LOW:
```c
// In app_motor.c, motor_app_start()
gpio_direction_output(IO_PORTB_04, 0);
gpio_set_output_value(IO_PORTB_04, 0);
```

### OTA Fails

**Check**:
1. VM size: 240KB in `isd_config.ini`
2. OTA characteristic present: `9A53...`
3. Notifications enabled on OTA characteristic
4. Using correct file: `app.bin` (raw binary)
5. Firmware size < 240KB
6. CRC32 calculated correctly

**Verify OTA characteristic**:
- Connect with nRF Connect
- Look for service `9A50...`
- Should see OTA characteristic `9A53...`
- Enable notifications before sending commands

**Common errors**:
- Error 0x02: Firmware size too large (> 240KB)
- Error 0x05: Flash write failed (check VM area)
- Error 0x09: CRC mismatch (recalculate CRC32)
- No response: Notifications not enabled

### Battery Always Shows 85%

**Cause**: No battery connected (placeholder value)

**Solution**: Battery monitoring works automatically when battery is connected. SDK reads actual voltage via ADC.

---

## Serial Debug

### UART Configuration

- **TX Pin**: Usually PB7
- **Baud Rate**: 1000000 (1Mbps)
- **Format**: 8N1

### Expected Logs

**Startup**:
```
[MOTOR_APP] =======================================
[MOTOR_APP] -------Motor Control BLE Demo---------
[MOTOR_APP] =======================================
[VM_MOTOR] Initializing PWM: Timer=TIMER3, Pin=PB5, Freq=1000Hz
[VM_MOTOR] PWM initialized successfully
[BLE_MOTOR] bt_ble_init
[BLE_MOTOR] motor_server_init
[VM_BLE] VM BLE service initialized - LESC + Just-Works
```

**Motor Control**:
```
[VM_BLE] Motor write: duty=5000 (0x88 0x13)
[VM_MOTOR] Setting duty: 5000/10000 (50.00%)
[VM_MOTOR] PWM duty updated, PRD=6000, PWM=3000
[VM_BLE] Motor duty set to 5000 (50.00%)
```

---

## Technical Specifications

### Chip: JieLi AC632N
- **Core**: RISC-V
- **Flash**: 512KB
- **RAM**: 64KB
- **BLE**: 5.0 compatible
- **Frequency**: 24MHz

### Flash Layout
```
Total: 512KB
├── Firmware: ~232KB
├── VM (OTA): 240KB
├── BTIF: 4KB
└── Available: ~196KB
```

### Power Consumption
- **Active (BLE connected)**: ~10mA
- **Advertising**: ~5mA
- **Sleep**: < 1mA
- **Motor (depends on duty cycle)**: Variable

---

## Development

### Prerequisites

- JieLi SDK (included in this repo)
- JieLi toolchain (clang-based)
- Code::Blocks IDE (optional)
- JieLi download tool (for flashing)

### Build System

```bash
# Clean build
make clean_ac632n_spp_and_le

# Build firmware
make ac632n_spp_and_le

# Output files
SDK/cpu/bd19/tools/app.bin                          # For OTA updates
SDK/cpu/bd19/tools/download/data_trans/jl_isd.ufw  # For USB flashing
```

### Modifying Code

**Change motor control logic**:
- Edit `vm_motor_control.c`

**Change BLE behavior**:
- Edit `ble_motor.c` or `vm_ble_service.c`

**Change GATT profile**:
- Edit `vm_ble_profile.h`

**Change hardware config**:
- Edit `vm_config.h`

---

## Protocol Design Goals

1. **Standard BLE Security**: LESC + Just-Works
2. **Minimal User Interaction**: First connection = 1 system prompt, subsequent = instant
3. **Single-Packet Control**: 2-byte duty cycle command
4. **No Application Security Logic**: Fully rely on BLE stack
5. **Simple Device Info**: 6-byte read response with firmware version and battery

---

## Known Issues

### PB4 Signal Detection

**Issue**: Signal detected on PB4 when motor is running

**Cause**: Cross-talk from PB5 (adjacent pin, high-impedance)

**Impact**: None (PB4 not used)

**Fix**: Force PB4 to output LOW if needed

### Battery Reading

**Issue**: Shows 85% when no battery connected

**Cause**: Placeholder value in SDK

**Impact**: None (real battery works automatically)

---

## License

Copyright (c) JIELI 2011-2019

---

## Support

For issues or questions:
1. Check serial logs for error messages
2. Verify hardware connections
3. Test with known-good BLE app (nRF Connect)
4. Check this README for troubleshooting steps

---

## Summary

This firmware provides:
- ✅ BLE motor control with 0.01% resolution
- ✅ LESC + Just-Works security
- ✅ Custom OTA update (simple 3-command protocol)
- ✅ Real-time battery monitoring
- ✅ < 1ms command latency
- ✅ Standard BLE GATT protocol
- ✅ No proprietary dependencies

**Ready to use with any BLE app that supports custom GATT services.**
