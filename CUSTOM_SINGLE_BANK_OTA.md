# Custom Single-Bank OTA Implementation Plan

## Overview
Implement custom OTA using low-level flash write functions to update app.bin (215 KB) directly, bypassing JieLi's dual-bank system.

## Architecture

### 1. Flash Memory Layout
```
Flash: 1024 KB (0x100000)
├─ 0x000000 - 0x001000: Bootloader (uboot.boot, 4 KB)
├─ 0x001000 - 0x080000: Running Application (~500 KB)
│  ├─ Boot Info Header (256 bytes)
│  ├─ Application Code (app.bin, 215 KB)
│  └─ Reserved space
└─ 0x080000 - 0x100000: VM/Data partition (500 KB)
```

### 2. Update Process Flow
```
[App] --BLE--> [Device Firmware]
                     |
                     v
              [OTA Handler]
                     |
                     v
              [Buffer Data]
                     |
                     v
         [Write to Temp Area] (VM partition)
                     |
                     v
         [Verify CRC & Size]
                     |
                     v
         [Erase App Area]
                     |
                     v
         [Copy from Temp to App Area]
                     |
                     v
         [Update Boot Info]
                     |
                     v
         [System Reset]
```

## Implementation

### Step 1: Firmware Side - Custom OTA Handler

**File:** `SDK/apps/spp_and_le/examples/motor_control/vibration_motor_ble/vm_ble_service.c`

