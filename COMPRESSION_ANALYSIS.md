# Custom Compression for OTA - Feasibility Analysis

## Question: Can we implement our own compression?

**Short Answer**: Technically possible, but **NOT RECOMMENDED** due to high complexity and risks.

---

## The Concept

### Idea:
1. **Compress** 217KB firmware → ~150KB compressed
2. **Transfer** 150KB via BLE OTA (fits in dual-bank)
3. **Decompress** on device → 217KB firmware
4. **Boot** from decompressed firmware

### Sounds Good, But...

---

## Critical Problems

### Problem 1: Where to Decompress? 🚫

**The Catch-22**:

```
Flash Layout (512KB):
├─ Bootloader: 20KB
├─ Bank A: 120KB (current firmware running)
├─ Bank B: 120KB (OTA writes compressed here)
├─ BTIF: 4KB
└─ Free: ~128KB

Decompression needs:
- Input: 150KB compressed (in Bank B)
- Output: 217KB decompressed (WHERE?!)
- Temp buffer: ~32KB for decompression
```

**Problem**: 217KB decompressed firmware doesn't fit anywhere!
- Bank A: 120KB (too small)
- Bank B: 120KB (too small)
- Free space: 128KB (too small)
- **Total available**: 240KB (still too small for 217KB + running firmware)

**You need 217KB contiguous space** to write decompressed firmware, but you don't have it.

---

### Problem 2: Decompressor Code Size 📦

**Decompression library adds to firmware size**:

| Algorithm | Decompressor Size | Compression Ratio | Net Savings |
|-----------|------------------|-------------------|-------------|
| LZ4 | ~8KB | 1.3x (217→167KB) | 167+8=175KB ❌ |
| LZMA | ~15KB | 2.0x (217→109KB) | 109+15=124KB ⚠️ |
| Deflate | ~12KB | 1.5x (217→145KB) | 145+12=157KB ❌ |

**Problem**: Adding decompressor code reduces the savings!

**Example with LZMA**:
- Compressed: 109KB
- Decompressor: 15KB
- **Total**: 124KB (only 4KB under limit!)
- **Risk**: Any firmware growth breaks it again

---

### Problem 3: Decompression Timing ⏱️

**When to decompress?**

#### Option A: During OTA Transfer
```c
// Receive compressed chunk
dual_bank_update_write(compressed_data, len, NULL);

// Decompress in RAM
decompress(compressed_data, decompressed_buffer);

// Write decompressed to flash
flash_write(decompressed_buffer, ...);  // ❌ No direct flash API!
```

**Problem**: 
- SDK's `dual_bank_update_write()` expects final data
- No access to low-level flash write
- Can't intercept and decompress

#### Option B: After OTA, Before Boot
```c
// OTA complete, compressed firmware in Bank B
dual_bank_update_burn_boot_info(NULL);

// Bootloader decompresses Bank B → Bank A
// ❌ We can't modify bootloader!
```

**Problem**:
- Bootloader is compiled, closed-source
- Can't add decompression logic
- Would need custom bootloader (very risky)

#### Option C: On First Boot
```c
// Boot from Bank B (compressed)
// First thing: decompress self to Bank A
// ❌ Can't execute compressed code!
```

**Problem**:
- CPU can't execute compressed code
- Need working firmware to decompress
- Chicken-and-egg problem

---

### Problem 4: Implementation Complexity 🔧

**What you'd need to implement**:

1. **Compression tool** (PC side):
   - Compress app.bin before OTA
   - Calculate new CRC
   - Update size fields

2. **Modified OTA handler**:
   - Receive compressed data
   - Track compressed vs decompressed size
   - Handle decompression errors

3. **Decompression engine** (embedded):
   - Port LZ4/LZMA to JieLi SDK
   - ~8-15KB code size
   - RAM buffer (~32KB needed)
   - Test thoroughly

4. **Custom bootloader** (RISKY):
   - Modify bootloader to decompress
   - Or create two-stage bootloader
   - Risk bricking devices

5. **Flash management**:
   - Find space for decompressed output
   - Handle partial writes
   - Verify integrity

**Estimated effort**: 2-4 weeks of development + testing

---

### Problem 5: Risks ⚠️

**What can go wrong**:

1. **Decompression failure** → Bricked device
2. **Power loss during decompress** → Bricked device
3. **Corrupted compressed data** → Bricked device
4. **Out of memory** → Crash during OTA
5. **Flash wear** → Multiple write cycles
6. **Bootloader issues** → Unrecoverable

**Recovery**: Requires UART/USB programming (no remote recovery)

---

## Size Analysis

### Current Firmware: 217KB

**Best case compression (LZMA)**:
- Compressed: ~109KB (2.0x ratio)
- Decompressor: ~15KB
- **Net firmware**: 124KB

