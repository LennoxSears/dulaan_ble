# Firmware File Format Test Plan

## Objective

Test all 4 firmware file formats to determine which one works with dual-bank OTA update.

---

## Test Files

All files located in: `/workspaces/dulaan_ble/dulaan_ota/`

| File | Size (bytes) | Size (KB) | Format | Expected Use |
|------|--------------|-----------|--------|--------------|
| `app.bin` | 222,372 | 217 KB | Raw binary | JTAG/SWD programming |
| `jl_isd.bin` | 233,472 | 228 KB | ISD format | Unknown |
| `jl_isd.fw` | 460,800 | 450 KB | Firmware package | **OTA updates** |
| `update.ufw` | 460,992 | 451 KB | Update package | **OTA updates** |

---

## Test Configuration

**Current settings:**
- Packet size: 128 bytes
- Delay: 5 seconds between packets
- Retry: 3 attempts per packet

**Expected time per file:**

| File | Packets | Time (5s delay) | Time (hours) |
|------|---------|-----------------|--------------|
| app.bin | 1737 | 8685 sec | 2.4 hours |
| jl_isd.bin | 1825 | 9125 sec | 2.5 hours |
| jl_isd.fw | 3600 | 18000 sec | 5.0 hours |
| update.ufw | 3602 | 18010 sec | 5.0 hours |

---

## Test Procedure

### Test 1: app.bin (Baseline - Known to Fail)

**File:** `app.bin` (222,372 bytes)

**Expected result:** ❌ Crash after 8 packets
- We know this fails
- Crashes at ~1920 bytes
- Use as baseline to confirm issue

**What to watch:**
- Should crash at same point as before
- Confirms issue is reproducible

**Test duration:** ~1 minute (will crash early)

---

### Test 2: jl_isd.bin (ISD Format)

**File:** `jl_isd.bin` (233,472 bytes)

**Expected result:** ❓ Unknown
- Slightly larger than app.bin
- Different format
- Might be intermediate format

**What to watch:**
- Does it crash at same point as app.bin?
- Or does it get further?
- Any different error messages?

**Test duration:** ~2.5 hours (if successful)

---

### Test 3: jl_isd.fw (Firmware Package - Most Likely)

**File:** `jl_isd.fw` (460,800 bytes)

**Expected result:** ✅ Should work!
- 2x larger than app.bin
- Proper firmware package format
- Has header and metadata
- This is what SDK expects

**What to watch:**
- Should NOT crash at 8 packets
- Should continue sending all packets
- Should complete successfully
- Device should reboot with new firmware

**Test duration:** ~5 hours (if successful)

---

### Test 4: update.ufw (Update Package - Alternative)

**File:** `update.ufw` (460,992 bytes)

**Expected result:** ✅ Might work
- Similar size to jl_isd.fw
- Alternative firmware format
- Might be for different update method

**What to watch:**
- Similar to jl_isd.fw test
- Should work if it's valid format
- Compare with jl_isd.fw results

**Test duration:** ~5 hours (if successful)

---

## Test Order (Recommended)

### Quick Tests First (1-2 hours total)

1. **Test 1: app.bin** (~1 minute)
   - Confirm it still crashes
   - Baseline test

2. **Test 2: jl_isd.bin** (~1 minute or 2.5 hours)
   - If crashes early: Similar to app.bin
   - If continues: Let it run to completion

### Full Tests (5 hours each)

3. **Test 3: jl_isd.fw** (~5 hours)
   - Most likely to work
   - Test this first if time limited

4. **Test 4: update.ufw** (~5 hours)
   - Only if jl_isd.fw fails
   - Or to compare formats

---

## How to Test

### In the App

**Load different files:**
1. Open app
2. Click "Load Firmware"
3. Select file:
   - `app.bin` (Test 1)
   - `jl_isd.bin` (Test 2)
   - `jl_isd.fw` (Test 3)
   - `update.ufw` (Test 4)
4. Start OTA update
5. Monitor logs

### What to Log

**For each test, record:**
- File name and size
- Number of packets sent before crash (if crashes)
- Exact timestamp of crash
- Any error messages
- Device behavior after crash

---

## Expected Results Summary

| Test | File | Expected | Reason |
|------|------|----------|--------|
| 1 | app.bin | ❌ Crash at packet 8 | Raw binary, wrong format |
| 2 | jl_isd.bin | ❓ Unknown | Intermediate format |
| 3 | jl_isd.fw | ✅ Success | Proper firmware package |
| 4 | update.ufw | ✅ Success | Alternative firmware package |

---

## Success Criteria

**Test is successful if:**
- ✅ All packets sent without crash
- ✅ Device receives FINISH command
- ✅ Device reboots
- ✅ New firmware is running

**Test fails if:**
- ❌ Device crashes during DATA packets
- ❌ Connection timeout
- ❌ CRC verification fails at FINISH
- ❌ Device doesn't reboot

---

## Optimization After Success

**Once we find working format:**

1. **Reduce delay:**
   - Try 2 seconds → ~2 hours
   - Try 1 second → ~1 hour
   - Try 500ms → ~30 minutes

2. **Increase packet size:**
   - Try 240 bytes → half the packets
   - Faster transfer

3. **Find optimal configuration:**
   - Balance speed vs reliability
   - Target: 15-30 minutes for full OTA

---

## Troubleshooting

### If all files crash at same point:
- Buffer overflow is still an issue
- Need to increase delay further
- Or reduce packet size more

### If jl_isd.fw and update.ufw both fail:
- Might need different SDK API
- Contact JieLi for guidance
- Check if dual-bank is correct method

### If CRC fails at FINISH:
- File format is correct
- But CRC calculation is wrong
- Need to fix CRC handling

---

## Data Collection

**For each test, collect:**

### Browser Logs
```
[timestamp] OTA: Loaded firmware: [filename] ([size])
[timestamp] OTA: Sending [N] packets...
[timestamp] OTA: Sending packet 0...
[timestamp] OTA: Packet 0 sent successfully
...
[timestamp] OTA: Device disconnected (if crashes)
```

### Android Logs
```
Connection updated
onClientConnectionState - status=8 (if crashes)
```

### Analysis
- At which packet did it crash?
- How much data was sent?
- Time from READY to crash?

---

## Quick Reference

**File sizes:**
- app.bin: 217 KB (1737 packets)
- jl_isd.bin: 228 KB (1825 packets)
- jl_isd.fw: 450 KB (3600 packets)
- update.ufw: 451 KB (3602 packets)

**Test duration (5s delay):**
- app.bin: ~1 min (crashes early)
- jl_isd.bin: ~2.5 hours (if works)
- jl_isd.fw: ~5 hours (if works)
- update.ufw: ~5 hours (if works)

**Recommended order:**
1. app.bin (quick baseline)
2. jl_isd.fw (most likely to work)
3. update.ufw (if jl_isd.fw fails)
4. jl_isd.bin (if others fail)

---

## Status

✅ All 4 files copied to dulaan_ota/
✅ Test plan documented
⏳ Ready to start testing

**Start with app.bin to confirm baseline, then test jl_isd.fw!**
