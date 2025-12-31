# Custom Dual-Bank OTA with app.bin

## Overview
Implement custom dual-bank OTA using low-level flash functions with raw app.bin (215 KB), providing rollback safety while fitting in 1MB flash.

## Why This is Better

### Space Comparison
| Approach | Space Needed | Fits 1MB? | Safety |
|----------|--------------|-----------|--------|
| JieLi SDK Dual-Bank | 900 KB (450×2) | ❌ No | ✅ Rollback |
| Custom Single-Bank | 215 KB | ✅ Yes | ❌ No rollback |
| **Custom Dual-Bank** | **430 KB (215×2)** | **✅ Yes** | **✅ Rollback** |

### Key Advantages
- ✅ **Rollback safety** - Can revert to previous firmware on failure
- ✅ **Fits in 1MB** - Only 430 KB for both banks
- ✅ **Uses app.bin** - No need for jl_isd.fw packaging
- ✅ **Full control** - Custom implementation, no SDK limitations
- ✅ **Atomic updates** - Write to inactive bank, switch only when verified

## Flash Partition Layout

```
Flash: 1024 KB (0x100000)

┌─────────────────────────────────────────────────────────────┐
│ 0x000000 - 0x001000 (4 KB)    │ Bootloader (uboot.boot)    │
├─────────────────────────────────────────────────────────────┤
│ 0x001000 - 0x001400 (1 KB)    │ Boot Info & Bank Metadata  │
├─────────────────────────────────────────────────────────────┤
│ 0x001400 - 0x037400 (216 KB)  │ Bank A (app.bin)           │
├─────────────────────────────────────────────────────────────┤
│ 0x037400 - 0x06D400 (216 KB)  │ Bank B (app.bin)           │
├─────────────────────────────────────────────────────────────┤
│ 0x06D400 - 0x100000 (587 KB)  │ VM/Data Partition          │
└─────────────────────────────────────────────────────────────┘

Total Used: 437 KB (43%)
Total Free: 587 KB (57%)
```

### Alignment
- All partitions 4KB-aligned (flash sector size)
- Bank A: 0x001400 (5 KB offset)
- Bank B: 0x037400 (221 KB offset)
- Each bank: 216 KB (215 KB app.bin + 1 KB padding)

## Boot Info Structure

```c
#define BOOT_INFO_ADDR      0x001000
#define BOOT_INFO_MAGIC     0x4A4C4F54  // 'JLOT'
#define BOOT_INFO_VERSION   0x0001

#define BANK_A_ADDR         0x001400
#define BANK_B_ADDR         0x037400
#define BANK_SIZE           (216 * 1024)  // 216 KB

typedef struct {
    uint32_t addr;           // Flash address
    uint32_t size;           // Actual firmware size
    uint16_t crc;            // CRC16-CCITT
    uint8_t  valid;          // 1 = valid, 0 = invalid
    uint8_t  version;        // Firmware version number
} bank_info_t;

typedef struct {
    // Header
    uint32_t magic;          // BOOT_INFO_MAGIC
    uint16_t version;        // BOOT_INFO_VERSION
    uint16_t reserved;
    
    // Bank information
    bank_info_t bank_a;
    bank_info_t bank_b;
    
    // Active bank tracking
    uint8_t active_bank;     // 0 = Bank A, 1 = Bank B
    uint8_t boot_count;      // Incremented on each boot attempt
    uint8_t max_boot_tries;  // Max boot attempts before rollback (default: 3)
    uint8_t reserved2;
    
    // Integrity
    uint16_t boot_info_crc;  // CRC of this structure
    uint16_t reserved3;
} boot_info_t;
```

## Update Process Flow

