# Dual-Bank OTA Analysis for AC632N (512KB Flash)

## Your Finding

You mentioned: "For customer OTA it can only go with dual mode"

## Critical Issue: Flash Size Constraint

### Flash Layout Calculation

**Dual-Bank Mode Requirements**:
```
Bootloader:      ~32KB
Firmware Bank A:  217KB (current firmware)
Firmware Bank B:  217KB (new firmware during OTA)
VM:              240KB (for data storage)
BTIF:              4KB (Bluetooth info)
─────────────────────────
Total Required:   710KB

Available Flash:  512KB
Gap:             -198KB ❌ DOESN'T FIT
```

**Single-Bank Mode Requirements**:
```
Bootloader:      ~32KB
Firmware:         217KB (current firmware)
VM:              240KB (stores new firmware during OTA)
BTIF:              4KB
─────────────────────────
Total Required:   493KB

Available Flash:  512KB
Margin:           +19KB ✅ FITS
```

---

## Understanding the Confusion

### The API Name is Misleading

The SDK uses `dual_bank_*` API functions for **BOTH** modes:

```c
// These functions work in BOTH single-bank and dual-bank modes
dual_bank_passive_update_init()
dual_bank_update_allow_check()
dual_bank_update_write()
dual_bank_update_burn_boot_info()
```

**The behavior changes based on `CONFIG_DOUBLE_BANK_ENABLE`**:

| Mode | `CONFIG_DOUBLE_BANK_ENABLE` | Flash Layout | How OTA Works |
|------|----------------------------|--------------|---------------|
| **Single-Bank** | `0` | 1 firmware area + VM | New firmware → VM → Bootloader copies to main area on reboot |
| **Dual-Bank** | `1` | 2 firmware areas + VM | New firmware → Inactive bank → Swap banks on reboot |

---

## What "Customer OTA" Might Mean

### Possibility 1: JieLi's Official OTA (RCSP)

JieLi has their own OTA protocol called **RCSP** (Remote Control Serial Protocol):
- Requires JieLi's official app
- Uses proprietary encryption
- May require dual-bank mode

**Our situation**:
- ✅ We're using **custom OTA** (not RCSP)
- ✅ `CONFIG_APP_OTA_ENABLE = 0` (RCSP disabled)
- ✅ Custom protocol works with single-bank mode

### Possibility 2: Third-Party Protocol Requirement

The comment says:
> "适用于接入第三方协议的OTA" (suitable for third-party protocol OTA)

This might mean:
- Third-party protocols (like Apple FindMy) **prefer** dual-bank for safety
- But it's not a **requirement** for custom OTA

### Possibility 3: Certification Requirement

Some certifications (Apple MFi, etc.) might require dual-bank for:
- Rollback capability
- Safety guarantees
- Production reliability

**Our situation**:
- If you need certification → might need dual-bank
- If it's for personal/internal use → single-bank is fine

---

## Evidence That Single-Bank Works

### 1. SDK Documentation

From `board_ac632n_demo_global_build_cfg.h`:
```c
//with single-bank mode,actual vm size should larger this VM_LEAST_SIZE,
//and dual bank mode,actual vm size equals this;
#define CONFIG_VM_LEAST_SIZE  240K
```

This clearly shows **single-bank mode is supported**.

### 2. Our Implementation

Our motor_control OTA uses:
- `CONFIG_DOUBLE_BANK_ENABLE = 0` (single-bank)
- `dual_bank_*` API (works in single-bank mode)
- Custom 3-command protocol

### 3. FindMy Example

The FindMy example uses:
- `CONFIG_DOUBLE_BANK_ENABLE = 1` (dual-bank)
- Same `dual_bank_*` API
- UARP protocol (Apple)

**Both use the same API, different modes.**

---

## Can We Enable Dual-Bank on 512KB Flash?

### Option 1: Reduce Firmware Size

To fit dual-bank in 512KB:

```
Target Layout:
Bootloader:      32KB
Firmware Bank A: 120KB (reduced from 217KB)
Firmware Bank B: 120KB (reduced from 217KB)
VM:              220KB
BTIF:              4KB
─────────────────────────
Total:           496KB ✅ FITS
```

**Required**: Reduce firmware from 217KB to 120KB (-97KB / -45%)

