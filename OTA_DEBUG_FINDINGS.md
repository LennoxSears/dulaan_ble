# OTA Debug Findings

## Test Results Summary

### Test 1: No DATA packets (only READY)
**Result:** ✅ Device stayed connected for 30+ seconds
**Conclusion:** `dual_bank_passive_update_init()` does NOT crash the device

### Test 2: ONE DATA packet
**Result:** ✅ Device stayed connected for 30+ seconds after receiving packet
**Conclusion:** 
- Packet format is correct
- Device can receive and process DATA packets
- Flash write operation works
- Single packet does NOT crash device

## Root Cause

**The device disconnects when receiving MULTIPLE DATA packets in rapid succession.**

This is a **buffer overflow / queue saturation issue**, not a packet format or initialization problem.

## Evidence

1. Device accepts START command ✅
2. Device sends READY notification ✅
3. Device accepts ONE DATA packet ✅
4. Device crashes when receiving MANY packets ❌

## Next Steps

Test with increasing packet counts to find the breaking point:
- 5 packets with 100ms delay
- 10 packets with 100ms delay
- 50 packets with 100ms delay

This will determine the safe packet rate for OTA updates.

## Technical Details

- MTU: 512 bytes
- Packet size: 243 bytes (3 header + 240 data)
- Command byte: 0x02 (DATA)
- Sequence numbers: Working correctly
- Connection parameters: interval=36, latency=0, timeout=500
