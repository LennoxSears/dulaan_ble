/**
 * Custom Dual-Bank OTA Implementation
 * 
 * Implements dual-bank OTA update with automatic rollback using low-level
 * flash functions. Works with raw app.bin (215 KB) instead of jl_isd.fw (450 KB).
 * 
 * Flash Layout (1MB total):
 * 0x000000 - 0x001000 (4 KB):    Bootloader (SDK managed)
 * 0x001000 - 0x001400 (1 KB):    Custom Boot Info
 * 0x001400 - 0x037400 (216 KB):  Bank A (app.bin)
 * 0x037400 - 0x06D400 (216 KB):  Bank B (app.bin)
 * 0x06D400 - 0x100000 (589 KB):  VM/Data partition
 */

#ifndef CUSTOM_DUAL_BANK_OTA_H
#define CUSTOM_DUAL_BANK_OTA_H

#include "typedef.h"

/* Flash addresses and sizes */
#define CUSTOM_BOOT_INFO_ADDR   0x001000    /* Boot info location */
#define CUSTOM_BANK_A_ADDR      0x001400    /* Bank A start */
#define CUSTOM_BANK_B_ADDR      0x037400    /* Bank B start */
#define CUSTOM_BANK_SIZE        (216 * 1024) /* 216 KB per bank */
#define CUSTOM_FLASH_SECTOR     4096        /* 4KB sector size */

/* Boot info magic and version */
#define CUSTOM_BOOT_MAGIC       0x4A4C4F54  /* 'JLOT' */
#define CUSTOM_BOOT_VERSION     0x0001
#define MAX_BOOT_TRIES          3           /* Max boot attempts before rollback */

/* OTA states */
#define CUSTOM_OTA_STATE_IDLE       0
#define CUSTOM_OTA_STATE_RECEIVING  1
#define CUSTOM_OTA_STATE_VERIFYING  2
#define CUSTOM_OTA_STATE_UPDATING   3

/* Bank information structure */
typedef struct {
    u32 addr;           /* Flash address of bank */
    u32 size;           /* Actual firmware size in bytes */
    u16 crc;            /* CRC16-CCITT of firmware */
    u8  valid;          /* 1 = valid, 0 = invalid */
    u8  version;        /* Firmware version number */
} custom_bank_info_t;

/* Boot info structure (stored at CUSTOM_BOOT_INFO_ADDR) */
typedef struct {
    /* Header */
    u32 magic;          /* CUSTOM_BOOT_MAGIC */
    u16 version;        /* CUSTOM_BOOT_VERSION */
    u16 reserved1;
    
    /* Bank information */
    custom_bank_info_t bank_a;
    custom_bank_info_t bank_b;
    
    /* Active bank tracking */
    u8 active_bank;     /* 0 = Bank A, 1 = Bank B */
    u8 boot_count;      /* Incremented on each boot attempt */
    u8 max_boot_tries;  /* Max attempts before rollback */
    u8 reserved2;
    
    /* Integrity */
    u16 boot_info_crc;  /* CRC16 of this structure (excluding this field) */
    u16 reserved3;
} custom_boot_info_t;

/* OTA context */
typedef struct {
    u8 state;                   /* Current OTA state */
    u32 total_size;             /* Total firmware size */
    u32 received_size;          /* Bytes received so far */
    u32 target_bank_addr;       /* Target bank flash address */
    u16 expected_crc;           /* Expected CRC from START command */
    u8 target_version;          /* Target firmware version */
    u8 buffer[CUSTOM_FLASH_SECTOR]; /* 4KB sector buffer */
    u16 buffer_offset;          /* Current offset in buffer */
} custom_ota_ctx_t;

/* External flash functions (from SDK) */
extern int norflash_erase(u8 eraser, u32 addr);
extern int norflash_write(u32 addr, u8 *buf, u32 len);
extern int norflash_read(u32 addr, u8 *buf, u32 len);
extern void cpu_reset(void);

/* External CRC function (from SDK) */
extern u16 CRC16(const void *ptr, u32 len);

/* Function prototypes */

/**
 * Initialize custom dual-bank OTA system
 * Reads and validates boot info from flash
 * @return 0 on success, negative on error
 */
int custom_dual_bank_ota_init(void);

/**
 * Start OTA update
 * @param size Firmware size in bytes
 * @param crc Expected CRC16 of firmware
 * @param version Firmware version number
 * @return 0 on success, error code on failure
 */
int custom_dual_bank_ota_start(u32 size, u16 crc, u8 version);

/**
 * Write firmware data
 * @param data Pointer to firmware data
 * @param len Length of data
 * @return 0 on success, error code on failure
 */
int custom_dual_bank_ota_data(u8 *data, u16 len);

/**
 * Finalize OTA update
 * Verifies CRC, updates boot info, and resets device
 * @return 0 on success, error code on failure
 */
int custom_dual_bank_ota_end(void);

/**
 * Get current OTA progress (0-100)
 * @return Progress percentage
 */
u8 custom_dual_bank_ota_get_progress(void);

/**
 * Get active bank number
 * @return 0 for Bank A, 1 for Bank B
 */
u8 custom_dual_bank_get_active_bank(void);

/**
 * Get firmware version of specified bank
 * @param bank Bank number (0 or 1)
 * @return Firmware version, or 0 if invalid
 */
u8 custom_dual_bank_get_bank_version(u8 bank);

#endif /* CUSTOM_DUAL_BANK_OTA_H */
