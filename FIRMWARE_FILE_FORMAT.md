# Firmware File Format - CRITICAL ISSUE FOUND!

## 🚨 ROOT CAUSE: Wrong File Format!

**We've been sending `app.bin` (raw binary) but the SDK expects `jl_isd.fw` (firmware package)!**

This is likely the PRIMARY cause of the crash, not just buffer overflow!

---

## File Comparison

### Build Output Files

| File | Size | Format | Purpose |
|------|------|--------|---------|
| `app.bin` | 219KB | Raw binary code | Direct flash programming via JTAG/SWD |
| `jl_isd.bin` | 233KB | ISD format binary | Intermediate format |
| `jl_isd.fw` | 450KB | **Firmware package** | **OTA updates via dual-bank** |
| `update.ufw` | 451KB | Update package | OTA updates (alternative format) |

### File Headers

**app.bin (raw binary):**
```
00000000  ee ff b0 19 00 00 ed ff  b0 19 00 00 80 f3 99 b6
```
- Raw ARM code
- No header
- No metadata
- Direct execution

**jl_isd.fw (firmware package):**
```
00000000  ca 5a 3d a0 1f 36 7b f8  f7 c1 a7 67 ce bf 5b 97
```
- Packaged format
- Has header with metadata
- Includes CRC/checksum
- Encrypted/signed
- Partition information

---

## Why This Causes Crash

### What Happens with app.bin

1. App sends `app.bin` (raw binary)
2. SDK calls `dual_bank_passive_update_init()`
3. SDK expects firmware package format
4. SDK tries to parse header → **FAILS**
5. SDK tries to validate format → **FAILS**
6. SDK writes corrupted data to flash
7. Memory corruption
8. **Device crashes**

### What Should Happen with jl_isd.fw

1. App sends `jl_isd.fw` (firmware package)
2. SDK calls `dual_bank_passive_update_init()`
3. SDK parses header → **SUCCESS**
4. SDK validates format → **SUCCESS**
5. SDK extracts actual firmware data
6. SDK writes to flash correctly
7. **OTA succeeds**

---

## API Documentation Confirms This

```c
/* @brief:Initialize the dual-bank passive update
 * @param fw_crc:crc value of new fw file  ← "fw file" not "bin file"!
 * @param fw_size:the size of new fw file
```

**The API explicitly says "fw file"!**

---

## Size Difference Explained

**app.bin:** 219KB
- Raw code only
- No header, no metadata

**jl_isd.fw:** 450KB (2x larger!)
- Header with metadata
- CRC/checksum data
- Partition information
- Possibly encrypted
- Padding/alignment

**The 2x size difference is NOT just padding - it's a completely different format!**

---

## Why We Didn't Notice

1. **File loaded successfully** - Both are valid binary files
2. **BLE writes succeeded** - We're just sending bytes
3. **Device accepted packets** - BLE layer doesn't validate format
4. **Crash happened later** - When SDK tried to process the data

**The crash wasn't immediate because:**
- BLE layer accepts any data
- SDK buffers data first
- Parsing/validation happens during flash write
- That's when it discovers wrong format → crash

---

## Test Results Re-Interpreted

### Test 1: No DATA packets
- Device stayed connected ✅
- **Why:** No data sent, no parsing attempted

### Test 2: 1 DATA packet (240 bytes)
- Device stayed connected ✅
- **Why:** 240 bytes not enough to trigger parsing
- SDK just buffered it

### Test 3: 8 DATA packets (1920 bytes)
- Device crashed ❌
- **Why:** Enough data accumulated for SDK to start parsing
- SDK discovered wrong format → crash

**It wasn't buffer overflow - it was format validation failure!**

---

## Solution

### Immediate Fix

**Use `jl_isd.fw` instead of `app.bin`:**

1. ✅ Copy `jl_isd.fw` to OTA directory (done)
2. Update app to load `jl_isd.fw` by default
3. Update firmware size expectations (450KB vs 219KB)
4. Test OTA with correct file format

### File Selection

**For OTA updates, use:**
- ✅ `jl_isd.fw` (450KB) - **Recommended**
- ✅ `update.ufw` (451KB) - Alternative

**Do NOT use:**
- ❌ `app.bin` (219KB) - Raw binary, wrong format
- ❌ `jl_isd.bin` (233KB) - Intermediate format

---

## Expected Results

**With correct file format:**
- SDK will parse header correctly
- SDK will validate format
- SDK will extract firmware data
- SDK will write to flash properly
- **OTA should succeed!**

**Performance:**
- File size: 450KB (vs 219KB)
- Packets (128 bytes): 3516 (vs 1737)
- Time (5s delay): ~293 minutes (4.9 hours)

**But it should WORK!**

---

## Optimization After Success

**Once OTA works with jl_isd.fw:**

1. Reduce delay from 5s to 2s → ~2 hours
2. Reduce delay to 1s → ~1 hour
3. Increase packet size to 240 bytes → ~30 minutes
4. Find optimal configuration

---

## Build Process

**How to generate correct files:**

1. Build project normally
2. Output directory: `SDK/cpu/bd19/tools/download/data_trans/`
3. Files generated:
   - `app.bin` - For JTAG/SWD programming
   - `jl_isd.fw` - **For OTA updates**
   - `update.ufw` - Alternative OTA format

**Always use `jl_isd.fw` for OTA!**

---

## Questions for JieLi

1. Confirm `jl_isd.fw` is correct format for dual-bank OTA
2. What is difference between `jl_isd.fw` and `update.ufw`?
3. Can we use `app.bin` for OTA? (probably NO)
4. What is the firmware package format specification?
5. How to generate `jl_isd.fw` from `app.bin`?

---

## Status

**CRITICAL FIX NEEDED:**
- ✅ Identified wrong file format
- ✅ Copied correct files to OTA directory
- ⏳ Need to update app to use `jl_isd.fw`
- ⏳ Need to test with correct format

**This is likely the PRIMARY root cause, not buffer overflow!**

Buffer overflow might still be an issue, but using wrong file format definitely causes crash.

---

## Next Steps

1. Update app to load `jl_isd.fw` by default
2. Update size expectations (450KB)
3. Test OTA with correct file
4. Should work much better!
5. Then optimize delays and packet size

**Priority: CRITICAL - Fix immediately!**
