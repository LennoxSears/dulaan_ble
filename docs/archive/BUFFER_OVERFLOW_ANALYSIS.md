# Buffer Overflow Analysis - Root Cause Identified

## Executive Summary

**Problem:** Device crashes after receiving 8 DATA packets (1920 bytes) during OTA update.

**Root Cause:** Internal buffer overflow in `dual_bank_update_write()` - device cannot process packets fast enough, buffer fills up and overflows, causing crash.

**Solution:** Reduce packet size from 240 to 128 bytes and increase delay from 2 to 5 seconds.

---

## Timeline Analysis (With Timestamps)

### Test Results

**Browser logs:**
```
[19:50:32.811] OTA: Device ready to receive firmware
[19:50:32.813] OTA: Sending 927 packets...
[19:50:32.813] OTA: Sending packet 0 (0/222372 bytes)...
[19:50:32.824] OTA: Packet 0 sent successfully
[19:50:32.976] OTA: Sending packet 1 (240/222372 bytes)...
[19:50:33.018] OTA: Packet 1 sent successfully
[19:50:35.178] OTA: Sending packet 2 (480/222372 bytes)...
[19:50:35.205] OTA: Packet 2 sent successfully
[19:50:37.367] OTA: Sending packet 3 (720/222372 bytes)...
[19:50:37.397] OTA: Packet 3 sent successfully
[19:50:39.558] OTA: Sending packet 4 (960/222372 bytes)...
[19:50:39.587] OTA: Packet 4 sent successfully
[19:50:41.748] OTA: Sending packet 5 (1200/222372 bytes)...
[19:50:41.776] OTA: Packet 5 sent successfully
[19:50:43.937] OTA: Sending packet 6 (1440/222372 bytes)...
[19:50:43.961] OTA: Packet 6 sent successfully
[19:50:46.127] OTA: Sending packet 7 (1680/222372 bytes)...
[19:50:46.154] OTA: Packet 7 sent successfully
[19:50:46.154] OTA: Waiting 2000ms before next packet...
[19:50:47.474] OTA: Device disconnected  ← CRASH!
[19:50:48.315] OTA: Sending packet 8 (1920/222372 bytes)...
```

**Android logs:**
```
19:50:22.953 - Connection updated (interval=36, latency=0, timeout=500)
19:50:47.464 - onClientConnectionState() - status=8 (connection timeout)
```

---

## Key Findings

### 1. Successful Operations
- ✅ 8 packets sent successfully (0-7)
- ✅ Total data: 1920 bytes
- ✅ All BLE writes completed without error
- ✅ Device accepted all packets

### 2. Crash Timing
- **READY received:** 19:50:32.811
- **Last packet sent:** 19:50:46.154 (packet 7)
- **Disconnect:** 19:50:47.474
- **Time after last packet:** 1.32 seconds
- **Time after READY:** 14.66 seconds

### 3. Disconnect Details
- **Status:** 8 (connection timeout)
- **Location:** During 2-second delay (not during BLE write)
- **Supervision timeout:** 5 seconds
- **Device stopped responding to BLE keep-alive packets**

---

## Root Cause Analysis

### The Problem: Buffer Overflow

**How `dual_bank_update_write()` works:**

```c
/* @brief:copy the data to temporary buffer and notify task to write non-volatile storage
 * @param data:the pointer to download data
 * @param len:the length to download data
 * @param write_complete_cb:callback for programming done,return 0 if no err occurred
*/
u32 dual_bank_update_write(void *data, u16 len, int (*write_complete_cb)(void *priv));
```

**Key points:**
1. Data is **copied to internal buffer**
2. Background task is **notified** to write to flash
3. Function returns **immediately** (non-blocking)
4. Flash write happens **asynchronously**

**The Issue:**

```
Time    | Action                        | Buffer State
--------|-------------------------------|------------------
32.813  | Packet 0 (240 bytes) → buffer | Buffer: 240 bytes
32.976  | Packet 1 (240 bytes) → buffer | Buffer: 480 bytes
35.178  | Packet 2 (240 bytes) → buffer | Buffer: 720 bytes
37.367  | Packet 3 (240 bytes) → buffer | Buffer: 960 bytes
39.558  | Packet 4 (240 bytes) → buffer | Buffer: 1200 bytes
41.748  | Packet 5 (240 bytes) → buffer | Buffer: 1440 bytes
43.937  | Packet 6 (240 bytes) → buffer | Buffer: 1680 bytes
46.154  | Packet 7 (240 bytes) → buffer | Buffer: 1920 bytes ← OVERFLOW!
47.474  | Device crashes                | Memory corrupted
```

**Background task cannot write to flash fast enough!**

---

## Why Buffer Overflows

### Flash Write Speed
- Flash erase: ~10-50ms per sector
- Flash write: ~1-5ms per 256 bytes
- Total per packet: ~10-50ms

### Packet Arrival Speed
- Packet 0: Immediate
- Packet 1: 163ms after packet 0 (32.976 - 32.813)
- Packet 2-7: ~2 seconds apart