```
┌─────────────┐
│ App sends   │
│ app.bin via │
│ BLE         │
└──────┬──────┘
       │
       v
┌─────────────────────────────────────────┐
│ 1. Receive START command                │
│    - Size, CRC, version                 │
│    - Determine inactive bank            │
└──────┬──────────────────────────────────┘
       │
       v
┌─────────────────────────────────────────┐
│ 2. Erase inactive bank                  │
│    - Bank A or Bank B (not running)     │
│    - 54 sectors × 4KB                   │
└──────┬──────────────────────────────────┘
       │
       v
┌─────────────────────────────────────────┐
│ 3. Receive DATA packets                 │
│    - Buffer in RAM (4KB)                │
│    - Write to inactive bank             │
│    - Send progress updates              │
└──────┬──────────────────────────────────┘
       │
       v
┌─────────────────────────────────────────┐
│ 4. Verify firmware                      │
│    - Calculate CRC16-CCITT              │
│    - Compare with expected CRC          │
│    - Verify size matches                │
└──────┬──────────────────────────────────┘
       │
       v
┌─────────────────────────────────────────┐
│ 5. Update boot info                     │
│    - Mark inactive bank as valid        │
│    - Switch active_bank pointer         │
│    - Reset boot_count to 0              │
│    - Write boot info to flash           │
└──────┬──────────────────────────────────┘
       │
       v
┌─────────────────────────────────────────┐
│ 6. Reset device                         │
│    - Bootloader reads boot info         │
│    - Boots from new active bank         │
│    - Old bank kept as backup            │
└─────────────────────────────────────────┘
```

## Bootloader Logic (Simplified)

The existing JieLi bootloader needs minimal modification or can be replaced:

```c
void bootloader_main(void) {
    boot_info_t boot_info;
    
    // Read boot info from flash
    norflash_read(BOOT_INFO_ADDR, (uint8_t*)&boot_info, sizeof(boot_info));
    
    // Verify boot info integrity
    uint16_t calc_crc = calculate_crc16_ccitt((uint8_t*)&boot_info, 
                                              sizeof(boot_info) - 2);
    if (calc_crc != boot_info.boot_info_crc || 
        boot_info.magic != BOOT_INFO_MAGIC) {
        // Boot info corrupted, use default (Bank A)
        boot_from_bank(BANK_A_ADDR);
        return;
    }
    
    // Get active bank
    bank_info_t *active = (boot_info.active_bank == 0) ? 
                          &boot_info.bank_a : &boot_info.bank_b;
    bank_info_t *backup = (boot_info.active_bank == 0) ? 
                          &boot_info.bank_b : &boot_info.bank_a;
    
    // Check if active bank is valid
    if (active->valid && boot_info.boot_count < boot_info.max_boot_tries) {
        // Try to boot from active bank
        boot_info.boot_count++;
        update_boot_info(&boot_info);  // Save incremented boot_count
        boot_from_bank(active->addr);
    }
    
    // Active bank failed, try backup
    if (backup->valid) {
        // Rollback to backup bank
        boot_info.active_bank = (boot_info.active_bank == 0) ? 1 : 0;
        boot_info.boot_count = 0;
        update_boot_info(&boot_info);
        boot_from_bank(backup->addr);
    }
    
    // Both banks failed, enter recovery mode
    enter_recovery_mode();
}

void boot_from_bank(uint32_t bank_addr) {
    // Jump to firmware entry point
    void (*firmware_entry)(void) = (void(*)(void))(bank_addr + 0x120);
    firmware_entry();
}
```

## Firmware Implementation

### Header File: `custom_dual_bank_ota.h`

