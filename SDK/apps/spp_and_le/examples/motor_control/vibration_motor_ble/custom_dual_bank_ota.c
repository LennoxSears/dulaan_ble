/**
 * Custom Dual-Bank OTA Implementation
 */

#include "custom_dual_bank_ota.h"
#include "system/includes.h"
#include "asm/crc16.h"

/* Logging macros */
#define log_info(fmt, ...)   printf("[CUSTOM_OTA] " fmt, ##__VA_ARGS__)
#define log_error(fmt, ...)  printf("[CUSTOM_OTA_ERROR] " fmt, ##__VA_ARGS__)

/* Global boot info and OTA context */
static custom_boot_info_t g_boot_info;
static custom_ota_ctx_t g_ota_ctx;
static u8 g_initialized = 0;

/* Error codes */
#define ERR_INVALID_SIZE        0x01
#define ERR_ERASE_FAILED        0x02
#define ERR_WRITE_FAILED        0x03
#define ERR_VERIFY_FAILED       0x04
#define ERR_BOOT_INFO_FAILED    0x05
#define ERR_NOT_INITIALIZED     0x06
#define ERR_INVALID_STATE       0x07

/**
 * Calculate CRC16 of boot info structure
 */
static u16 calculate_boot_info_crc(const custom_boot_info_t *info)
{
    /* CRC of entire structure except the crc field itself */
    u32 crc_len = sizeof(custom_boot_info_t) - sizeof(u16) - sizeof(u16);
    return CRC16(info, crc_len);
}

/**
 * Read boot info from flash
 */
static int read_boot_info(void)
{
    int ret;
    
    /* Read boot info from flash */
    ret = norflash_read(CUSTOM_BOOT_INFO_ADDR, (u8*)&g_boot_info, sizeof(g_boot_info));
    if (ret != 0) {
        log_error("Custom OTA: Failed to read boot info\n");
        return -1;
    }
    
    /* Verify magic number */
    if (g_boot_info.magic != CUSTOM_BOOT_MAGIC) {
        log_info("Custom OTA: Invalid magic, initializing boot info\n");
        return -1;
    }
    
    /* Verify CRC */
    u16 calc_crc = calculate_boot_info_crc(&g_boot_info);
    if (calc_crc != g_boot_info.boot_info_crc) {
        log_error("Custom OTA: Boot info CRC mismatch (expected 0x%04x, got 0x%04x)\n",
                 g_boot_info.boot_info_crc, calc_crc);
        return -1;
    }
    
    log_info("Custom OTA: Boot info loaded successfully\n");
    log_info("  Active bank: %d\n", g_boot_info.active_bank);
    log_info("  Bank A: addr=0x%08x, size=%d, valid=%d, version=%d\n",
             g_boot_info.bank_a.addr, g_boot_info.bank_a.size,
             g_boot_info.bank_a.valid, g_boot_info.bank_a.version);
    log_info("  Bank B: addr=0x%08x, size=%d, valid=%d, version=%d\n",
             g_boot_info.bank_b.addr, g_boot_info.bank_b.size,
             g_boot_info.bank_b.valid, g_boot_info.bank_b.version);
    
    return 0;
}

/**
 * Write boot info to flash
 */
static int write_boot_info(void)
{
    int ret;
    
    /* Calculate CRC */
    g_boot_info.boot_info_crc = calculate_boot_info_crc(&g_boot_info);
    
    log_info("Custom OTA: Writing boot info (CRC=0x%04x)\n", g_boot_info.boot_info_crc);
    
    /* Erase boot info sector */
    /* WARNING: Power loss between erase and write will corrupt boot info */
    /* TODO: Implement double-buffering or backup mechanism */
    ret = norflash_erase(0, CUSTOM_BOOT_INFO_ADDR);
    if (ret != 0) {
        log_error("Custom OTA: Failed to erase boot info sector\n");
        return ERR_BOOT_INFO_FAILED;
    }
    
    /* Write boot info immediately after erase to minimize risk window */
    ret = norflash_write(CUSTOM_BOOT_INFO_ADDR, (u8*)&g_boot_info, sizeof(g_boot_info));
    if (ret != 0) {
        log_error("Custom OTA: Failed to write boot info\n");
        return ERR_BOOT_INFO_FAILED;
    }
    
    log_info("Custom OTA: Boot info written successfully\n");
    return 0;
}

