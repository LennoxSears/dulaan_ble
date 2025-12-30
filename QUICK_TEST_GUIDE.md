# Quick Test Guide - 4 Firmware Files

## Files Ready to Test

All files in: `dulaan_ota/`

```
✅ app.bin      217 KB  (baseline - will crash)
✅ jl_isd.bin   228 KB  (unknown format)
✅ jl_isd.fw    450 KB  (most likely to work!)
✅ update.ufw   451 KB  (alternative format)
```

---

## Quick Test Order

### 1️⃣ app.bin (~1 minute)
**Purpose:** Confirm baseline crash
**Expected:** Crash at packet 8
**Action:** Load app.bin → Start OTA → Watch it crash

### 2️⃣ jl_isd.fw (~5 hours)
**Purpose:** Test proper firmware format
**Expected:** Should work!
**Action:** Load jl_isd.fw → Start OTA → Wait 5 hours

### 3️⃣ update.ufw (~5 hours)
**Purpose:** Test alternative format (if jl_isd.fw fails)
**Expected:** Might work
**Action:** Load update.ufw → Start OTA → Wait 5 hours

### 4️⃣ jl_isd.bin (~2.5 hours)
**Purpose:** Test intermediate format (if others fail)
**Expected:** Unknown
**Action:** Load jl_isd.bin → Start OTA → Wait 2.5 hours

---

## What to Watch

### Success Signs ✅
- Packets keep sending (past packet 8)
- No crash/disconnect
- Progress updates
- Completes all packets
- Device reboots

### Failure Signs ❌
- Crash at packet 8 (like app.bin)
- "Device disconnected"
- Connection timeout
- CRC error at FINISH

---

## Expected Results

| File | Size | Packets | Time | Expected |
|------|------|---------|------|----------|
| app.bin | 217 KB | 1737 | 1 min | ❌ Crash |
| jl_isd.bin | 228 KB | 1825 | 2.5 hr | ❓ Unknown |
| jl_isd.fw | 450 KB | 3600 | 5 hr | ✅ **Success** |
| update.ufw | 451 KB | 3602 | 5 hr | ✅ Maybe |

---

## How to Test

1. **Open app**
2. **Connect to device**
3. **Click "Load Firmware"**
4. **Select file** (app.bin, jl_isd.bin, jl_isd.fw, or update.ufw)
5. **Click "Start OTA Update"**
6. **Monitor logs** with timestamps
7. **Record results**

---

## What to Record

For each test:
- ✅ File name
- ✅ File size shown in app
- ✅ Number of packets sent
- ✅ Crash point (if crashes)
- ✅ Timestamps from logs
- ✅ Final result (success/fail)

---

## My Prediction

**app.bin:** ❌ Will crash at packet 8 (confirmed)
**jl_isd.fw:** ✅ Will work! (proper format)
**update.ufw:** ✅ Will work! (alternative format)
**jl_isd.bin:** ❓ Might crash or might work

---

## After Finding Working Format

**Optimize:**
1. Reduce delay: 5s → 2s → 1s
2. Increase packet size: 128 → 240 bytes
3. Target: 15-30 minutes for full OTA

---

## Ready to Test! 🚀

**Start with app.bin (1 min) to confirm baseline**
**Then test jl_isd.fw (5 hours) - most likely to work!**