```c
#ifndef CUSTOM_DUAL_BANK_OTA_H
#define CUSTOM_DUAL_BANK_OTA_H

#include "typedef.h"

// Flash addresses
#define BOOT_INFO_ADDR      0x001000
#define BANK_A_ADDR         0x001400
#define BANK_B_ADDR         0x037400
#define BANK_SIZE           (216 * 1024)

// Boot info
#define BOOT_INFO_MAGIC     0x4A4C4F54
#define BOOT_INFO_VERSION   0x0001
#define MAX_BOOT_TRIES      3

// OTA commands
#define CUSTOM_OTA_CMD_START    0x01
#define CUSTOM_OTA_CMD_DATA     0x02
#define CUSTOM_OTA_CMD_END      0x03

// OTA status
#define CUSTOM_OTA_STATUS_READY     0x01
#define CUSTOM_OTA_STATUS_PROGRESS  0x02
#define CUSTOM_OTA_STATUS_SUCCESS   0x03
#define CUSTOM_OTA_STATUS_ERROR     0xFF

// Error codes
#define CUSTOM_OTA_ERR_INVALID_SIZE     0x01
#define CUSTOM_OTA_ERR_ERASE_FAILED     0x02
#define CUSTOM_OTA_ERR_WRITE_FAILED     0x03
#define CUSTOM_OTA_ERR_VERIFY_FAILED    0x04
#define CUSTOM_OTA_ERR_BOOT_INFO_FAILED 0x05

// Bank info structure
typedef struct {
    uint32_t addr;
    uint32_t size;
    uint16_t crc;
    uint8_t  valid;
    uint8_t  version;
} bank_info_t;

// Boot info structure
typedef struct {
    uint32_t magic;
    uint16_t version;
    uint16_t reserved;
    bank_info_t bank_a;
    bank_info_t bank_b;
    uint8_t active_bank;
    uint8_t boot_count;
    uint8_t max_boot_tries;
    uint8_t reserved2;
    uint16_t boot_info_crc;
    uint16_t reserved3;
} boot_info_t;

// OTA context
typedef struct {
    uint8_t state;
    uint32_t total_size;
    uint32_t received_size;
    uint32_t target_bank_addr;
    uint16_t expected_crc;
    uint8_t  target_version;
    uint8_t  buffer[4096];
    uint16_t buffer_offset;
} custom_ota_ctx_t;

// External flash functions
extern int norflash_erase(uint8_t eraser, uint32_t addr);
extern int norflash_write(uint32_t addr, uint8_t *buf, uint32_t len);
extern int norflash_read(uint32_t addr, uint8_t *buf, uint32_t len);
extern void cpu_reset(void);

// Function prototypes
int custom_dual_bank_ota_init(void);
int custom_dual_bank_ota_start(uint32_t size, uint16_t crc, uint8_t version);
int custom_dual_bank_ota_data(uint8_t *data, uint16_t len);
int custom_dual_bank_ota_end(void);
uint16_t calculate_crc16_ccitt(uint8_t *data, uint32_t len);

#endif // CUSTOM_DUAL_BANK_OTA_H
```

### Implementation: `custom_dual_bank_ota.c`

