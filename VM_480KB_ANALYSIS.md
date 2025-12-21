# Can We Set VM Area to 480KB?

## Question: Can we increase VM from 240KB to 480KB?

## Answer: ❌ **NO - Not Enough Flash Space**

---

## The Math:

### Total Flash: 512KB (0x80000)

```
Flash Layout (512KB total):
┌─────────────────────────────────────┐
│ Bootloader: ~20KB                   │
├─────────────────────────────────────┤
│ Current Firmware: 236KB             │ ← Running code
├─────────────────────────────────────┤
│ VM Area: ??? KB                     │ ← OTA storage
├─────────────────────────────────────┤
│ BTIF: 4KB                           │ ← Bluetooth config
└─────────────────────────────────────┘
```

### Available Space Calculation:

```
Total flash:           512KB
- Bootloader:          -20KB
- Current firmware:   -236KB
- BTIF:                 -4KB
────────────────────────────
Available for VM:      252KB
```

**You only have 252KB available, not 480KB!**

---

## What Happens if You Try 480KB?

### Configuration:

```ini
# isd_config.ini
VM_LEN = 480K;  # Try to set 480KB
```

### Build Result:

```
FLASH_REAL_SIZE: 512KB
FLASH_BIN_SIZE: 236KB (bootloader + firmware)
VM_LEN: 480KB (requested)
BTIF: 4KB

Required: 236KB + 480KB + 4KB = 720KB
Available: 512KB

ERROR: Not enough flash space!
```

**Build will fail or device won't boot.**

---

## Actual Available Space:

### From Your Build Log:

```
FLASH_BIN_SIZE:     0x3b000 = 236KB (code)
FLASH_REAL_SIZE:    0x80000 = 512KB (total)
VM_START_ADDR:      0x3b000 (after code)
BTIF_START:         0x3e000 (after VM)
BTIF_SIZE:          0x1000  = 4KB

Available for VM:
  BTIF_START - VM_START = 0x3e000 - 0x3b000 = 0x3000 = 12KB (original)
  
Maximum possible VM:
  FLASH_END - VM_START - BTIF = 0x80000 - 0x3b000 - 0x1000
                               = 0x44000 = 272KB
```

**Maximum VM size: 272KB (not 480KB)**

---

## Why 272KB is the Limit:

### Flash Layout Constraints:

```
0x00000000 ┌─────────────────────────────────────┐
           │ Bootloader (~20KB)                  │
0x00005000 ├─────────────────────────────────────┤
           │ Current Firmware (236KB)            │
0x0003b000 ├─────────────────────────────────────┤ ← VM_START
           │ VM Area (max 272KB)                 │
0x0007f000 ├─────────────────────────────────────┤ ← BTIF_START
           │ BTIF (4KB)                          │
0x00080000 └─────────────────────────────────────┘ ← FLASH_END
```

**VM cannot exceed 272KB without overwriting BTIF or going past flash end.**

---

## Does 272KB Help?

### Dual-Bank OTA with 272KB VM:

```
VM Area: 272KB
Dual-bank needs: 217KB × 2 = 434KB

272KB < 434KB

Result: ❌ Still not enough!
```

**Even with maximum VM (272KB), dual-bank OTA still doesn't work.**

---

## What About Single-Bank?

### Single-Bank OTA with 272KB VM:

```
VM Area: 272KB
Single-bank needs: 217KB × 1 = 217KB

272KB > 217KB

Result: ✅ This works!
```

**Single-bank OTA works with 272KB VM.**

---

## Single-Bank vs Dual-Bank:

### Dual-Bank (Standard):
```
┌─────────────────────────────────────┐
│ Bank A: Current firmware (217KB)   │ ← Running
├─────────────────────────────────────┤
│ Bank B: New firmware (217KB)       │ ← OTA writes here
└─────────────────────────────────────┘
Total needed: 434KB
Available: 272KB
Result: ❌ Doesn't fit
```

**Benefits**:
- ✅ Safe: Always have working firmware
- ✅ Rollback: Can revert if update fails
- ❌ Needs 2x space

### Single-Bank (Alternative):
```
┌─────────────────────────────────────┐
│ Current firmware (217KB)            │ ← Running
├─────────────────────────────────────┤
│ VM: New firmware (217KB)            │ ← OTA writes here
└─────────────────────────────────────┘
Total needed: 217KB
Available: 272KB
Result: ✅ Fits!
```

**Benefits**:
- ✅ Fits in available space
- ✅ Works with current hardware
- ❌ No rollback if update fails
- ❌ Less safe

