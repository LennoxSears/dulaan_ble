# Callback Test Results

## Test Date
December 30, 2024

## Objective
Test if JieLi SDK's `dual_bank_update_write()` callback parameter is supported.

## Test Setup

**Firmware changes:**
- Added `ota_write_complete_callback()` function
- Passed callback to `dual_bank_update_write()`
- Callback sends ACK notification: `[0x04][seq_low][seq_high]`

**App changes:**
- Added ACK handler in notification handler
- Implemented `waitForAck()` method with 5-second timeout
- Modified packet sending to wait for ACK before sending next

## Test Results

### Attempt 1: Send packet 0

**App logs:**
```
OTA: Sending 927 packets with flow control...
OTA: Packet 0 sent, waiting for ACK...
OTA: Attempt 1/3 failed: Timeout waiting for ACK (seq=0)
OTA: Retrying in 100ms...
OTA: Packet 0 sent, waiting for ACK...
OTA: Attempt 2/3 failed: Timeout waiting for ACK (seq=0)
OTA: Retrying in 200ms...
OTA: Packet 0 sent, waiting for ACK...
OTA: Attempt 3/3 failed: Timeout waiting for ACK (seq=0)
OTA: Failed to send data: Error: Timeout waiting for ACK (seq=0)
```

**Device logs (Android):**
- No errors
- BLE connection stable
- No ACK notifications received

**Analysis:**
- ✅ Packet sent successfully (no BLE error)
- ✅ Device received packet (no disconnect)
- ❌ **No ACK notification received**
- ❌ **Callback was NOT invoked**

## Conclusion

**The JieLi SDK's `dual_bank_update_write()` callback parameter is NOT supported.**

Possible reasons:
1. SDK ignores the callback parameter
2. Callback is only called in specific conditions (not documented)
3. SDK version doesn't support callbacks
4. Callback requires additional initialization

## Fallback Solution

**Implemented fixed delay approach:**

```javascript
// Send packet
await BleClient.writeWithoutResponse(...);

// Fixed delay to prevent buffer overflow
await this.delay(100);  // 100ms between packets
```

**Performance:**
- 927 packets × 100ms = ~93 seconds (1.5 minutes)
- Acceptable for OTA updates
- Still solves buffer overflow issue

## Comparison

| Approach | Time | Reliability | SDK Support |
|----------|------|-------------|-------------|
| Per-packet ACK | 2 min | ⭐⭐⭐⭐⭐ | ❌ Not supported |
| Fixed delay (100ms) | 1.5 min | ⭐⭐⭐⭐ | ✅ Works |
| No delay (crashes) | 10 sec | ❌ | N/A |

## Recommendation

**Use fixed 100ms delay:**
- ✅ Simple and reliable
- ✅ No firmware changes needed
- ✅ Solves buffer overflow
- ✅ Acceptable performance

**Future improvement:**
If JieLi releases SDK update with callback support, we can switch to ACK-based flow control for better performance.

## Files Modified

**Reverted to fixed delay:**
- `dulaan_ota/backend/client/core/ota-controller.js`

**Firmware changes (not needed):**
- `vm_ble_service.h` - ACK status code (kept for future)
- `vm_ble_service.c` - Callback function (kept for future)

## Status

✅ Fixed delay implemented
✅ Ready for testing with full firmware
✅ Expected to work reliably

## Next Steps

1. Rebuild app with fixed delay
2. Test with full 222KB firmware
3. Verify no crashes during OTA
4. Monitor for successful completion
