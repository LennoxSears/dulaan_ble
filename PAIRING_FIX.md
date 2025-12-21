# Fix: Double Pairing Prompt Issue

## Problem

When connecting to the device with an app, the pairing prompt appears **twice**:
1. First prompt: Immediately after connection
2. Second prompt: When app tries to write data

This is confusing for users.

---

## Root Cause

**File**: `vm_ble_service.c`

**Previous configuration**:
```c
static const sm_cfg_t vm_sm_config = {
    .slave_security_auto_req = 1,  // Auto-request pairing on connect
    .slave_set_wait_security = 1,  // Enforce encryption before writes
    ...
};
```

**Why double prompt**:
- `slave_security_auto_req = 1`: Device automatically requests pairing when connected
- `slave_set_wait_security = 1`: Device enforces encryption before allowing writes

Result: Two separate pairing triggers = two prompts

---

## Solution

**Changed to**:
```c
static const sm_cfg_t vm_sm_config = {
    .slave_security_auto_req = 0,  // Don't auto-request (wait for first write)
    .slave_set_wait_security = 1,  // Enforce encryption before writes
    ...
};
```

**How it works now**:
1. App connects to device → No pairing prompt
2. App tries to write data → Single pairing prompt appears
3. User accepts → Encrypted connection established
4. Subsequent connections → No prompt (bonded)

---

## Behavior Change

### Before Fix:
```
1. App connects
   → Pairing prompt #1 appears
2. User accepts
3. App tries to write
   → Pairing prompt #2 appears (why?!)
4. User accepts again
5. Connection works
```

### After Fix:
```
1. App connects
   → No prompt (just connected)
2. App tries to write
   → Single pairing prompt appears
3. User accepts
4. Connection works
5. Next time: Auto-reconnect, no prompt
```

---

## Security Impact

**No security reduction**:
- ✅ Encryption still enforced (`slave_set_wait_security = 1`)
- ✅ LESC still active (`SM_AUTHREQ_SECURE_CONNECTION`)
- ✅ Bonding still works (`SM_AUTHREQ_BONDING`)
- ✅ Just-Works pairing (no PIN needed)

**Only difference**: Pairing triggered on first write instead of on connection.

---

## Testing

After rebuilding:

1. **First connection**:
   - Connect to "VibMotor"
   - No prompt yet
   - Send motor command
   - Single pairing prompt appears
   - Accept → Works

2. **Subsequent connections**:
   - Connect to "VibMotor"
   - No prompt (bonded)
   - Send motor command
   - Works immediately

3. **After unpairing**:
   - Unpair device in phone settings
   - Connect again
   - Single prompt on first write

---

## Reference

Based on JieLi SDK example: `trans_data/ble_trans.c`

Standard pattern for BLE peripheral security:
- Don't auto-request pairing
- Enforce encryption on sensitive operations
- Let central (phone) initiate pairing when needed

---

## Rebuild Required

```bash
cd SDK
make clean_ac632n_spp_and_le
make ac632n_spp_and_le
```

Flash new firmware to test the fix.
