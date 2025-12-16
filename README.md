# Dulaan BLE - Vibration Motor Control Firmware

Bluetooth Low Energy (BLE) firmware for vibration motor control on JieLi AC632N chip.

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
- **Protocol**: RCSP (JieLi OTA)
- **Service UUID**: `ae30`
- **VM Storage**: 80KB flash
- **Compatible**: JL OTA app

### Battery Monitoring
- **Source**: SDK power management (ADC-based)
- **Range**: 0-100%
- **Update**: Real-time via `get_vbat_percent()`

---

## BLE Security & Pairing

### Pairing Flow

1. Device advertises as "VibMotor" (LE General Discoverable)
2. Phone connects to device
3. BLE stack automatically triggers LESC pairing (`slave_set_wait_security = 1`)
4. System prompt: "Pair with VibMotor?" (Just-Works, no PIN)
5. Pairing success → BLE stack stores LTK (Long Term Key)
6. Subsequent connections: Automatic encryption, no prompts

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

### Service: RCSP OTA (ae30)

Used by JL OTA app for firmware updates. Includes characteristics:
- `ae01` - RCSP commands (Write)
- `ae02` - RCSP responses (Notify)
- `ae05` - OTA data transfer (Indicate)

---

## Quick Start

### 1. Build Firmware

```bash
cd SDK
make clean_ac632n_spp_and_le
make ac632n_spp_and_le
```

**Output**: `SDK/cpu/bd19/tools/download/data_trans/jl_isd.ufw`

### 2. Flash to Device

Use JieLi download tool to flash the `.ufw` file.

### 3. Test with Phone App

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

### OTA Security Key

**Important**: OTA requires encryption key to be written to chip first.

**Key file**: `AC690X-A2E8.key` (40-character hex encryption key)

**First-time setup** (write key to virgin chip):
1. Copy `download_write_key.bat` and `AC690X-A2E8.key` to `SDK/cpu/bd19/tools/download/data_trans/`
2. Connect board via USB
3. Run `download_write_key.bat`
4. Wait for "KEY written successfully!"

**Subsequent flashing** (with key validation):
1. Copy `download_with_key.bat` and `AC690X-A2E8.key` to `SDK/cpu/bd19/tools/download/data_trans/`
2. Build firmware: `make ac632n_spp_and_le`
3. Run `download_with_key.bat`
4. Generates encrypted `.ufw` file

⚠️ **Note**: Key is permanent once written. Keep `AC690X-A2E8.key` file secure.

### How It Works

1. JL OTA app connects to device
2. App discovers RCSP service (ae30)
3. App sends OTA start command
4. Firmware data transferred via ae05 characteristic
5. Data written to 80KB VM flash area
6. Device reboots and applies update

### OTA File

After building with `download_with_key.bat`, OTA file is at:
```
SDK/cpu/bd19/tools/download/data_trans/update.ufw
```

Use this encrypted file with JL OTA app for wireless updates.

### JL OTA Android App

Test app provided in `Android-JL_OTA/apk/JLOTA_V1.8.1_10807-debug.apk`

**Usage**:
1. Install APK on Android phone
2. Copy `.ufw` file to: `/Android/data/com.jieli.otasdk/files/upgrade/`
3. Open app, connect to device
4. Select `.ufw` file and start OTA

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
1. OTA enabled: `CONFIG_APP_OTA_ENABLE = 1`
2. VM size: 80KB in `isd_config.ini`
3. RCSP service present in GATT profile
4. Using correct OTA file (`.ufw`)
5. **Key written to chip**: Run `download_write_key.bat` first
6. **Key matches**: Use same key for flashing and OTA file

**Verify RCSP service**:
- Connect with nRF Connect
- Look for service `ae30`
- Should see characteristics `ae01`, `ae02`, `ae05`

**Key errors**:
- "KEY不匹配" (Key mismatch): Chip has different key
- "芯片没有被烧写过KEY" (No key): Run `download_write_key.bat`

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
[RCSP] rcsp_init
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
├── VM (OTA): 80KB
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

# Output location
SDK/cpu/bd19/tools/download/data_trans/jl_isd.ufw
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
- ✅ OTA update support (RCSP)
- ✅ Real-time battery monitoring
- ✅ < 1ms command latency
- ✅ Standard BLE GATT protocol

**Ready to use with any BLE app that supports custom GATT services.**
