#include "vm_storage.h"
#include <string.h>

/* JieLi SDK includes */
#include "syscfg_id.h"
#include "typedef.h"

/*
 * VM item IDs - using range 50-99 (CFG_STORE_VM_ONLY_BEGIN to CFG_STORE_VM_ONLY_END)
 * These IDs are reserved for VM-only storage and won't conflict with system IDs
 */
#define VM_ID_CSRK          50
#define VM_ID_COUNTER       51
#define VM_ID_BONDED_FLAG   52

int vm_storage_init(void)
{
    /* VM system is typically initialized by SDK */
    return 0;
}

int vm_storage_save_bonding(const uint8_t *csrk, uint64_t counter)
{
    int ret;
    u8 bonded_flag = 1;
    
    if (!csrk) {
        return -1;
    }
    
    /* Save CSRK (16 bytes) */
    ret = syscfg_write(VM_ID_CSRK, (void *)csrk, 16);
    if (ret != 16) {
        return -1;
    }
    
    /* Save counter (8 bytes) */
    ret = syscfg_write(VM_ID_COUNTER, (void *)&counter, 8);
    if (ret != 8) {
        return -1;
    }
    
    /* Save bonded flag (1 byte) */
    ret = syscfg_write(VM_ID_BONDED_FLAG, &bonded_flag, 1);
    if (ret != 1) {
        return -1;
    }
    
    return 0;
}

int vm_storage_load_bonding(uint8_t *csrk, uint64_t *counter)
{
    int ret;
    u8 bonded_flag = 0;
    
    if (!csrk || !counter) {
        return -1;
    }
    
    /* Check bonded flag */
    ret = syscfg_read(VM_ID_BONDED_FLAG, &bonded_flag, 1);
    if (ret != 1 || bonded_flag != 1) {
        return -1;  /* Not bonded */
    }
    
    /* Load CSRK */
    ret = syscfg_read(VM_ID_CSRK, csrk, 16);
    if (ret != 16) {
        return -1;
    }
    
    /* Load counter */
    ret = syscfg_read(VM_ID_COUNTER, (u8 *)counter, 8);
    if (ret != 8) {
        return -1;
    }
    
    return 0;
}

int vm_storage_save_counter(uint64_t counter)
{
    int ret = syscfg_write(VM_ID_COUNTER, (void *)&counter, 8);
    return (ret == 8) ? 0 : -1;
}

int vm_storage_clear_bonding(void)
{
    u8 clear_flag = 0;
    
    /* Clear bonded flag - this effectively unbonds the device */
    syscfg_write(VM_ID_BONDED_FLAG, &clear_flag, 1);
    
    /* Note: We don't need to erase CSRK and counter, just clearing the flag
     * is sufficient. They will be overwritten on next bonding. */
    
    return 0;
}