```c
#include "custom_dual_bank_ota.h"
#include "system/includes.h"

// OTA states
#define OTA_STATE_IDLE      0
#define OTA_STATE_RECEIVING 1
#define OTA_STATE_VERIFYING 2
#define OTA_STATE_UPDATING  3

// Global context
static custom_ota_ctx_t ota_ctx;
static boot_info_t boot_info;

// CRC16-CCITT calculation
uint16_t calculate_crc16_ccitt(uint8_t *data, uint32_t len) {
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

// Read boot info from flash
static int read_boot_info(void) {
    if (norflash_read(BOOT_INFO_ADDR, (uint8_t*)&boot_info, 
                     sizeof(boot_info)) != 0) {
        log_error("Failed to read boot info\n");
        return -1;
    }
    
    // Verify boot info
    uint16_t calc_crc = calculate_crc16_ccitt((uint8_t*)&boot_info, 
                                              sizeof(boot_info) - 4);
    if (calc_crc != boot_info.boot_info_crc) {
        log_error("Boot info CRC mismatch\n");
        return -1;
    }
    
    if (boot_info.magic != BOOT_INFO_MAGIC) {
        log_error("Invalid boot info magic\n");
        return -1;
    }
    
    return 0;
}

// Write boot info to flash
static int write_boot_info(void) {
    // Calculate CRC
    boot_info.boot_info_crc = calculate_crc16_ccitt((uint8_t*)&boot_info, 
                                                    sizeof(boot_info) - 4);
    
    // Erase boot info sector
    if (norflash_erase(0, BOOT_INFO_ADDR) != 0) {
        log_error("Failed to erase boot info\n");
        return -1;
    }
    
    // Write boot info
    if (norflash_write(BOOT_INFO_ADDR, (uint8_t*)&boot_info, 
                      sizeof(boot_info)) != 0) {
        log_error("Failed to write boot info\n");
        return -1;
    }
    
    return 0;
}

// Initialize OTA system
int custom_dual_bank_ota_init(void) {
    memset(&ota_ctx, 0, sizeof(ota_ctx));
    ota_ctx.state = OTA_STATE_IDLE;
    
    // Read current boot info
    if (read_boot_info() != 0) {
        log_error("Failed to initialize OTA\n");
        return -1;
    }
    
    log_info("Custom Dual-Bank OTA initialized\n");
    log_info("Active bank: %d\n", boot_info.active_bank);
    log_info("Bank A: addr=0x%08x, size=%d, valid=%d, version=%d\n",
             boot_info.bank_a.addr, boot_info.bank_a.size, 
             boot_info.bank_a.valid, boot_info.bank_a.version);
    log_info("Bank B: addr=0x%08x, size=%d, valid=%d, version=%d\n",
             boot_info.bank_b.addr, boot_info.bank_b.size, 
             boot_info.bank_b.valid, boot_info.bank_b.version);
    
    return 0;
}

// Start OTA update
int custom_dual_bank_ota_start(uint32_t size, uint16_t crc, uint8_t version) {
    log_info("OTA START: size=%d, crc=0x%04x, version=%d\n", size, crc, version);
    
    // Validate size
    if (size == 0 || size > BANK_SIZE) {
        log_error("Invalid firmware size: %d\n", size);
        return CUSTOM_OTA_ERR_INVALID_SIZE;
    }
    
    // Determine target bank (inactive bank)
    uint8_t target_bank = (boot_info.active_bank == 0) ? 1 : 0;
    ota_ctx.target_bank_addr = (target_bank == 0) ? BANK_A_ADDR : BANK_B_ADDR;
    
    log_info("Target bank: %d (addr=0x%08x)\n", target_bank, ota_ctx.target_bank_addr);
    
    // Initialize context
    ota_ctx.state = OTA_STATE_RECEIVING;
    ota_ctx.total_size = size;
    ota_ctx.received_size = 0;
    ota_ctx.expected_crc = crc;
    ota_ctx.target_version = version;
    ota_ctx.buffer_offset = 0;
    
    // Erase target bank
    uint32_t sectors = (BANK_SIZE + 4095) / 4096;
    log_info("Erasing %d sectors...\n", sectors);
    
    for (uint32_t i = 0; i < sectors; i++) {
        uint32_t addr = ota_ctx.target_bank_addr + (i * 4096);
        if (norflash_erase(0, addr) != 0) {
            log_error("Erase failed at 0x%08x\n", addr);
            ota_ctx.state = OTA_STATE_IDLE;
            return CUSTOM_OTA_ERR_ERASE_FAILED;
        }
    }
    
    log_info("Target bank erased, ready to receive\n");
    return 0;
}

// Receive firmware data
int custom_dual_bank_ota_data(uint8_t *data, uint16_t len) {
    if (ota_ctx.state != OTA_STATE_RECEIVING) {
        log_error("Not in receiving state\n");
        return -1;
    }
    
    // Buffer data and write in 4KB chunks
    uint16_t remaining = len;
    uint16_t offset = 0;
    
    while (remaining > 0) {
        uint16_t to_copy = 4096 - ota_ctx.buffer_offset;
        if (to_copy > remaining) {
            to_copy = remaining;
        }
        
        memcpy(ota_ctx.buffer + ota_ctx.buffer_offset, data + offset, to_copy);
        ota_ctx.buffer_offset += to_copy;
        offset += to_copy;
        remaining -= to_copy;
        
        // Write full sector
        if (ota_ctx.buffer_offset >= 4096) {
            uint32_t write_addr = ota_ctx.target_bank_addr + ota_ctx.received_size;
            if (norflash_write(write_addr, ota_ctx.buffer, 4096) != 0) {
                log_error("Write failed at 0x%08x\n", write_addr);
                ota_ctx.state = OTA_STATE_IDLE;
                return CUSTOM_OTA_ERR_WRITE_FAILED;
            }
            
            ota_ctx.received_size += 4096;
            ota_ctx.buffer_offset = 0;
        }
    }
    
    return 0;
}

// Finalize OTA update
int custom_dual_bank_ota_end(void) {
    log_info("OTA END: Verifying firmware...\n");
    
    ota_ctx.state = OTA_STATE_VERIFYING;
    
    // Write remaining buffered data
    if (ota_ctx.buffer_offset > 0) {
        uint32_t write_addr = ota_ctx.target_bank_addr + ota_ctx.received_size;
        if (norflash_write(write_addr, ota_ctx.buffer, ota_ctx.buffer_offset) != 0) {
            log_error("Final write failed\n");
            ota_ctx.state = OTA_STATE_IDLE;
            return CUSTOM_OTA_ERR_WRITE_FAILED;
        }
        ota_ctx.received_size += ota_ctx.buffer_offset;
    }
    
    // Verify size
    if (ota_ctx.received_size != ota_ctx.total_size) {
        log_error("Size mismatch: %d != %d\n", ota_ctx.received_size, ota_ctx.total_size);
        ota_ctx.state = OTA_STATE_IDLE;
        return CUSTOM_OTA_ERR_VERIFY_FAILED;
    }
    
    // Verify CRC
    uint16_t calculated_crc = 0xFFFF;
    uint8_t verify_buf[256];
    uint32_t addr = ota_ctx.target_bank_addr;
    uint32_t remaining = ota_ctx.total_size;
    
    while (remaining > 0) {
        uint32_t to_read = (remaining > 256) ? 256 : remaining;
        if (norflash_read(addr, verify_buf, to_read) != 0) {
            log_error("Read failed during verify\n");
            ota_ctx.state = OTA_STATE_IDLE;
            return CUSTOM_OTA_ERR_VERIFY_FAILED;
        }
        
        calculated_crc = calculate_crc16_ccitt(verify_buf, to_read);
        addr += to_read;
        remaining -= to_read;
    }
    
    if (calculated_crc != ota_ctx.expected_crc) {
        log_error("CRC mismatch: 0x%04x != 0x%04x\n", 
                 calculated_crc, ota_ctx.expected_crc);
        ota_ctx.state = OTA_STATE_IDLE;
        return CUSTOM_OTA_ERR_VERIFY_FAILED;
    }
    
    log_info("Firmware verified successfully\n");
    
    // Update boot info
    ota_ctx.state = OTA_STATE_UPDATING;
    
    uint8_t target_bank = (boot_info.active_bank == 0) ? 1 : 0;
    bank_info_t *target_info = (target_bank == 0) ? &boot_info.bank_a : &boot_info.bank_b;
    
    target_info->addr = ota_ctx.target_bank_addr;
    target_info->size = ota_ctx.total_size;
    target_info->crc = calculated_crc;
    target_info->valid = 1;
    target_info->version = ota_ctx.target_version;
    
    // Switch active bank
    boot_info.active_bank = target_bank;
    boot_info.boot_count = 0;
    boot_info.max_boot_tries = MAX_BOOT_TRIES;
    
    // Write boot info
    if (write_boot_info() != 0) {
        log_error("Failed to update boot info\n");
        ota_ctx.state = OTA_STATE_IDLE;
        return CUSTOM_OTA_ERR_BOOT_INFO_FAILED;
    }
    
    log_info("Boot info updated, resetting device...\n");
    ota_ctx.state = OTA_STATE_IDLE;
    
    // Reset device
    cpu_reset();
    
    return 0;
}
```

