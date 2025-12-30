# Rebuild and Flash Instructions

## Current Situation

**Problem**: Device has old firmware with WRITE property, but code fix changed it to WRITE_WITHOUT_RESPONSE.

**Error**: "Writing characteristic failed" when trying to start OTA.

**Root Cause**: Property mismatch between device firmware and app expectations.

---

## Solution Overview

```
1. Pull latest code (already done ✅)
2. Rebuild firmware with new code
3. Flash firmware via USB (one-time)
4. Test OTA update (should work now)
```

---

## Step 1: Pull Latest Code

Already completed - you have commit `2a159ae` with the fix.

```bash
git pull origin main
git log --oneline -1
# Should show: 2a159ae Fix OTA timeout by changing characteristic to WRITE_WITHOUT_RESPONSE
```

---

## Step 2: Rebuild Firmware

### Prerequisites

**JieLi Toolchain Required**:
- Download from: http://pkgman.jieliapp.com/doc/all
- Install to: `/opt/jieli/` (Linux) or equivalent (Windows)
- Verify: `/opt/jieli/common/bin/clang` exists

### Build Commands

```bash
cd SDK

# Clean previous build
make clean_ac632n_spp_and_le

# Build new firmware
make ac632n_spp_and_le
```

### Expected Output

```
+PRE-BUILD
...
[Compiling files...]
...
+POST-BUILD
[Creating firmware files...]
...
+BUILD SUCCESS
```

### Output Files

After successful build:

```
SDK/cpu/bd19/tools/
├── app.bin                                    # For OTA updates (222KB)
└── download/
    └── data_trans/
        └── jl_isd.ufw                        # For USB flashing (complete image)
```

### Verify Build

```bash
ls -lh SDK/cpu/bd19/tools/app.bin
# Should show: ~217-222 KB file with recent timestamp

ls -lh SDK/cpu/bd19/tools/download/data_trans/jl_isd.ufw
# Should show: larger file with recent timestamp
```

---

## Step 3: Flash Firmware via USB

### Why USB Flash is Required

**You CANNOT use OTA for this update** because:
- Current device: WRITE property (0x08)
- Your app: Expects WRITE_WITHOUT_RESPONSE (0x04)
- Property mismatch prevents any writes
- OTA requires writes to work

**USB flashing bypasses BLE entirely** - directly programs the chip.

### Hardware Setup

1. **Connect device to PC**:
   - Use USB cable
   - Device should be powered on
   - May need to enter download mode (check hardware documentation)

2. **Install JieLi Download Tool**:
   - Windows: `isd_download.exe` (in SDK/cpu/bd19/tools/)
   - Linux: Use Wine or virtual machine

### Flashing Steps

#### Using JieLi Download Tool (Windows)

1. **Open** `SDK/cpu/bd19/tools/isd_download.exe`

2. **Configure**:
   - Chip: AC632N
   - File: `SDK/cpu/bd19/tools/download/data_trans/jl_isd.ufw`
   - Port: Auto-detect or select COM port

3. **Flash**:
   - Click "Download" button
   - Wait for progress bar to complete
   - Should show "Download Success"

4. **Verify**:
   - Device will reboot automatically
   - LED should blink (if present)
   - Device should advertise as "VibMotor"

#### Using Command Line (Linux)

```bash
cd SDK/cpu/bd19/tools

# Run download script
./download.bat  # Or equivalent Linux script

# Follow on-screen instructions
```

### Troubleshooting Flash Issues

**Device not detected**:
- Check USB cable connection
- Try different USB port
- Install USB drivers (if Windows)
- Check device is in download mode

**Flash fails**:
- Verify file path is correct
- Check file size (~500KB for jl_isd.ufw)
- Try power cycling device
- Check chip model matches (AC632N)

**Flash succeeds but device doesn't boot**:
- Try flashing again
- Check power supply is stable
- Verify firmware file is not corrupted

---

## Step 4: Verify New Firmware

### Method 1: Using nRF Connect (Recommended)

1. **Install nRF Connect** (Android):
   - Download from Google Play Store
   - Free app by Nordic Semiconductor

2. **Scan for device**:
   - Open nRF Connect
   - Tap "SCAN"
   - Find "VibMotor" in list

3. **Connect**:
   - Tap "CONNECT" next to VibMotor
   - Wait for connection

4. **Check service**:
   - Expand "Unknown Service" (9A50...)
   - Find "Unknown Characteristic" (9A53...)