/**
 * Initialize boot info with default values
 */
static void init_default_boot_info(void)
{
    log_info("Custom OTA: Initializing default boot info\n");
    
    memset(&g_boot_info, 0, sizeof(g_boot_info));
    
    /* Header */
    g_boot_info.magic = CUSTOM_BOOT_MAGIC;
    g_boot_info.version = CUSTOM_BOOT_VERSION;
    
    /* Bank A (current running firmware) */
    g_boot_info.bank_a.addr = CUSTOM_BANK_A_ADDR;
    g_boot_info.bank_a.size = 0;  /* Unknown */
    g_boot_info.bank_a.crc = 0;
    g_boot_info.bank_a.valid = 1;  /* Assume current firmware is valid */
    g_boot_info.bank_a.version = 1;
    
    /* Bank B (empty) */
    g_boot_info.bank_b.addr = CUSTOM_BANK_B_ADDR;
    g_boot_info.bank_b.size = 0;
    g_boot_info.bank_b.crc = 0;
    g_boot_info.bank_b.valid = 0;
    g_boot_info.bank_b.version = 0;
    
    /* Active bank */
    g_boot_info.active_bank = 0;  /* Bank A */
    g_boot_info.boot_count = 0;
    g_boot_info.max_boot_tries = MAX_BOOT_TRIES;
    
    /* Write to flash */
    write_boot_info();
}

/**
 * Initialize custom dual-bank OTA system
 */
int custom_dual_bank_ota_init(void)
{
    if (g_initialized) {
        return 0;
    }
    
    log_info("Custom OTA: Initializing dual-bank OTA system\n");
    
    /* Clear OTA context */
    memset(&g_ota_ctx, 0, sizeof(g_ota_ctx));
    g_ota_ctx.state = CUSTOM_OTA_STATE_IDLE;
    
    /* Read boot info */
    if (read_boot_info() != 0) {
        /* Boot info invalid or missing, initialize with defaults */
        init_default_boot_info();
    }
    
    g_initialized = 1;
    log_info("Custom OTA: Initialization complete\n");
    
    return 0;
}

/**
 * Start OTA update
 */
int custom_dual_bank_ota_start(u32 size, u16 crc, u8 version)
{
    int ret;
    u32 sectors;
    u32 i;
    
    if (!g_initialized) {
        log_error("Custom OTA: Not initialized\n");
        return ERR_NOT_INITIALIZED;
    }
    
    if (g_ota_ctx.state != CUSTOM_OTA_STATE_IDLE) {
        log_error("Custom OTA: Already in progress\n");
        return ERR_INVALID_STATE;
    }
    
    log_info("Custom OTA: START - size=%d, crc=0x%04x, version=%d\n", size, crc, version);
    
    /* Validate size */
    if (size == 0 || size > CUSTOM_BANK_SIZE) {
        log_error("Custom OTA: Invalid size %d (max %d)\n", size, CUSTOM_BANK_SIZE);
        return ERR_INVALID_SIZE;
    }
    
    /* Determine target bank (inactive bank) */
    u8 target_bank = (g_boot_info.active_bank == 0) ? 1 : 0;
    g_ota_ctx.target_bank_addr = (target_bank == 0) ? CUSTOM_BANK_A_ADDR : CUSTOM_BANK_B_ADDR;
    
    log_info("Custom OTA: Target bank %d at 0x%08x\n", target_bank, g_ota_ctx.target_bank_addr);
    
    /* Initialize OTA context */
    g_ota_ctx.state = CUSTOM_OTA_STATE_RECEIVING;
    g_ota_ctx.total_size = size;
    g_ota_ctx.received_size = 0;
    g_ota_ctx.expected_crc = crc;
    g_ota_ctx.target_version = version;
    g_ota_ctx.buffer_offset = 0;
    
    /* Erase target bank */
    sectors = (CUSTOM_BANK_SIZE + CUSTOM_FLASH_SECTOR - 1) / CUSTOM_FLASH_SECTOR;
    log_info("Custom OTA: Erasing %d sectors...\n", sectors);
    
    for (i = 0; i < sectors; i++) {
        u32 addr = g_ota_ctx.target_bank_addr + (i * CUSTOM_FLASH_SECTOR);
        ret = norflash_erase(0, addr);
        if (ret != 0) {
            log_error("Custom OTA: Erase failed at 0x%08x\n", addr);
            g_ota_ctx.state = CUSTOM_OTA_STATE_IDLE;
            return ERR_ERASE_FAILED;
        }
        
        /* Log progress every 10 sectors */
        if ((i + 1) % 10 == 0) {
            log_info("Custom OTA: Erased %d/%d sectors\n", i + 1, sectors);
        }
    }
    
    log_info("Custom OTA: Target bank erased, ready to receive\n");
    return 0;
}