```c
// Custom OTA state machine
typedef enum {
    CUSTOM_OTA_IDLE = 0,
    CUSTOM_OTA_RECEIVING,
    CUSTOM_OTA_VERIFYING,
    CUSTOM_OTA_WRITING,
    CUSTOM_OTA_COMPLETE
} custom_ota_state_t;

// OTA context
static struct {
    custom_ota_state_t state;
    uint32_t total_size;
    uint32_t received_size;
    uint32_t temp_flash_addr;    // VM partition address for temp storage
    uint16_t expected_crc;
    uint8_t buffer[4096];        // 4KB sector buffer
    uint16_t buffer_offset;
} custom_ota_ctx;

// Flash addresses (adjust based on actual layout)
#define CUSTOM_OTA_TEMP_ADDR    0x80000   // VM partition start
#define CUSTOM_OTA_APP_ADDR     0x1000    // Application start (after bootloader)
#define CUSTOM_OTA_BOOT_INFO    0x1000    // Boot info location

// External flash functions (from cpu.a library)
extern int norflash_erase(uint8_t eraser, uint32_t addr);
extern int norflash_write(uint32_t addr, uint8_t *buf, uint32_t len);
extern int norflash_read(uint32_t addr, uint8_t *buf, uint32_t len);

// CRC16-CCITT calculation
static uint16_t calculate_crc16_ccitt(uint8_t *data, uint32_t len) {
    uint16_t crc = 0xFFFF;
    for (uint32_t i = 0; i < len; i++) {
        crc ^= (uint16_t)data[i] << 8;
        for (uint8_t j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
    }
    return crc;
}

// START command handler
static int custom_ota_start(uint32_t size, uint16_t crc) {
    log_info("Custom OTA: START, size=%d, crc=0x%04x\n", size, crc);
    
    // Validate size
    if (size == 0 || size > 300 * 1024) {  // Max 300 KB for app.bin
        log_error("Custom OTA: Invalid size\n");
        return -1;
    }
    
    // Initialize context
    custom_ota_ctx.state = CUSTOM_OTA_RECEIVING;
    custom_ota_ctx.total_size = size;
    custom_ota_ctx.received_size = 0;
    custom_ota_ctx.temp_flash_addr = CUSTOM_OTA_TEMP_ADDR;
    custom_ota_ctx.expected_crc = crc;
    custom_ota_ctx.buffer_offset = 0;
    
    // Erase temp area (VM partition)
    uint32_t sectors = (size + 4095) / 4096;
    log_info("Custom OTA: Erasing %d sectors at 0x%08x\n", sectors, CUSTOM_OTA_TEMP_ADDR);
    
    for (uint32_t i = 0; i < sectors; i++) {
        uint32_t addr = CUSTOM_OTA_TEMP_ADDR + (i * 4096);
        if (norflash_erase(0, addr) != 0) {  // 0 = sector erase
            log_error("Custom OTA: Erase failed at 0x%08x\n", addr);
            return -1;
        }
    }
    
    log_info("Custom OTA: Ready to receive data\n");
    return 0;
}

// DATA command handler
static int custom_ota_data(uint8_t *data, uint16_t len) {
    if (custom_ota_ctx.state != CUSTOM_OTA_RECEIVING) {
        log_error("Custom OTA: Not in receiving state\n");
        return -1;
    }
    
    // Buffer data until we have a full sector (4KB)
    uint16_t remaining = len;
    uint16_t offset = 0;
    
    while (remaining > 0) {
        uint16_t to_copy = 4096 - custom_ota_ctx.buffer_offset;
        if (to_copy > remaining) {
            to_copy = remaining;
        }
        
        memcpy(custom_ota_ctx.buffer + custom_ota_ctx.buffer_offset, 
               data + offset, to_copy);
        custom_ota_ctx.buffer_offset += to_copy;
        offset += to_copy;
        remaining -= to_copy;
        
        // Write full sector to flash
        if (custom_ota_ctx.buffer_offset >= 4096) {
            if (norflash_write(custom_ota_ctx.temp_flash_addr, 
                              custom_ota_ctx.buffer, 4096) != 0) {
                log_error("Custom OTA: Write failed at 0x%08x\n", 
                         custom_ota_ctx.temp_flash_addr);
                return -1;
            }
            
            custom_ota_ctx.temp_flash_addr += 4096;
            custom_ota_ctx.buffer_offset = 0;
        }
    }
    
    custom_ota_ctx.received_size += len;
    
    log_info("Custom OTA: Received %d/%d bytes\n", 
             custom_ota_ctx.received_size, custom_ota_ctx.total_size);
    
    return 0;
}

// END command handler
static int custom_ota_end(void) {
    log_info("Custom OTA: END, verifying...\n");
    
    // Write remaining buffered data
    if (custom_ota_ctx.buffer_offset > 0) {
        if (norflash_write(custom_ota_ctx.temp_flash_addr, 
                          custom_ota_ctx.buffer, 
                          custom_ota_ctx.buffer_offset) != 0) {
            log_error("Custom OTA: Final write failed\n");
            return -1;
        }
    }
    
    // Verify size
    if (custom_ota_ctx.received_size != custom_ota_ctx.total_size) {
        log_error("Custom OTA: Size mismatch: %d != %d\n", 
                 custom_ota_ctx.received_size, custom_ota_ctx.total_size);
        return -1;
    }
    
    // Verify CRC
    custom_ota_ctx.state = CUSTOM_OTA_VERIFYING;
    uint16_t calculated_crc = 0xFFFF;
    uint8_t verify_buf[256];
    uint32_t addr = CUSTOM_OTA_TEMP_ADDR;
    uint32_t remaining = custom_ota_ctx.total_size;
    
    log_info("Custom OTA: Calculating CRC...\n");
    while (remaining > 0) {
        uint32_t to_read = (remaining > 256) ? 256 : remaining;
        if (norflash_read(addr, verify_buf, to_read) != 0) {
            log_error("Custom OTA: Read failed during verify\n");
            return -1;
        }
        
        calculated_crc = calculate_crc16_ccitt(verify_buf, to_read);
        addr += to_read;
        remaining -= to_read;
    }
    
    if (calculated_crc != custom_ota_ctx.expected_crc) {
        log_error("Custom OTA: CRC mismatch: 0x%04x != 0x%04x\n", 
                 calculated_crc, custom_ota_ctx.expected_crc);
        return -1;
    }
    
    log_info("Custom OTA: CRC verified, writing to app area...\n");
    
    // Erase application area
    custom_ota_ctx.state = CUSTOM_OTA_WRITING;
    uint32_t app_sectors = (custom_ota_ctx.total_size + 4095) / 4096;
    
    for (uint32_t i = 0; i < app_sectors; i++) {
        uint32_t erase_addr = CUSTOM_OTA_APP_ADDR + (i * 4096);
        if (norflash_erase(0, erase_addr) != 0) {
            log_error("Custom OTA: App erase failed at 0x%08x\n", erase_addr);
            return -1;
        }
    }
    
    // Copy from temp to app area
    uint8_t copy_buf[256];
    uint32_t src_addr = CUSTOM_OTA_TEMP_ADDR;
    uint32_t dst_addr = CUSTOM_OTA_APP_ADDR;
    remaining = custom_ota_ctx.total_size;
    
    while (remaining > 0) {
        uint32_t to_copy = (remaining > 256) ? 256 : remaining;
        
        if (norflash_read(src_addr, copy_buf, to_copy) != 0) {
            log_error("Custom OTA: Read failed during copy\n");
            return -1;
        }
        
        if (norflash_write(dst_addr, copy_buf, to_copy) != 0) {
            log_error("Custom OTA: Write failed during copy\n");
            return -1;
        }
        
        src_addr += to_copy;
        dst_addr += to_copy;
        remaining -= to_copy;
    }
    
    log_info("Custom OTA: Application written successfully\n");
    
    // Update boot info (simplified - adjust based on actual boot info structure)
    struct {
        uint16_t crc;
        uint16_t reserved;
        uint32_t size;
        uint32_t entry;
    } boot_info;
    
    boot_info.crc = calculated_crc;
    boot_info.size = custom_ota_ctx.total_size;
    boot_info.entry = 0x1e00120;  // Entry point from isd_config.ini
    
    if (norflash_write(CUSTOM_OTA_BOOT_INFO, (uint8_t*)&boot_info, 
                      sizeof(boot_info)) != 0) {
        log_error("Custom OTA: Boot info write failed\n");
        return -1;
    }
    
    custom_ota_ctx.state = CUSTOM_OTA_COMPLETE;
    log_info("Custom OTA: Complete! Resetting...\n");
    
    // Reset device
    extern void cpu_reset(void);
    cpu_reset();
    
    return 0;
}

// Integrate into existing OTA handler
static int vm_ota_write_callback(void *priv, void *data, u16 len)
{
    u8 *packet = (u8 *)data;
    u8 cmd = packet[0];
    
    switch (cmd) {
        case VM_OTA_CMD_START:
            if (len < 7) {
                return 0x0D;  // Invalid length
            }
            uint32_t size = packet[1] | (packet[2] << 8) | 
                           (packet[3] << 16) | (packet[4] << 24);
            uint16_t crc = packet[5] | (packet[6] << 8);
            
            if (custom_ota_start(size, crc) != 0) {
                ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0x02);
                return 0x0E;
            }
            
            ota_send_notification(conn_handle, VM_OTA_STATUS_READY, 0x00);
            break;
            
        case VM_OTA_CMD_DATA:
            if (custom_ota_data(packet + 1, len - 1) != 0) {
                ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0x05);
                return 0x0E;
            }
            
            // Send progress
            uint8_t progress = (custom_ota_ctx.received_size * 100) / 
                              custom_ota_ctx.total_size;
            ota_send_notification(conn_handle, VM_OTA_STATUS_PROGRESS, progress);
            break;
            
        case VM_OTA_CMD_END:
            if (custom_ota_end() != 0) {
                ota_send_notification(conn_handle, VM_OTA_STATUS_ERROR, 0x06);
                return 0x0E;
            }
            
            ota_send_notification(conn_handle, VM_OTA_STATUS_SUCCESS, 0x00);
            break;
            
        default:
            return 0x0D;
    }
    
    return 0;
}
```