---

## How to Enable Single-Bank OTA:

### 1. Disable Dual-Bank Mode:

```c
// board_ac632n_demo_global_build_cfg.h
#define CONFIG_DOUBLE_BANK_ENABLE  0  // Single-bank
```

### 2. Increase VM to Maximum:

```ini
# isd_config.ini
VM_LEN = 272K;  # Maximum available
```

```c
// board_ac632n_demo_global_build_cfg.h
#define CONFIG_VM_LEAST_SIZE  272K
```

### 3. Update OTA Max Size:

```c
// vm_ble_service.h
#define VM_OTA_MAX_SIZE  (272*1024)  // 272KB
```

### 4. Rebuild:

```bash
cd SDK
make clean_ac632n_spp_and_le
make ac632n_spp_and_le
```

---

## Single-Bank OTA Process:

### Update Flow:

1. **Device boots** from main flash (217KB firmware)
2. **OTA writes** new firmware to VM area (217KB)
3. **After verification**, bootloader copies VM → main flash
4. **Device reboots** with new firmware
5. **Next update** overwrites VM area again

### Risk:

**If power loss during step 3 (copying VM → main)**:
- Main flash corrupted
- VM area has new firmware but not activated
- Device may not boot
- **Recovery**: Requires UART/USB programming

**Mitigation**:
- Warn user not to power off during update
- Add battery check before OTA
- Keep update time short (~15 seconds)

---

## Comparison:

| Aspect | Dual-Bank | Single-Bank |
|--------|-----------|-------------|
| **Space needed** | 434KB | 217KB |
| **Available** | 272KB | 272KB |
| **Fits?** | ❌ No | ✅ Yes |
| **Safety** | High | Medium |
| **Rollback** | Yes | No |
| **Risk** | Low | Medium |
| **Works on 512KB?** | ❌ No | ✅ Yes |

---

## Recommendation:

### Option 1: Single-Bank OTA ⚠️ (Works but risky)

**Pros**:
- ✅ Works with current hardware
- ✅ No additional cost
- ✅ Fits 217KB firmware

**Cons**:
- ❌ No rollback capability
- ❌ Risk of bricking if power loss
- ❌ Less safe than dual-bank

**Use case**: Acceptable if:
- Users warned not to power off
- Battery level checked before OTA
- Recovery method available (UART)

---

### Option 2: Upgrade to 1MB Flash ✅ (Recommended)

**Pros**:
- ✅ Dual-bank OTA works
- ✅ Safe with rollback
- ✅ Room for growth (500KB max)
- ✅ Standard SDK support

**Cons**:
- ❌ Costs $0.20 per unit

**Use case**: Production devices where safety matters

---

## Summary:

### Can we set VM to 480KB? **NO**

**Reason**: Only 512KB total flash, need space for:
- Bootloader: 20KB
- Current firmware: 236KB
- BTIF: 4KB
- **Maximum VM**: 272KB (not 480KB)

### Can we use 272KB VM for OTA? **YES (Single-Bank)**

**Configuration**:
```
CONFIG_DOUBLE_BANK_ENABLE = 0
VM_LEN = 272K
```

**Result**: 217KB firmware fits in 272KB VM

**Trade-off**: No rollback, medium risk

---

### What Should You Do?

**For Production**: Upgrade to 1MB flash ($0.20/unit)
- Dual-bank safety
- Rollback capability
- Future-proof

**For Testing/Prototypes**: Use single-bank with 272KB VM
- Works with current hardware
- Acceptable risk for development
- Warn users about power loss

---

## Implementation:

### If You Choose Single-Bank:

1. **Disable dual-bank**:
   ```c
   #define CONFIG_DOUBLE_BANK_ENABLE  0
   ```

2. **Set VM to 272KB**:
   ```ini
   VM_LEN = 272K;
   ```

3. **Update max size**:
   ```c
   #define VM_OTA_MAX_SIZE  (272*1024)
   ```

4. **Remove dual_bank_update_allow_check()** (already done)

5. **Rebuild and test**

**Your 217KB firmware will work with single-bank OTA.**

---

## Conclusion:

**480KB VM**: ❌ Impossible (only 512KB total flash)

**272KB VM**: ✅ Possible (maximum available)

**Single-bank OTA**: ✅ Works with 217KB firmware

**Dual-bank OTA**: ❌ Needs 434KB (don't have it)

**Best solution**: Still hardware upgrade to 1MB flash

**Acceptable workaround**: Single-bank OTA with 272KB VM