/**
 * Write firmware data
 */
int custom_dual_bank_ota_data(u8 *data, u16 len)
{
    int ret;
    u16 remaining;
    u16 offset;
    
    if (g_ota_ctx.state != CUSTOM_OTA_STATE_RECEIVING) {
        log_error("Custom OTA: Not in receiving state\n");
        return ERR_INVALID_STATE;
    }
    
    /* Buffer data and write in 4KB chunks */
    remaining = len;
    offset = 0;
    
    while (remaining > 0) {
        u16 to_copy = CUSTOM_FLASH_SECTOR - g_ota_ctx.buffer_offset;
        if (to_copy > remaining) {
            to_copy = remaining;
        }
        
        /* Copy to buffer */
        memcpy(g_ota_ctx.buffer + g_ota_ctx.buffer_offset, data + offset, to_copy);
        g_ota_ctx.buffer_offset += to_copy;
        offset += to_copy;
        remaining -= to_copy;
        
        /* Write full sector to flash */
        if (g_ota_ctx.buffer_offset >= CUSTOM_FLASH_SECTOR) {
            u32 write_addr = g_ota_ctx.target_bank_addr + g_ota_ctx.received_size;
            
            ret = norflash_write(write_addr, g_ota_ctx.buffer, CUSTOM_FLASH_SECTOR);
            if (ret != 0) {
                log_error("Custom OTA: Write failed at 0x%08x\n", write_addr);
                g_ota_ctx.state = CUSTOM_OTA_STATE_IDLE;
                return ERR_WRITE_FAILED;
            }
            
            g_ota_ctx.received_size += CUSTOM_FLASH_SECTOR;
            g_ota_ctx.buffer_offset = 0;
            
            /* Log progress every 64KB */
            if (g_ota_ctx.received_size % (64 * 1024) == 0) {
                log_info("Custom OTA: Written %d/%d bytes (%d%%)\n",
                        g_ota_ctx.received_size, g_ota_ctx.total_size,
                        (g_ota_ctx.received_size * 100) / g_ota_ctx.total_size);
            }
        }
    }
    
    return 0;
}

/**
 * Finalize OTA update
 */