### Integration with BLE Handler

```c
// In vm_ble_service.c
#include "custom_dual_bank_ota.h"

static int vm_ota_write_callback(void *priv, void *data, u16 len)
{
    u8 *packet = (u8 *)data;
    u8 cmd = packet[0];
    int ret = 0;
    
    switch (cmd) {
        case CUSTOM_OTA_CMD_START: {
            if (len < 8) {
                ota_send_notification(conn_handle, CUSTOM_OTA_STATUS_ERROR, 
                                    CUSTOM_OTA_ERR_INVALID_SIZE);
                return 0x0D;
            }
            
            uint32_t size = packet[1] | (packet[2] << 8) | 
                           (packet[3] << 16) | (packet[4] << 24);
            uint16_t crc = packet[5] | (packet[6] << 8);
            uint8_t version = packet[7];
            
            ret = custom_dual_bank_ota_start(size, crc, version);
            if (ret != 0) {
                ota_send_notification(conn_handle, CUSTOM_OTA_STATUS_ERROR, ret);
                return 0x0E;
            }
            
            ota_send_notification(conn_handle, CUSTOM_OTA_STATUS_READY, 0x00);
            break;
        }
        
        case CUSTOM_OTA_CMD_DATA: {
            ret = custom_dual_bank_ota_data(packet + 1, len - 1);
            if (ret != 0) {
                ota_send_notification(conn_handle, CUSTOM_OTA_STATUS_ERROR, ret);
                return 0x0E;
            }
            
            // Send progress
            uint8_t progress = (ota_ctx.received_size * 100) / ota_ctx.total_size;
            ota_send_notification(conn_handle, CUSTOM_OTA_STATUS_PROGRESS, progress);
            break;
        }
        
        case CUSTOM_OTA_CMD_END: {
            ret = custom_dual_bank_ota_end();
            if (ret != 0) {
                ota_send_notification(conn_handle, CUSTOM_OTA_STATUS_ERROR, ret);
                return 0x0E;
            }
            
            ota_send_notification(conn_handle, CUSTOM_OTA_STATUS_SUCCESS, 0x00);
            break;
        }
        
        default:
            return 0x0D;
    }
    
    return 0;
}
```

