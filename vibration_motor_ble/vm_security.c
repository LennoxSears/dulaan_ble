#include "vm_security.h"
#include "vm_ble_service.h"
#include "vm_storage.h"
#include <string.h>

/* mbedtls includes for AES-CMAC */
#include "mbedtls/cipher.h"
#include "mbedtls/cmac.h"

/* Critical section protection */
/* TODO: Replace with actual SDK critical section API */
#define VM_ENTER_CRITICAL()  /* __disable_irq() or similar */
#define VM_EXIT_CRITICAL()   /* __enable_irq() or similar */

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
    mbedtls_cipher_context_t ctx;
    unsigned char mac_128[16];
    int ret;
    
    /* Initialize cipher context */
    mbedtls_cipher_init(&ctx);
    
    /* Setup AES-128 cipher */
    ret = mbedtls_cipher_setup(&ctx, 
                               mbedtls_cipher_info_from_type(MBEDTLS_CIPHER_AES_128_ECB));
    if (ret != 0) {
        mbedtls_cipher_free(&ctx);
        return -1;
    }
    
    /* Start CMAC */
    ret = mbedtls_cipher_cmac_starts(&ctx, key, 128);
    if (ret != 0) {
        mbedtls_cipher_free(&ctx);
        return -1;
    }
    
    /* Update with data */
    ret = mbedtls_cipher_cmac_update(&ctx, data, len);
    if (ret != 0) {
        mbedtls_cipher_free(&ctx);
        return -1;
    }
    
    /* Finish and get MAC */
    ret = mbedtls_cipher_cmac_finish(&ctx, mac_128);
    mbedtls_cipher_free(&ctx);
    
    if (ret != 0) {
        return -1;
    }
    
    /* Take first 4 bytes as CMAC-32 (little-endian) */
    *mac_out = ((uint32_t)mac_128[0] << 0)  |
               ((uint32_t)mac_128[1] << 8)  |
               ((uint32_t)mac_128[2] << 16) |
               ((uint32_t)mac_128[3] << 24);
    
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
    /* Protect state access from concurrent BLE events */
    VM_ENTER_CRITICAL();
    
    g_security_state.last_counter = counter;
    g_security_state.packets_since_save++;
    
    /* Check if we need to save */
    bool need_save = (g_security_state.packets_since_save >= VM_COUNTER_FLASH_INTERVAL);
    
    VM_EXIT_CRITICAL();
    
    /* Save to flash outside critical section (may block) */
    if (need_save) {
        int ret = vm_storage_save_counter(counter);
        if (ret == 0) {
            /* Success - reset counter */
            VM_ENTER_CRITICAL();
            g_security_state.packets_since_save = 0;
            VM_EXIT_CRITICAL();
        }
        /* If failed, will retry on next packet (packets_since_save not reset) */
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
    VM_ENTER_CRITICAL();
    bool need_save = (g_security_state.packets_since_save > 0);
    uint64_t counter = g_security_state.last_counter;
    VM_EXIT_CRITICAL();
    
    if (need_save) {
        vm_storage_save_counter(counter);
        VM_ENTER_CRITICAL();
        g_security_state.packets_since_save = 0;
        VM_EXIT_CRITICAL();
    }
}

void vm_security_on_power_down(void)
{
    /* Same as disconnect - save counter before power loss */
    vm_security_on_disconnect();
}

int vm_security_clear_bonding(void)
{
    memset(&g_security_state, 0, sizeof(g_security_state));
    g_security_state.bonded = false;
    
    return vm_storage_clear_bonding();
}