int custom_dual_bank_ota_end(void)
{
    int ret;
    u32 addr;
    u32 remaining;
    u8 verify_buf[256];
    u16 calculated_crc;
    u8 target_bank;
    custom_bank_info_t *target_info;
    
    log_info("Custom OTA: END - Verifying firmware...\n");
    
    if (g_ota_ctx.state != CUSTOM_OTA_STATE_RECEIVING) {
        log_error("Custom OTA: Not in receiving state\n");
        return ERR_INVALID_STATE;
    }
    
    g_ota_ctx.state = CUSTOM_OTA_STATE_VERIFYING;
    
    /* Write remaining buffered data */
    if (g_ota_ctx.buffer_offset > 0) {
        u32 write_addr = g_ota_ctx.target_bank_addr + g_ota_ctx.received_size;
        
        ret = norflash_write(write_addr, g_ota_ctx.buffer, g_ota_ctx.buffer_offset);
        if (ret != 0) {
            log_error("Custom OTA: Final write failed\n");
            g_ota_ctx.state = CUSTOM_OTA_STATE_IDLE;
            return ERR_WRITE_FAILED;
        }
        
        g_ota_ctx.received_size += g_ota_ctx.buffer_offset;
    }
    
    /* Verify size */
    if (g_ota_ctx.received_size != g_ota_ctx.total_size) {
        log_error("Custom OTA: Size mismatch: %d != %d\n",
                 g_ota_ctx.received_size, g_ota_ctx.total_size);
        g_ota_ctx.state = CUSTOM_OTA_STATE_IDLE;
        return ERR_VERIFY_FAILED;
    }
    
    /* Calculate CRC of written firmware */
    /* WARNING: This allocates entire firmware size in RAM (215 KB) */
    /* May fail on systems with limited RAM */
    /* TODO: Implement incremental CRC using CRC16_with_initval() */
    log_info("Custom OTA: Calculating CRC for entire firmware (allocating %d bytes)...\n", g_ota_ctx.total_size);
    
    u8 *temp_buf = malloc(g_ota_ctx.total_size);
    if (temp_buf == NULL) {
        log_error("Custom OTA: Failed to allocate %d bytes for CRC verification\n", g_ota_ctx.total_size);
        log_error("Custom OTA: System may have insufficient RAM\n");
        g_ota_ctx.state = CUSTOM_OTA_STATE_IDLE;
        return ERR_VERIFY_FAILED;
    }
    
    log_info("Custom OTA: Memory allocated, reading firmware from flash...\n");
    ret = norflash_read(g_ota_ctx.target_bank_addr, temp_buf, g_ota_ctx.total_size);
    if (ret != 0) {
        log_error("Custom OTA: Failed to read firmware for CRC\n");
        free(temp_buf);
        g_ota_ctx.state = CUSTOM_OTA_STATE_IDLE;
        return ERR_VERIFY_FAILED;
    }
    
    log_info("Custom OTA: Firmware read, calculating CRC16...\n");
    calculated_crc = CRC16(temp_buf, g_ota_ctx.total_size);
    free(temp_buf);
    log_info("Custom OTA: Memory freed\n");
    
    log_info("Custom OTA: CRC calculated: 0x%04x (expected: 0x%04x)\n",
             calculated_crc, g_ota_ctx.expected_crc);
    
    /* Verify CRC */
    if (calculated_crc != g_ota_ctx.expected_crc) {
        log_error("Custom OTA: CRC mismatch!\n");
        g_ota_ctx.state = CUSTOM_OTA_STATE_IDLE;
        return ERR_VERIFY_FAILED;
    }
    
    log_info("Custom OTA: Firmware verified successfully\n");
    
    /* Update boot info */
    g_ota_ctx.state = CUSTOM_OTA_STATE_UPDATING;
    
    target_bank = (g_boot_info.active_bank == 0) ? 1 : 0;
    target_info = (target_bank == 0) ? &g_boot_info.bank_a : &g_boot_info.bank_b;
    
    target_info->addr = g_ota_ctx.target_bank_addr;
    target_info->size = g_ota_ctx.total_size;
    target_info->crc = calculated_crc;
    target_info->valid = 1;
    target_info->version = g_ota_ctx.target_version;
    
    /* Switch active bank */
    g_boot_info.active_bank = target_bank;
    g_boot_info.boot_count = 0;
    g_boot_info.max_boot_tries = MAX_BOOT_TRIES;
    
    /* Write boot info */
    ret = write_boot_info();
    if (ret != 0) {
        log_error("Custom OTA: Failed to update boot info\n");
        g_ota_ctx.state = CUSTOM_OTA_STATE_IDLE;
        return ret;
    }
    
    log_info("Custom OTA: Boot info updated, resetting device...\n");
    g_ota_ctx.state = CUSTOM_OTA_STATE_IDLE;
    
    /* Reset device to boot into new firmware */
    os_time_dly(100);  /* Give time for logs to flush */
    cpu_reset();
    
    return 0;
}

/**
 * Get current OTA progress (0-100)
 */
u8 custom_dual_bank_ota_get_progress(void)
{
    if (g_ota_ctx.total_size == 0) {
        return 0;
    }
    
    return (g_ota_ctx.received_size * 100) / g_ota_ctx.total_size;
}

/**
 * Get active bank number
 */
u8 custom_dual_bank_get_active_bank(void)
{
    return g_boot_info.active_bank;
}

/**
 * Get firmware version of specified bank
 */
u8 custom_dual_bank_get_bank_version(u8 bank)
{
    if (bank == 0) {
        return g_boot_info.bank_a.version;
    } else if (bank == 1) {
        return g_boot_info.bank_b.version;
    }
    return 0;
}
