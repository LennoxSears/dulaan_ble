# Firmware OTA Code Analysis

## Code Flow

### DATA Packet Processing (`vm_ble_service.c`)

```c
case VM_OTA_CMD_DATA: {
    // 1. Parse packet (3 byte header + 240 bytes data)
    uint16_t seq = data[1] | (data[2] << 8);
    uint16_t data_len = len - 3;  // 240 bytes
    uint8_t *firmware_data = &data[3];
    
    // 2. Write to flash - CRITICAL CALL
    uint32_t ret = dual_bank_update_write(firmware_data, data_len, NULL);
    
    // 3. Update counters
    ota_received_size += data_len;
    
    // 4. Send progress notification (every 10% only)
}
```

### Dual Bank API (`dual_bank_updata_api.h`)

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
2. A **background task** is notified to write to flash
3. Function returns **immediately** (non-blocking)
4. **No callback is used** (NULL passed) - no flow control!

## Root Cause

### Initialization
```c
dual_bank_passive_update_init(0, ota_total_size, 240, NULL);
```
- `max_pkt_len = 240` bytes per packet
- Internal buffer size is unknown (likely small)

### The Problem: Buffer Overflow

**With 1 packet (240 bytes):**
```
Packet arrives → Copy to buffer (240 bytes) → Task writes to flash
                 ↓
              Buffer: [240 bytes]
                 ↓
              Flash write completes before next packet
```
✅ Works fine

**With 5 packets (1200 bytes total, 100ms delay):**
```
Time 0ms:   Packet 1 → Buffer: [240 bytes] → Task starts writing
Time 100ms: Packet 2 → Buffer: [480 bytes] → Task still writing
Time 200ms: Packet 3 → Buffer: [720 bytes] → Task still writing
Time 300ms: Packet 4 → Buffer: [960 bytes] → Task still writing
Time 400ms: Packet 5 → Buffer: [1200 bytes] → Task still writing
                                ↓
                         BUFFER OVERFLOW!
```

**After 20-25 seconds:**
- Flash write task is still processing queued data
- One of these happens:
  1. **Buffer overflow** - Internal buffer < 1200 bytes
  2. **Watchdog timeout** - CPU blocked too long by flash operations
  3. **Memory corruption** - Buffer overrun corrupts stack/heap
  4. **Task crash** - Flash write task encounters corrupted data

## Why No Immediate Crash?

The crash is **delayed** because:
1. BLE callback returns immediately (data copied to buffer)
2. Flash write happens in background task
3. Crash occurs when:
   - Buffer fills up completely
   - Flash write encounters corrupted data
   - Watchdog detects CPU stall

## Solutions

### Option 1: Reduce Packet Size (App-side workaround)
**Change in app:**
```javascript
this.DATA_CHUNK_SIZE = 128;  // Reduce from 240 to 128 bytes
```

**Effect:**
- Smaller packets = less buffer pressure
- May still overflow with many packets

### Option 2: Increase Delay Between Packets (App-side workaround)
**Change in app:**
```javascript
await this.delay(500);  // Increase from 50ms to 500ms
```

**Effect:**
- Gives flash write task more time to process
- Slower OTA (but more reliable)

### Option 3: Implement Flow Control (Firmware fix - BEST)
**Change in firmware:**
```c
case VM_OTA_CMD_DATA: {
    // Write to flash with callback
    uint32_t ret = dual_bank_update_write(firmware_data, data_len, write_complete_callback);
    
    // DON'T send progress notification here
    // Wait for callback to confirm write completed
}

static int write_complete_callback(void *priv) {
    // NOW send ACK notification to app
    ota_send_notification(conn_handle, VM_OTA_STATUS_ACK, sequence);
    return 0;
}
```

**App changes:**
```javascript
// Wait for ACK after each packet
await this.writePacket(packet);
await this.waitForAck(sequence);  // Don't send next until ACK received
```

**Effect:**
- App waits for device to finish processing before sending next packet
- No buffer overflow possible
- Optimal speed (no arbitrary delays)

### Option 4: Check Buffer Size (Firmware investigation)
**Add to firmware:**
```c
uint32_t max_buf = get_dual_bank_passive_update_max_buf();
log_info("OTA: Max buffer size: %d bytes\n", max_buf);
```

**This tells us:**
- How much data can be buffered
- How many packets can be sent before overflow

## Recommended Approach

**Immediate (App-side):**
1. Test with 2-3 packets to find exact breaking point
2. Reduce packet size to 128 bytes
3. Increase delay to 500ms

**Long-term (Firmware):**
1. Implement flow control with ACK notifications
2. Add buffer size logging
3. Add watchdog refresh during flash writes

## Test Plan

1. **Test with 2 packets** - Find if crash happens between 1-5 packets
2. **Test with 128-byte packets** - See if smaller size helps
3. **Test with 500ms delay** - See if more time helps
4. **Add UART logging** - See actual buffer usage and crash point