5. **Verify properties**:
   ```
   ✅ Should show: WRITE WITHOUT RESPONSE, NOTIFY
   ❌ Should NOT show: WRITE
   ```

6. **Screenshot for reference**:
   - Take screenshot of properties
   - Confirms new firmware is running

### Method 2: Using Your Capacitor App

1. **Connect to device**:
   - Open your app
   - Scan and connect to VibMotor
   - Should connect successfully

2. **Try OTA update**:
   - Load `app.bin` file
   - Click "Start Update"
   - Should NOT show "Writing characteristic failed"
   - Should show "Device ready" notification

3. **If it works**:
   - ✅ New firmware is running
   - ✅ OTA should complete successfully

4. **If it still fails**:
   - ❌ Flash may have failed
   - ❌ Try USB flashing again

---

## Step 5: Test OTA Update

Now that device has new firmware, test the OTA functionality:

### Using Web Tool

1. **Open** `extras/ota-web-tool.html` in Chrome

2. **Connect**:
   - Click "Connect"
   - Select "VibMotor"
   - Should connect successfully

3. **Load firmware**:
   - Click "Choose File"
   - Select `SDK/cpu/bd19/tools/app.bin`
   - Should show file size (~217 KB)

4. **Start update**:
   - Click "Start Update"
   - Should show progress:
     ```
     ✅ Device ready
     ✅ Sending firmware...
     ✅ Progress: 10%
     ✅ Progress: 20%
     ...
     ✅ Progress: 100%
     ✅ Update complete
     ```

5. **Verify**:
   - Device reboots automatically
   - Reconnect to verify new firmware

### Using Your Capacitor App

Same process as web tool, but in your app.

### Expected Timeline

- Connection: ~2 seconds
- START command: ~1 second
- Data transfer: ~10-15 seconds
- Verification: ~1 second
- Total: ~15-20 seconds

---

## Troubleshooting

### "Writing characteristic failed" (Still)

**Cause**: Device still has old firmware

**Solution**:
1. Verify USB flash completed successfully
2. Check device rebooted after flash
3. Use nRF Connect to verify properties
4. Try flashing again if properties still show WRITE

### OTA Starts but Times Out

**Cause**: Different issue (not property mismatch)

**Solution**:
1. Check firmware size < 240KB
2. Verify flash has enough space
3. Check serial logs for errors
4. Review OTA_TIMEOUT_FIX.md

### Device Won't Connect After Flash

**Cause**: Flash may have corrupted firmware

**Solution**:
1. Power cycle device
2. Try flashing again
3. Check USB cable and connection
4. Verify jl_isd.ufw file is not corrupted

---

## Summary Checklist

### Before OTA Works

- [ ] Pull latest code (commit 2a159ae)
- [ ] Rebuild firmware (make ac632n_spp_and_le)
- [ ] Flash via USB (jl_isd.ufw)
- [ ] Verify properties with nRF Connect
- [ ] Test OTA update

### After First USB Flash

- [x] Device has new firmware
- [x] OTA characteristic has WRITE_WITHOUT_RESPONSE
- [x] OTA updates work via BLE
- [x] No more USB flashing needed (use OTA for future updates)

---

## Important Notes

### One-Time USB Flash

**You only need USB flashing ONCE**:
- First time: USB flash (property mismatch prevents OTA)
- After that: Use OTA for all future updates
- OTA is faster and more convenient

### Future Updates

After this initial USB flash:
1. Make code changes
2. Rebuild firmware (make ac632n_spp_and_le)
3. Use OTA to update (no USB needed)
4. Device reboots with new firmware

### Backup

**Keep a backup of working firmware**:
```bash
cp SDK/cpu/bd19/tools/app.bin backups/app_v1.0_working.bin
cp SDK/cpu/bd19/tools/download/data_trans/jl_isd.ufw backups/jl_isd_v1.0_working.ufw
```

If something goes wrong, you can flash the backup via USB.

---

## Next Steps

1. **Rebuild firmware** on your build machine
2. **Flash via USB** using JieLi download tool
3. **Verify** with nRF Connect
4. **Test OTA** with your app
5. **Report results** - should work now!

---

## Questions?

If you encounter issues:
1. Check this document's troubleshooting section
2. Review OTA_TIMEOUT_FIX.md for technical details
3. Check serial logs for error messages
4. Verify build output files exist and have correct sizes