## Testing Strategy

### Phase 1: Boot Info Management (Safe)
1. Read existing boot info
2. Verify CRC calculation
3. Test write/read cycle to VM partition (not boot info yet)
4. Verify boot info structure matches expectations

### Phase 2: Bank Writing (Safe - Inactive Bank)
1. Write test data to inactive bank
2. Verify CRC of written data
3. Test erase and rewrite
4. Ensure active bank remains untouched

### Phase 3: Bank Switching (Moderate Risk)
1. Write valid firmware to inactive bank
2. Update boot info to switch banks
3. Reset device
4. Verify device boots from new bank
5. Test rollback by corrupting new bank

### Phase 4: Full OTA (Production)
1. Send app.bin via BLE
2. Monitor progress
3. Verify successful update
4. Test rollback scenarios

## Advantages Over Single-Bank

| Feature | Single-Bank | Dual-Bank |
|---------|-------------|-----------|
| Rollback | ❌ No | ✅ Yes |
| Safety | ⚠️ Low | ✅ High |
| Recovery | ❌ UART only | ✅ Automatic |
| Brick Risk | 🔴 High | 🟡 Low |
| Space | 215 KB | 430 KB |
| Complexity | ~550 lines | ~800 lines |

## Disadvantages

- ⚠️ More complex than single-bank (+250 lines)
- ⚠️ Uses more flash (430 KB vs 215 KB)
- ⚠️ Requires bootloader modification (or custom bootloader)
- ⚠️ Still needs extensive testing

## Recommendation

**This is the BEST approach for production use:**

1. ✅ **Safety** - Automatic rollback on failure
2. ✅ **Fits** - 430 KB < 1024 KB
3. ✅ **Simple firmware** - Uses raw app.bin
4. ✅ **Recoverable** - Can always boot from backup bank

**Implementation time:** 2-3 weeks including testing

**Risk level:** Medium (lower than single-bank, higher than SDK dual-bank)

**Production readiness:** High (with proper testing)

## Next Steps

1. Implement boot info structure
2. Test boot info read/write
3. Implement bank writing logic
4. Test inactive bank updates
5. Implement bank switching
6. Test rollback mechanism
7. Integrate with BLE OTA handler
8. Full end-to-end testing