### Step 2: App Side - Send app.bin

**File:** `dulaan_ota/backend/client/core/ota-controller.js`

```javascript
// Modify START command to include CRC
async sendStartCommand() {
    const BleClient = getBleClient();
    if (!BleClient) {
        throw new Error('BleClient not available');
    }

    // Calculate CRC16-CCITT
    const crc = this.calculateCRC16CCITT(this.firmwareData);

    // START command: [0x01][size_low][size_high][size_mid][size_top][crc_low][crc_high]
    const data = new Uint8Array(7);
    data[0] = 0x01; // START command
    data[1] = this.totalSize & 0xFF;
    data[2] = (this.totalSize >> 8) & 0xFF;
    data[3] = (this.totalSize >> 16) & 0xFF;
    data[4] = (this.totalSize >> 24) & 0xFF;
    data[5] = crc & 0xFF;
    data[6] = (crc >> 8) & 0xFF;

    console.log(getTimestamp() + ` OTA: Sending START command, size: ${this.totalSize}, CRC: 0x${crc.toString(16)}`);

    await BleClient.writeWithoutResponse(
        this.deviceAddress,
        this.SERVICE_UUID,
        this.OTA_CHAR_UUID,
        new DataView(data.buffer)
    );
    
    this.updateStatus('Waiting for device...');
}

// Add CRC calculation
calculateCRC16CCITT(data) {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i] << 8;
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
        crc &= 0xFFFF;
    }
    return crc;
}
```

## Risks & Mitigations

### Critical Risks
1. **Device Brick** - Wrong flash addresses or boot info
   - Mitigation: Test with UART recovery ready
   - Keep UART programmer connected during testing

2. **Flash Corruption** - Power loss during write
   - Mitigation: Write to temp area first, then copy
   - Verify CRC before overwriting app

3. **Boot Failure** - Incorrect boot info structure
   - Mitigation: Study existing boot info format
   - Test with small changes first

### Testing Strategy
1. Test flash read/write to VM partition (safe area)
2. Test CRC calculation with known data
3. Test temp area write and verify
4. Test copy from temp to app area (with backup)
5. Test boot info update (final step)

## Advantages
- ✅ Works with 215 KB app.bin (fits in 500 KB)
- ✅ No dual-bank space requirement
- ✅ Direct control over flash operations
- ✅ Can optimize for specific use case

## Disadvantages
- ❌ No rollback on failure (device may brick)
- ❌ Complex implementation (~500 lines)
- ❌ Requires extensive testing
- ❌ Must match SDK boot info format
- ❌ High risk during development

## Recommendation
**Proceed with extreme caution.** This approach is viable but risky. Ensure you have:
1. UART programmer for recovery
2. Backup of working firmware
3. Test device (not production)
4. Time for extensive testing (1-2 weeks)

Consider alternatives first:
- Test if app.bin works with SDK's dual_bank_update_write()
- Optimize firmware size to < 250 KB
- Use 2MB flash chip if possible