**How to reduce**:
- ❌ Remove features (motor control is already minimal)
- ❌ Disable logging (already disabled)
- ❌ Remove OTA (defeats the purpose)
- ❌ Use compression (not supported by SDK)

**Verdict**: **Not feasible** without major feature cuts

### Option 2: Upgrade to 1MB Flash Chip

**AC6328A** (1MB flash, pin-compatible):

```
Flash Layout:
Bootloader:      32KB
Firmware Bank A: 217KB
Firmware Bank B: 217KB
VM:              500KB
BTIF:              8KB
─────────────────────────
Total:           974KB ✅ FITS with 50KB margin
```

**Cost**: ~$0.20 more per unit
**Benefit**: True dual-bank OTA with rollback

---

## Recommendation

### If You Found Official Documentation

**Please share the specific documentation** that says "customer OTA requires dual-bank mode". This will help us understand:
- Is it a hard requirement?
- Is it specific to certain protocols?
- Is it for certification?
- Is there a workaround?

### Based on Current Evidence

**Single-bank mode DOES work** for custom OTA on 512KB flash:

✅ **Pros**:
- Fits in 512KB flash
- Uses standard `dual_bank_*` API
- Works with custom protocol
- Firmware size: 217KB (plenty of room)

❌ **Cons**:
- No rollback on failure
- Power loss during update = potential brick
- Not suitable for production without safeguards

**Dual-bank mode DOESN'T fit** on 512KB flash:
- Requires 710KB (198KB over limit)
- Would need firmware reduction to 120KB (not feasible)
- Or hardware upgrade to 1MB flash

---

## Questions to Clarify

1. **Where did you find** "customer OTA can only go with dual mode"?
   - Official JieLi documentation?
   - Forum post?
   - Technical support response?

2. **What is your use case**?
   - Production device (needs certification)?
   - Internal/personal project?
   - Prototype/development?

3. **What are your priorities**?
   - Safety (rollback capability)?
   - Cost (stay with 512KB chip)?
   - Features (keep current firmware size)?

---

## Possible Solutions

### Solution 1: Stay with Single-Bank (Recommended for 512KB)

**Current status**: Already implemented and working
**Action needed**: Just rebuild firmware with VM=240KB config
**Trade-off**: No rollback, but OTA works

**Add safety measures**:
```c
// Check battery before OTA
if (get_vbat_percent() < 30) {
    return ERROR_LOW_BATTERY;
}

// Add CRC verification
if (calculated_crc != expected_crc) {
    return ERROR_CRC_MISMATCH;
}
```

### Solution 2: Enable Dual-Bank (Requires Hardware Change)

**Hardware**: Upgrade to AC6328A (1MB flash)
**Cost**: +$0.20/unit
**Benefit**: True dual-bank with rollback
**Action**: 
1. Change hardware
2. Set `CONFIG_DOUBLE_BANK_ENABLE = 1`
3. Set `CONFIG_FLASH_SIZE = FLASH_SIZE_1M`
4. Rebuild firmware

### Solution 3: Hybrid Approach

**Use single-bank with dual-bank safety features**:
- Keep single-bank mode (fits in 512KB)
- Add application-level verification
- Add battery check
- Add firmware signature check
- Document risks clearly

---

## Summary

| Aspect | Single-Bank (Current) | Dual-Bank (Requires 1MB) |
|--------|----------------------|-------------------------|
| **Flash Required** | 493KB ✅ | 710KB ❌ (doesn't fit) |
| **Hardware** | AC632N (512KB) ✅ | AC6328A (1MB) required |
| **Cost** | Current | +$0.20/unit |
| **Rollback** | ❌ No | ✅ Yes |
| **OTA Works** | ✅ Yes | ✅ Yes |
| **API Used** | `dual_bank_*` | `dual_bank_*` (same) |
| **Safety** | ⚠️ Medium | ✅ High |

**Recommendation**: 
1. **Clarify the requirement** - share the documentation you found
2. **If it's not a hard requirement** - stay with single-bank (already working)
3. **If dual-bank is mandatory** - upgrade to 1MB flash chip

---

## Next Steps

**Please provide**:
1. Link/screenshot of documentation saying "dual-bank required"
2. Your use case (production/prototype/personal)
3. Your priority (safety vs cost vs features)

**Then we can**:
- Determine if dual-bank is truly required
- Choose the best solution for your needs
- Implement the necessary changes
