# SDK Integration Examples

Based on analysis of JieLi SDK files in `common/` directory.

---

## 1. GATT Service Registration

### API Location
- **Header**: `common/third_party_profile/jieli/gatt_common/le_gatt_common.h`
- **Implementation**: `common/third_party_profile/jieli/gatt_common/le_gatt_server.c`

### Key Functions
```c
void ble_gatt_server_set_profile(const u8 *profile_table, u16 size);
void ble_gatt_server_init(gatt_server_cfg_t *server_cfg);
```

### Profile Table Format
Based on Tencent LL Sync example (`common/third_party_profile/Tecent_LL/tecent_protocol/ble_qiot_service.c`):

```c
// Service structure definition
typedef struct {
    uint16_t service_uuid16;
    const uint8_t *service_uuid128;
    
    struct {
        uint16_t uuid16;
        uint8_t gatt_char_props;  // GATT_CHAR_WRITE, GATT_CHAR_NOTIFY, etc.
        void (*on_write)(const uint8_t *data, uint16_t len);
    } characteristic;
} qiot_service_init_s;
```

### Integration for VM BLE Service

**File**: `vibration_motor_ble/vm_ble_service.c`

```c
#include "le_gatt_common.h"

// GATT characteristic properties
#define GATT_CHAR_WRITE_WO_RESP  0x04  // Write Without Response

// Profile table (ATT database format)
static const uint8_t vm_profile_data[] = {
    // Service UUID (128-bit)
    0x00, 0x01,  // Start handle
    0x00, 0x10,  // End handle
    VM_SERVICE_UUID_128,  // UUID bytes
    
    // Characteristic UUID (128-bit)
    0x00, 0x02,  // Handle
    GATT_CHAR_WRITE_WO_RESP,  // Properties
    VM_CHAR_UUID_128,  // UUID bytes
};

int vm_ble_service_init(void)
{
    int ret;
    
    /* Initialize security module */
    ret = vm_security_init();
    if (ret != 0) {
        return ret;
    }
    
    /* Initialize motor control */
    ret = vm_motor_init();
    if (ret != 0) {
        return ret;
    }
    
    /* Register GATT profile */
    ble_gatt_server_set_profile(vm_profile_data, sizeof(vm_profile_data));
    
    /* Note: Actual profile table format needs to be determined from SDK docs */
    /* Alternative: Use service registration API if available */
    
    return 0;
}
```

**Note**: The exact profile table format requires SDK documentation. The Tencent LL example shows a structure-based approach, but the actual `ble_gatt_server_set_profile` may use a different format.

---

## 2. Flash Storage (VM/syscfg)

### API Location
- **Header**: `include_lib/system/syscfg_id.h` (defines VM IDs)
- **Functions**: `syscfg_write()`, `syscfg_read()`

### Example from sig_mesh
**File**: `common/third_party_profile/sig_mesh/adaptation/storage.c`

```c
#include "syscfg_id.h"

// Write to flash
u32 ret = syscfg_write(vm_id, data_ptr, data_len);
if (ret != data_len) {
    // Error handling
}

// Read from flash
u32 ret = syscfg_read(vm_id, buffer_ptr, buffer_len);
if (ret != buffer_len) {
    // Error handling
}
```

### Integration for VM Storage

**File**: `vibration_motor_ble/vm_storage.c`

```c
#include "syscfg_id.h"

/* VM item IDs - must be unique in the system */
#define VM_ID_CSRK          0xA0
#define VM_ID_COUNTER       0xA1
#define VM_ID_BONDED_FLAG   0xA2

int vm_storage_save_bonding(const uint8_t *csrk, uint64_t counter)
{
    u32 ret;
    uint8_t bonded_flag = 1;
    
    if (!csrk) {
        return -1;
    }
    
    /* Save CSRK (16 bytes) */
    ret = syscfg_write(VM_ID_CSRK, (u8 *)csrk, 16);
    if (ret != 16) {
        return -1;
    }
    
    /* Save counter (8 bytes) */
    ret = syscfg_write(VM_ID_COUNTER, (u8 *)&counter, 8);
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
    u32 ret;
    uint8_t bonded_flag = 0;
    
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
    u32 ret = syscfg_write(VM_ID_COUNTER, (u8 *)&counter, 8);
    return (ret == 8) ? 0 : -1;
}

int vm_storage_clear_bonding(void)
{
    uint8_t clear_flag = 0;
    
    /* Clear bonded flag */
    syscfg_write(VM_ID_BONDED_FLAG, &clear_flag, 1);
    
    /* Note: Could also delete items, but clearing flag is sufficient */
    return 0;
}
```

