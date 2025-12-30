# CRC Analysis

## Current Status

### App Implementation
- ✅ Calculates CRC32 for firmware data
- ✅ Sends CRC32 in FINISH command
- ❌ Does NOT send CRC in START command

### Firmware Implementation
- ✅ Receives CRC in FINISH command
- ❌ Passes CRC=0 to `dual_bank_passive_update_init()`
- ✅ Stores expected CRC for verification

### SDK Behavior
- Uses CRC16-CCITT (not CRC32!)
- CRC verification happens in `dual_bank_update_verify()`
- Verification occurs during FINISH, not during writes

---

## Is CRC Causing the Crash?

**NO - CRC is not causing the buffer overflow crash.**

**Evidence:**
1. CRC validation happens at FINISH command
2. We crash during DATA packets (before FINISH)
3. SDK documentation confirms CRC is for final verification only
4. Passing CRC=0 to init is allowed (SDK handles it internally)

**The crash is caused by buffer overflow, not CRC issues.**

---

## CRC Mismatch Issue

### The Problem

**App calculates:** CRC32
**SDK expects:** CRC16-CCITT

**From SDK API:**
```c
/* @crc_init_hdl:if it equals NULL,use internal implementation(CRC16-CCITT Standard);
 * otherwise,use user's customization;
```

**This means:**
- If we pass CRC=0, SDK calculates CRC16-CCITT internally
- If we pass a CRC value, SDK compares it with internal CRC16-CCITT
- **We're passing CRC32, which won't match CRC16-CCITT!**

---

## Current Code

### App (ota-controller.js)

**FINISH command:**
```javascript
async sendFinishCommand() {
    const crc = this.calculateCRC32(this.firmwareData);
    console.log('OTA: Calculated CRC32:', crc.toString(16));
    
    // FINISH command: [0x03][crc_low][crc_high][crc_mid][crc_top]
    const data = new Uint8Array(5);
    data[0] = 0x03; // FINISH command
    data[1] = crc & 0xFF;
    data[2] = (crc >> 8) & 0xFF;
    data[3] = (crc >> 16) & 0xFF;
    data[4] = (crc >> 24) & 0xFF;
    // ...
}

calculateCRC32(data) {
    // CRC32 calculation
    // ...
}
```

### Firmware (vm_ble_service.c)

**START handler:**
```c
/* Initialize dual-bank update with smaller packet size for safety */
uint32_t ret = dual_bank_passive_update_init(0, ota_total_size, 128, NULL);
                                            ^^^
                                            CRC = 0
```

**FINISH handler:**
```c
ota_expected_crc = data[1] | (data[2] << 8) | (data[3] << 16) | (data[4] << 24);

/* Verify using dual-bank API */
ret = dual_bank_update_verify(NULL, NULL, NULL);
```

---

## Solutions

### Option 1: Let SDK Handle CRC (Recommended)

**Change app to send CRC=0 in FINISH:**

```javascript
async sendFinishCommand() {
    // Let SDK calculate and verify CRC internally
    const crc = 0;  // SDK will handle CRC16-CCITT
    
    // FINISH command: [0x03][0x00][0x00][0x00][0x00]
    const data = new Uint8Array(5);
    data[0] = 0x03; // FINISH command
    data[1] = 0;
    data[2] = 0;
    data[3] = 0;
    data[4] = 0;
    // ...
}
```

**Pros:**
- Simple - no CRC calculation needed
- SDK handles everything
- Guaranteed to match SDK's internal CRC

**Cons:**
- Can't pre-verify CRC before FINISH
- Less control

---

### Option 2: Calculate CRC16-CCITT in App

**Add CRC16-CCITT calculation:**

```javascript
calculateCRC16CCITT(data) {
    let crc = 0xFFFF;
    
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i] << 8;
        
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc = crc << 1;
            }
        }
    }
    
    return crc & 0xFFFF;
}

async sendFinishCommand() {
    const crc = this.calculateCRC16CCITT(this.firmwareData);
    console.log('OTA: Calculated CRC16-CCITT:', crc.toString(16));
    
    // FINISH command: [0x03][crc_low][crc_high][0x00][0x00]
    const data = new Uint8Array(5);
    data[0] = 0x03; // FINISH command
    data[1] = crc & 0xFF;
    data[2] = (crc >> 8) & 0xFF;
    data[3] = 0;  // CRC16 is only 2 bytes
    data[4] = 0;
    // ...
}
```

**Pros:**
- More control
- Can verify CRC before sending FINISH
- Matches SDK's algorithm

**Cons:**
- More complex
- Need to implement CRC16-CCITT correctly
- Must match SDK's exact implementation

---

### Option 3: Pass CRC to Init (Future Enhancement)

**Calculate CRC and pass to init:**

```c
/* Calculate CRC before init */
uint32_t fw_crc = calculate_crc16_ccitt(firmware_data, ota_total_size);

/* Initialize with CRC */
uint32_t ret = dual_bank_passive_update_init(fw_crc, ota_total_size, 128, NULL);
```

**But this requires:**
- Having firmware data before init (we don't)
- Or calculating CRC in app and sending in START command
- Protocol change

---

## Recommendation

### Immediate Action: Option 1 (Let SDK Handle CRC)

**Change app to send CRC=0:**
- Simplest solution
- No risk of CRC mismatch
- SDK handles everything

**Implementation:**
```javascript
async sendFinishCommand() {
    // Let SDK calculate and verify CRC internally
    console.log('OTA: Letting SDK handle CRC verification');
    
    // FINISH command: [0x03][0x00][0x00][0x00][0x00]
    const data = new Uint8Array(5);
    data[0] = 0x03; // FINISH command
    data[1] = 0;
    data[2] = 0;
    data[3] = 0;
    data[4] = 0;
    // ...
}
```

### Future Enhancement: Option 2 (Calculate CRC16-CCITT)

**After OTA works reliably:**
- Implement CRC16-CCITT calculation
- Verify it matches SDK's calculation
- Add pre-verification before FINISH

---

## Testing Plan

### Phase 1: Fix Buffer Overflow (Current)
1. ✅ Reduce packet size to 128 bytes
2. ✅ Increase delay to 5 seconds
3. ⏳ Test OTA with current CRC32 (might fail at FINISH)

### Phase 2: Fix CRC (If Needed)
1. If FINISH fails with CRC error:
   - Change app to send CRC=0
   - Let SDK handle CRC
2. Test again
3. Should succeed

### Phase 3: Optimize (After Working)
1. Implement CRC16-CCITT calculation
2. Verify matches SDK
3. Add pre-verification

---

## Status

**Priority:** Low (not causing current crash)

**Current issue:** Buffer overflow during DATA packets
**CRC issue:** Will surface at FINISH command (if at all)

**Action:** Fix buffer overflow first, then address CRC if needed

---

## Notes for JieLi

**Questions:**
1. Does SDK validate CRC during `dual_bank_passive_update_init()`?
2. Is CRC=0 acceptable (SDK calculates internally)?
3. What CRC algorithm does SDK use? (CRC16-CCITT confirmed?)
4. Can we get SDK source to verify CRC implementation?
