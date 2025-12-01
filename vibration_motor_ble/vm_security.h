#ifndef VM_SECURITY_H
#define VM_SECURITY_H

#include <stdint.h>
#include <stdbool.h>

/* Security configuration */
#define VM_COUNTER_FLASH_INTERVAL   256     /* Write to flash every N packets */
#define VM_COUNTER_MAX_DELTA        (1ULL << 30)  /* Max allowed counter jump */

/* Security state */
typedef struct {
    uint64_t last_counter;          /* Last valid counter (RAM) */
    uint32_t packets_since_save;    /* Packets received since last flash write */
    uint8_t csrk[16];               /* Connection Signature Resolving Key */
    bool bonded;                    /* Bonding status */
} vm_security_state_t;

/**
 * Initialize security module
 * Loads keys and counter from flash
 * @return 0 on success
 */
int vm_security_init(void);

/**
 * Verify incoming packet
 * Checks counter for replay protection and verifies CMAC
 * @param data Packet data (first 16 bytes for CMAC)
 * @param len Total packet length
 * @param counter Counter value from packet
 * @param mic MIC value from packet
 * @return VM_ERR_OK on success, error code otherwise
 */
int vm_security_verify_packet(const uint8_t *data, uint16_t len, 
                               uint64_t counter, uint32_t mic);

/**
 * Handle bonding complete event
 * Stores LTK and CSRK to flash
 * @param csrk Connection Signature Resolving Key
 * @return 0 on success
 */
int vm_security_on_bonding_complete(const uint8_t *csrk);

/**
 * Handle disconnection
 * Ensures counter is saved to flash
 */
void vm_security_on_disconnect(void);

/**
 * Clear bonding data
 * Called on counter overflow or manual unbond
 * @return 0 on success
 */
int vm_security_clear_bonding(void);

/**
 * Check if device is bonded
 * @return true if bonded
 */
bool vm_security_is_bonded(void);

/**
 * Get current security state (for debugging)
 * @return Pointer to security state
 */
const vm_security_state_t* vm_security_get_state(void);

/**
 * Compute AES-CMAC-32 (first 32 bits of AES-CMAC-128)
 * @param data Input data
 * @param len Data length
 * @param key 128-bit key (CSRK)
 * @param mac_out Output 32-bit MAC
 * @return 0 on success
 */
int vm_aes_cmac_32(const uint8_t *data, uint16_t len, 
                   const uint8_t *key, uint32_t *mac_out);

#endif /* VM_SECURITY_H */