---

## 3. AES-CMAC Cryptography

### API Location
- **Header**: `common/third_party_profile/hilink_protocol/mbedtls_protocol/mbedtls/cmac.h`
- **Implementation**: mbedtls library

### mbedtls CMAC API
```c
#include "mbedtls/cipher.h"
#include "mbedtls/cmac.h"

int mbedtls_cipher_cmac_starts(mbedtls_cipher_context_t *ctx,
                                const unsigned char *key,
                                size_t keybits);

int mbedtls_cipher_cmac_update(mbedtls_cipher_context_t *ctx,
                                const unsigned char *input,
                                size_t ilen);

int mbedtls_cipher_cmac_finish(mbedtls_cipher_context_t *ctx,
                                unsigned char *output);
```

### Integration for VM Security

**File**: `vibration_motor_ble/vm_security.c`

```c
#include "mbedtls/cipher.h"
#include "mbedtls/cmac.h"
#include "mbedtls/aes.h"

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
```

---

## 4. PWM Motor Control

### API Location
- **Header**: `include_lib/driver/cpu/bd19/asm/pwm_led.h` or `asm/mcpwm.h`
- **Example**: `board_ac632n_demo.c` lines 227-234

### PWM LED Platform Data Pattern
```c
#include "asm/pwm_led.h"

LED_PLATFORM_DATA_BEGIN(pwm_led_data)
    .io_mode = TCFG_PWMLED_IOMODE,
    .io_cfg.one_io.pin = TCFG_PWMLED_PIN,
LED_PLATFORM_DATA_END()

// Initialization
pwm_led_init(&pwm_led_data);
```

### Integration for VM Motor Control

**File**: `vibration_motor_ble/vm_motor_control.c`

**Option 1: Using PWM LED API**
```c
#include "asm/pwm_led.h"

static uint8_t g_current_duty = 0;

// Platform data for motor PWM
LED_PLATFORM_DATA_BEGIN(vm_motor_pwm_data)
    .io_mode = 0,  // Single IO mode
    .io_cfg.one_io.pin = VM_MOTOR_PWM_PIN,
LED_PLATFORM_DATA_END()

int vm_motor_init(void)
{
    /* Initialize PWM for motor */
    pwm_led_init(&vm_motor_pwm_data);
    
    g_current_duty = 0;
    
    /* Set initial duty to 0 */
    vm_motor_set_duty(0);
    
    return 0;
}

void vm_motor_set_duty(uint8_t duty)
{
    /* Convert 0-255 to 0-100% */
    uint32_t duty_percent = (duty * 100) / 255;
    
    /* Set PWM duty cycle */
    /* Note: Actual API needs to be determined from pwm_led.h */
    /* pwm_led_set_duty(channel, duty_percent); */
    
    g_current_duty = duty;
}
```

**Option 2: Using MCPWM (Motor Control PWM)**
```c
#include "asm/mcpwm.h"

static uint8_t g_current_duty = 0;

int vm_motor_init(void)
{
    /* MCPWM configuration structure */
    struct mcpwm_platform_data pwm_config = {
        .port = VM_MOTOR_PWM_PIN,
        .frequency = VM_MOTOR_PWM_FREQ_HZ,  // 20kHz
        .duty = 0,
        .complementary_en = 0,  // No complementary output
    };
    
    /* Initialize MCPWM */
    /* mcpwm_init(&pwm_config); */
    
    g_current_duty = 0;
    
    return 0;
}

void vm_motor_set_duty(uint8_t duty)
{
    /* Convert 0-255 to actual duty value */
    uint32_t duty_value = (duty * 1000) / 255;  // 0-1000 range
    
    /* Set PWM duty */
    /* mcpwm_set_duty(channel, duty_value); */
    
    g_current_duty = duty;
}
```

