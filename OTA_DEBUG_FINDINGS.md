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

### Test 3: FIVE DATA packets (100ms delay between)
**Result:** ⚠️ Device accepted all 5 packets, then disconnected ~20-25 seconds later
**Disconnect:** Status 8 (connection timeout)
**Conclusion:**
- Device CAN receive multiple packets
- Device does NOT crash immediately
- Device crashes/hangs WHILE PROCESSING the received data
- Likely: Flash write operation blocks/crashes device after accumulating data

## Root Cause

**The device crashes during flash write operations after receiving multiple DATA packets.**

This is NOT:
- ❌ Packet format issue (packets are accepted)
- ❌ Immediate buffer overflow (device accepts packets)
- ❌ BLE stack issue (connection works)

This IS:
- ✅ **Flash write operation crash/hang**
- ✅ Device accumulates packets, then crashes when writing to flash
- ✅ Delayed crash (20-25 seconds after last packet)

## Evidence

1. Device accepts START command ✅
2. Device sends READY notification ✅
3. Device accepts ONE DATA packet ✅
4. Device crashes when receiving MANY packets ❌

## Next Steps

**The problem is in the firmware's flash write handling, not the app.**

Possible firmware issues:
1. `dual_bank_passive_update_write()` crashes with multiple packets
2. Flash erase/write operation blocks BLE stack
3. Memory corruption during flash operations
4. Watchdog timeout during long flash writes

**Recommended actions:**
1. Add UART logging to firmware flash write operations
2. Check if device watchdog is triggering
3. Verify flash write operations don't block BLE stack
4. Test with smaller packet sizes (reduce DATA_CHUNK_SIZE from 240 to 128 bytes)

## Technical Details

- MTU: 512 bytes
- Packet size: 243 bytes (3 header + 240 data)
- Command byte: 0x02 (DATA)
- Sequence numbers: Working correctly
- Connection parameters: interval=36, latency=0, timeout=500
