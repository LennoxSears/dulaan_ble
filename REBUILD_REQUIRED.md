# ⚠️ FIRMWARE REBUILD REQUIRED

## Issue

You're still getting **OTA error 0x02** because the device has the **old firmware** with VM=272KB configuration.

The configuration files were updated at **12:02**, but the firmware on the device was built at **11:19** (before the changes).

---

## Root Cause

**Configuration changes made**:
- ✅ `CONFIG_VM_LEAST_SIZE`: 272K → 240K
- ✅ `VM_LEN`: 272K → 240K  
- ✅ `VM_OTA_MAX_SIZE`: (272*1024) → (240*1024)

**But the device firmware still has**:
- ❌ Old VM configuration (272KB)
- ❌ Old `VM_OTA_MAX_SIZE` check (272KB)

**Result**: The device's SDK still thinks VM is 272KB, but actual available space is only ~240KB.

---

## Solution: Rebuild and Reflash Firmware

### Step 1: Clean Previous Build

```bash
cd SDK
make clean_ac632n_spp_and_le
```

### Step 2: Rebuild Firmware

```bash
make ac632n_spp_and_le
```

**Expected output**:
- Firmware size: ~217KB (should be similar to before)
- VM size: 240KB (new configuration)
- Build completes without errors

### Step 3: Verify Build Output

```bash
ls -lh SDK/cpu/bd19/tools/app.bin
# Should show new timestamp (after 12:02)

stat SDK/cpu/bd19/tools/app.bin
# Verify modification time is recent
```

### Step 4: Flash to Device

**Using JieLi ISD Tool**:
1. Connect device via USB
2. Open JieLi ISD download tool
3. Select `SDK/cpu/bd19/tools/download/data_trans/jl_isd.ufw`
4. Click "Download"
5. Wait for completion

**Or using UART programmer** (if applicable):
```bash
# Flash the new firmware
# (specific commands depend on your programmer)
```

### Step 5: Test OTA

After flashing the new firmware:
1. Power cycle the device
2. Connect via BLE
3. Try OTA update with your 217KB firmware
4. Should now succeed without error 0x02

---

## Why This Happened

The configuration changes only affect the **build process**, not the **running firmware**.

**Timeline**:
```
11:19 - Firmware built with VM=272KB
12:02 - Configuration changed to VM=240KB
12:20 - Tried OTA update (device still has 11:19 firmware)
       ❌ Error 0x02 (device thinks VM=272KB, actual=240KB)
```

**After rebuild**:
```
New firmware built with VM=240KB
Flash to device
Try OTA update
✅ Success (device knows VM=240KB, actual=240KB)
```

---

## Verification Checklist

Before testing OTA:

- [ ] Configuration files updated (already done ✅)
- [ ] Firmware rebuilt with new configuration
- [ ] Build timestamp is after 12:02
- [ ] New firmware flashed to device
- [ ] Device power cycled
- [ ] BLE connection established
- [ ] OTA update attempted

---

## Expected Results After Rebuild

**Configuration alignment**:
```
VM_OTA_MAX_SIZE (code):     240KB ✅
CONFIG_VM_LEAST_SIZE:       240KB ✅
VM_LEN (flash layout):      240KB ✅
Actual VM available:        240KB ✅
```

**OTA size check**:
```
Firmware size:              217KB
Application check:          217KB < 240KB ✅ PASS
SDK space check:            217KB < 240KB ✅ PASS
Result:                     OTA succeeds ✅
```

---

## Alternative: Use Pre-built Firmware (If Available)

If you have a pre-built firmware with the correct configuration:

1. Check if `app.bin` timestamp is after 12:02
2. If yes, just reflash it
3. If no, rebuild is required

---

## Notes

- The configuration changes are **permanent** (committed to git)
- All future builds will use VM=240KB
- This rebuild is only needed **once** to update the device
- After this, OTA updates will work normally

---

## Summary

**Problem**: Device has old firmware (VM=272KB config)  
**Solution**: Rebuild firmware with new config (VM=240KB)  
**Action**: Run `make clean_ac632n_spp_and_le && make ac632n_spp_and_le`  
**Then**: Flash new firmware to device  
**Result**: OTA will work ✅