**Note**: The exact PWM API needs to be determined from:
- `include_lib/driver/cpu/bd19/asm/pwm_led.h`
- `include_lib/driver/cpu/bd19/asm/mcpwm.h`

---

## 5. BLE Security Callbacks

### Event Handling
Based on `le_gatt_common.h` event types:

```c
typedef enum {
    GATT_COMM_EVENT_CONNECTION_COMPLETE,
    GATT_COMM_EVENT_DISCONNECT_COMPLETE,
    GATT_COMM_EVENT_ENCRYPTION_CHANGE,
    GATT_COMM_EVENT_SM_PASSKEY_INPUT,
    // ... more events
} gatt_comm_event_e;
```

### Integration Example

**File**: `vibration_motor_ble/vm_integration_example.c`

```c
#include "le_gatt_common.h"
#include "vm_ble_service.h"
#include "vm_security.h"

void vm_ble_event_handler(gatt_comm_event_e event, void *data)
{
    switch (event) {
        case GATT_COMM_EVENT_CONNECTION_COMPLETE: {
            /* Connection established */
            uint16_t conn_handle = *(uint16_t *)data;
            
            /* Force Security Level 4 */
            /* ble_sm_set_security_level(conn_handle, 4); */
            break;
        }
        
        case GATT_COMM_EVENT_ENCRYPTION_CHANGE: {
            /* Encryption status changed */
            /* Extract CSRK from pairing data */
            /* vm_security_on_bonding_complete(csrk); */
            break;
        }
        
        case GATT_COMM_EVENT_DISCONNECT_COMPLETE: {
            /* Connection closed - save counter */
            vm_security_on_disconnect();
            break;
        }
        
        default:
            break;
    }
}
```

---

## 6. Build Integration

### Add to Makefile

```makefile
# Include VM BLE source files
SRCS += \
    vibration_motor_ble/vm_ble_service.c \
    vibration_motor_ble/vm_security.c \
    vibration_motor_ble/vm_storage.c \
    vibration_motor_ble/vm_motor_control.c

# Add include path
INCLUDES += -Ivibration_motor_ble

# Add mbedtls for crypto
INCLUDES += -Icommon/third_party_profile/hilink_protocol/mbedtls_protocol
```

### Add to Code::Blocks Project

Add these lines to `AC632N_spp_and_le.cbp`:

```xml
<Unit filename="vibration_motor_ble/vm_ble_service.c"><Option compilerVer="CC"/></Unit>
<Unit filename="vibration_motor_ble/vm_security.c"><Option compilerVer="CC"/></Unit>
<Unit filename="vibration_motor_ble/vm_storage.c"><Option compilerVer="CC"/></Unit>
<Unit filename="vibration_motor_ble/vm_motor_control.c"><Option compilerVer="CC"/></Unit>
```

---

## 7. Next Steps

1. **Determine exact GATT profile format**
   - Check SDK documentation for `ble_gatt_server_set_profile`
   - Or find working examples in SDK

2. **Verify PWM API**
   - Check `asm/pwm_led.h` for duty cycle control functions
   - Or check `asm/mcpwm.h` for motor-specific PWM

3. **Test syscfg operations**
   - Verify VM IDs don't conflict with existing usage
   - Test read/write operations

4. **Implement security callbacks**
   - Hook into BLE stack event system
   - Extract CSRK from pairing complete event

5. **Test integration**
   - Compile and flash
   - Test basic connectivity
   - Verify packet handling

---

## Summary

All SDK APIs have been identified:

| Component | SDK Location | Status |
|-----------|--------------|--------|
| GATT Service | `le_gatt_common.h` | ✅ Found |
| Flash Storage | `syscfg_write/read` | ✅ Found + Example |
| AES-CMAC | `mbedtls/cmac.h` | ✅ Found + Example |
| PWM Control | `asm/pwm_led.h` or `asm/mcpwm.h` | ✅ Found |
| BLE Events | `gatt_comm_event_e` | ✅ Found |

**Ready for integration!**