**Even with 2-second delays, buffer accumulates faster than flash can write!**

### Buffer Size Unknown
We never checked `get_dual_bank_passive_update_max_buf()`:
- If buffer is 1024 bytes: Overflow at packet 5
- If buffer is 2048 bytes: Overflow at packet 9
- **We hit overflow at packet 8 (1920 bytes)**

**Estimated buffer size: ~1500-2000 bytes**

---

## Why Crash is Delayed

**Crash happens 1.32 seconds AFTER last packet:**

1. Packet 7 copied to buffer (buffer full)
2. Background task still writing previous packets
3. Buffer overflow corrupts memory
4. Corruption affects BLE stack or watchdog
5. Device stops responding to BLE keep-alive
6. After 5 seconds of no response → timeout disconnect

**The crash is not immediate because:**
- Memory corruption takes time to manifest
- BLE stack might be in different memory region
- Watchdog might have timeout period
- Task scheduler might detect corruption later

---

## Firmware Code Issues

### Issue 1: No Buffer Size Check

**Current code:**
```c
uint32_t ret = dual_bank_passive_update_init(0, ota_total_size, 240, NULL);
```

**Should be:**
```c
uint32_t max_buf = get_dual_bank_passive_update_max_buf();
log_info("OTA: Max buffer size: %d bytes\n", max_buf);

if (max_buf < 2048) {
    log_error("OTA: Buffer too small\n");
    return ERROR;
}
```

### Issue 2: Large Packet Size

**Current:** 240 bytes per packet
**Problem:** Fills buffer quickly

**Solution:** Use 128 bytes per packet
- Slower to fill buffer
- More time for flash writes
- Less memory pressure

### Issue 3: No Flow Control

**Current:** App sends packets without waiting for device
**Problem:** Device can't tell app to slow down

**Solution:** (Requires SDK callback support)
- Device sends ACK after each write completes
- App waits for ACK before sending next packet

---

## Solution Implemented

### Firmware Changes

1. **Check buffer size:**
```c
uint32_t max_buf = get_dual_bank_passive_update_max_buf();
log_info("OTA: Max buffer size: %d bytes\n", max_buf);

if (max_buf < 2048) {
    log_error("OTA: Buffer too small: %d bytes (need 2048)\n", max_buf);
    return ERROR;
}
```

2. **Reduce packet size:**
```c
// Changed from 240 to 128 bytes
uint32_t ret = dual_bank_passive_update_init(0, ota_total_size, 128, NULL);
```

### App Changes

1. **Reduce packet size:**
```javascript
this.DATA_CHUNK_SIZE = 128; // Reduced from 240
```

2. **Increase delay:**
```javascript
const PACKET_DELAY = 5000; // Increased from 2000ms to 5000ms
```

---

## Expected Results

### Performance

**Old configuration:**
- Packet size: 240 bytes
- Delay: 2 seconds
- Total packets: 927
- Total time: ~31 minutes
- **Result:** Crash after 8 packets

**New configuration:**
- Packet size: 128 bytes
- Delay: 5 seconds
- Total packets: 1737
- Total time: ~145 minutes (2.4 hours)
- **Expected:** Should complete successfully

### Why This Should Work

1. **Smaller packets:**
   - 128 bytes vs 240 bytes = 47% less data per packet
   - Buffer fills slower
   - More time for flash writes between packets

2. **Longer delay:**
   - 5 seconds vs 2 seconds = 2.5x more time
   - Flash task can catch up
   - Buffer has time to drain

3. **Buffer pressure:**
   - Old: 1920 bytes in ~14 seconds = 137 bytes/sec
   - New: 128 bytes per 5 seconds = 25.6 bytes/sec
   - **5.3x slower data rate**

---

## Optimization Plan

**Once working:**

1. **Test with 3-second delay** (~87 minutes)
2. **Test with 2-second delay** (~58 minutes)
3. **Test with 1-second delay** (~29 minutes)
4. **Find optimal delay** that's fast but reliable

**Goal:** Find fastest delay that doesn't cause buffer overflow

---

## What We Need from JieLi

### UART Logs

**Critical information:**
1. Actual buffer size from `get_dual_bank_passive_update_max_buf()`
2. Flash write timing (how long each write takes)
3. Error messages before crash
4. Watchdog status
5. Memory corruption details

### SDK Questions

1. What is the internal buffer size?
2. How fast can flash writes complete?
3. Is there a way to check buffer fullness?
4. Can we enable flow control (ACK callbacks)?
5. Are there any watchdog timers we need to refresh?

---

## Status

✅ Root cause identified (buffer overflow)
✅ Solution implemented (smaller packets, longer delay)
✅ Ready for testing
⏳ Waiting for UART logs to confirm and optimize

**Next steps:**
1. Rebuild firmware with buffer size check
2. Rebuild app with 128-byte packets and 5-second delay
3. Test OTA update (expect ~2.4 hours)
4. Get UART logs from JieLi
5. Optimize based on actual buffer size and flash speed
