#include "vm_security.h"
#include "vm_ble_service.h"
#include "vm_storage.h"
#include <string.h>

/* JieLi SDK crypto includes - adjust as needed */
/* #include "crypto/aes.h" */
/* #include "crypto/cmac.h" */

static vm_security_state_t g_security_state;

int vm_security_init(void)
{
    int ret;
    
    memset(&g_security_state, 0, sizeof(g_security_state));
    
    /* Load bonding data from flash */
    ret = vm_storage_load_bonding(g_security_state.csrk, 
                                   &g_security_state.last_counter);
    
    if (ret == 0) {
        g_security_state.bonded = true;
    } else {
        g_security_state.bonded = false;
        g_security_state.last_counter = 0;
    }
    
    g_security_state.packets_since_save = 0;
    
    return 0;
}

bool vm_security_is_bonded(void)
{
    return g_security_state.bonded;
}

const vm_security_state_t* vm_security_get_state(void)
{
    return &g_security_state;
}

int vm_aes_cmac_32(const uint8_t *data, uint16_t len, 
                   const uint8_t *key, uint32_t *mac_out)
{
    /*
     * AES-CMAC-128 implementation
     * 
     * This needs to use JieLi SDK's crypto library.
     * The chip has CONFIG_NEW_ECC_ENABLE and CONFIG_CRYPTO_TOOLBOX_OSIZE_IN_MASKROM
     * which suggests crypto functions are available.
     * 
     * Typical implementation:
     * 1. Compute full AES-CMAC-128 (16 bytes)
     * 2. Take first 4 bytes as CMAC-32
     * 
     * Example pseudo-code:
     * 
     * uint8_t mac_128[16];
     * aes_cmac_128(data, len, key, mac_128);
     * *mac_out = (mac_128[0] << 0) | (mac_128[1] << 8) | 
     *            (mac_128[2] << 16) | (mac_128[3] << 24);
     */
    
    /* TODO: Implement using JieLi SDK crypto API */
    
    /* WARNING: Placeholder implementation - always returns 0
     * This will cause security bypass if not properly implemented!
     * All CMAC verifications will pass if expected MIC is also 0.
     * MUST be replaced with actual AES-CMAC before production use.
     */
    (void)data;  /* Suppress unused parameter warning */
    (void)len;
    (void)key;
    *mac_out = 0;
    return 0;
}

static bool vm_verify_cmac(const uint8_t *data, uint16_t len, uint32_t expected_mic)
{
    uint32_t computed_mic;
    int ret;
    
    (void)len;  /* Always use 16 bytes per protocol spec */
    
    /* Compute CMAC over first 16 bytes */
    ret = vm_aes_cmac_32(data, 16, g_security_state.csrk, &computed_mic);
    if (ret != 0) {
        return false;
    }
    
    return (computed_mic == expected_mic);
}

static bool vm_verify_counter(uint64_t counter)
{
    uint64_t last = g_security_state.last_counter;
    
    /* Counter must be strictly increasing */
    if (counter <= last) {
        return false;
    }
    
    /* Counter jump must be reasonable (prevent overflow attacks) */
    if ((counter - last) > VM_COUNTER_MAX_DELTA) {
        return false;
    }
    
    return true;
}

static void vm_update_counter(uint64_t counter)
{
    g_security_state.last_counter = counter;
    g_security_state.packets_since_save++;
    
    /* Periodically save to flash */
    if (g_security_state.packets_since_save >= VM_COUNTER_FLASH_INTERVAL) {
        vm_storage_save_counter(counter);
        g_security_state.packets_since_save = 0;
    }
}

int vm_security_verify_packet(const uint8_t *data, uint16_t len, 
                               uint64_t counter, uint32_t mic)
{
    /* Check if bonded */
    if (!g_security_state.bonded) {
        return VM_ERR_NOT_BONDED;
    }
    
    /* Verify counter (replay protection) */
    if (!vm_verify_counter(counter)) {
        /* Check for counter overflow */
        if (counter < g_security_state.last_counter) {
            /* Counter wrapped - force re-pairing */
            vm_security_clear_bonding();
            /* TODO: Trigger disconnect via BLE stack */
        }
        return VM_ERR_REPLAY_ATTACK;
    }
    
    /* Verify CMAC (authentication) */
    if (!vm_verify_cmac(data, len, mic)) {
        return VM_ERR_AUTH_FAILED;
    }
    
    /* Update counter in RAM */
    vm_update_counter(counter);
    
    return VM_ERR_OK;
}

int vm_security_on_bonding_complete(const uint8_t *csrk)
{
    if (!csrk) {
        return -1;
    }
    
    /* Store CSRK */
    memcpy(g_security_state.csrk, csrk, 16);
    
    /* Reset counter */
    g_security_state.last_counter = 0;
    g_security_state.packets_since_save = 0;
    g_security_state.bonded = true;
    
    /* Save to flash */
    return vm_storage_save_bonding(csrk, 0);
}

void vm_security_on_disconnect(void)
{
    /* Ensure counter is persisted */
    if (g_security_state.packets_since_save > 0) {
        vm_storage_save_counter(g_security_state.last_counter);
        g_security_state.packets_since_save = 0;
    }
}

int vm_security_clear_bonding(void)
{
    memset(&g_security_state, 0, sizeof(g_security_state));
    g_security_state.bonded = false;
    
    return vm_storage_clear_bonding();
}