**Dual-bank requirement**: 124KB × 2 = 248KB

**Available**: 240KB

**Result**: ❌ Still 8KB too large!

**Even with compression, you're still over the limit.**

---

### Realistic Compression (LZ4):
- Compressed: ~167KB (1.3x ratio)
- Decompressor: ~8KB
- **Net firmware**: 175KB

**Dual-bank requirement**: 175KB × 2 = 350KB

**Available**: 240KB

**Result**: ❌ Way over limit!

---

## Alternative: Compress Only Data

### Idea: Compress non-code sections

**Firmware structure**:
```
app.bin (217KB):
├─ Code: ~180KB (can't compress - must be executable)
├─ Data: ~30KB (could compress)
└─ Resources: ~7KB (could compress)
```

**Compression of data only**:
- Data: 30KB → 20KB (1.5x)
- Resources: 7KB → 5KB (1.4x)
- **Savings**: 12KB

**New size**: 217KB - 12KB = 205KB

**Dual-bank**: 205KB × 2 = 410KB

**Result**: ❌ Still too large!

---

## The Math Doesn't Work

### Bottom Line:

**To fit in dual-bank OTA on 512KB flash**:
- Maximum: ~120KB firmware
- Your firmware: 217KB
- **Gap**: 97KB

**Best compression (LZMA)**:
- Saves: ~93KB (217→124KB)
- **Still short**: 4KB over limit
- Plus: Decompressor adds complexity and risk

**Conclusion**: Even with perfect compression, you're at the limit with no margin.

---

## Why Hardware Upgrade is Better

### Option A: Custom Compression
- **Cost**: $0 hardware
- **Development**: 2-4 weeks
- **Risk**: High (bricking, bugs)
- **Result**: Barely fits (124KB vs 120KB limit)
- **Maintenance**: Complex, fragile
- **Future**: No room for growth

### Option B: 1MB Flash (AC6328A)
- **Cost**: $0.20 per unit
- **Development**: 0 days (just config change)
- **Risk**: None (standard SDK)
- **Result**: 217KB fits easily (500KB limit)
- **Maintenance**: Simple, standard
- **Future**: Room for 2x growth

**ROI Calculation**:
- Development cost: 2 weeks × $X = $$$
- Per-unit savings: $0.20
- Break-even: $$$ / $0.20 = thousands of units
- **Verdict**: Hardware upgrade is cheaper unless making 10,000+ units

---

## Technical Feasibility: Possible But Not Practical

### Could You Do It? Yes, technically.

**Approach**:
1. Use LZMA compression (best ratio)
2. Compress firmware on PC before OTA
3. Receive compressed data via BLE
4. Store in Bank B
5. Create custom bootloader that:
   - Decompresses Bank B → temporary location
   - Copies to Bank A
   - Boots from Bank A

**Challenges**:
- Need to modify bootloader (risky)
- Need 217KB contiguous space (don't have it)
- Need 32KB RAM for decompression (might not have it)
- Need to handle all error cases
- Need extensive testing

### Should You Do It? No.

**Reasons**:
1. **Still over limit** (124KB vs 120KB)
2. **High complexity** (bootloader modification)
3. **High risk** (bricking potential)
4. **No margin** (any growth breaks it)
5. **Better alternative exists** ($0.20 hardware upgrade)

---

## Recommendation

### ❌ DO NOT implement custom compression

**Instead**:

### ✅ Upgrade to AC6328A (1MB flash)

**Why**:
- **Simpler**: Just config changes
- **Safer**: Standard SDK, no custom bootloader
- **Cheaper**: $0.20 vs weeks of development
- **Better**: 500KB limit vs 120KB
- **Future-proof**: Room for growth

### If Hardware Upgrade Not Possible:

**Option 1**: Reduce firmware size to <120KB
- Remove features
- Aggressive optimization
- Difficult but doable

**Option 2**: Use UART OTA
- Factory programming only
- No field updates
- $0 cost

---

## Conclusion

**Custom compression is technically possible but practically inadvisable.**

The complexity, risk, and development cost far outweigh the $0.20 hardware upgrade, especially when compression barely gets you under the limit with no safety margin.

**Final Answer**: Stop pursuing compression. Upgrade to 1MB flash.

---

## If You Insist on Compression...

### Minimal Viable Approach:

1. **Use LZ4** (smallest decompressor)
2. **Compress only data sections** (not code)
3. **Keep dual-bank standard** (no bootloader mods)
4. **Accept limitations** (still might not fit)

**Expected result**: Save ~10-15KB, still too large.

**Time investment**: 1-2 weeks

**Success probability**: 30% (likely still over limit)

**Recommendation**: Don't do it. Upgrade hardware.
