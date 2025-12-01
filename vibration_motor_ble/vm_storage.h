#ifndef VM_STORAGE_H
#define VM_STORAGE_H

#include <stdint.h>

/* Flash NVS storage keys */
#define VM_NVS_KEY_CSRK         "vm_csrk"
#define VM_NVS_KEY_COUNTER      "vm_counter"
#define VM_NVS_KEY_BONDED       "vm_bonded"

/**
 * Initialize storage module
 * @return 0 on success
 */
int vm_storage_init(void);

/**
 * Save bonding data to flash
 * @param csrk 16-byte CSRK
 * @param counter Initial counter value
 * @return 0 on success
 */
int vm_storage_save_bonding(const uint8_t *csrk, uint64_t counter);

/**
 * Load bonding data from flash
 * @param csrk Output buffer for 16-byte CSRK
 * @param counter Output counter value
 * @return 0 on success, -1 if not bonded
 */
int vm_storage_load_bonding(uint8_t *csrk, uint64_t *counter);

/**
 * Save counter to flash
 * @param counter Counter value
 * @return 0 on success
 */
int vm_storage_save_counter(uint64_t counter);

/**
 * Clear all bonding data
 * @return 0 on success
 */
int vm_storage_clear_bonding(void);

#endif /* VM_STORAGE_H */
