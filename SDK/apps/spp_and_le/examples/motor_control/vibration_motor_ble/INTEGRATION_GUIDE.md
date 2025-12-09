# Integration Guide

## Quick Start

### 1. Add Files to Your Project

Copy the `vibration_motor_ble/` folder to your AC632N project directory.

### 2. Update Build Configuration

**Option A: Using Makefile**
```makefile
# In your main Makefile
include vibration_motor_ble/Makefile.include

SRCS += $(VM_BLE_SRCS)
CFLAGS += $(VM_BLE_INC)
```

**Option B: Using Code::Blocks**
Add these files to your `.cbp` project:
- `vibration_motor_ble/vm_ble_service.c`
- `vibration_motor_ble/vm_motor_control.c`

Add include directory:
- `vibration_motor_ble/`

### 3. Configure Hardware

Edit `vibration_motor_ble/vm_config.h`:

```c
/* Set your motor PWM pin - currently configured for PB8 */
#define VM_MOTOR_PWM_PIN        IO_PORTB_08  /* Change to your pin */

/* Set timer for PWM generation - currently using TIMER3 */
#define VM_MOTOR_TIMER          JL_TIMER3    /* Change if needed */

/* Adjust PWM frequency if needed - 1kHz recommended by manufacturer */
#define VM_MOTOR_PWM_FREQ_HZ    1000         /* 1kHz for vibration motors */
```

**Note**: The implementation uses the manufacturer's TIMER PWM functions directly, not MCPWM. Ensure your chosen timer and pin support PWM output.

### 4. Initialize in Your Application

```c
#include "vm_ble_service.h"

void app_main(void)
{
    /* ... your existing initialization ... */
    
    /* Initialize VM BLE service */
    int ret = vm_ble_service_init();
    if (ret != 0) {
        printf("VM BLE init failed: %d\n", ret);
    }
    
    /* ... rest of your code ... */
}
```

### 5. Configure BLE Security

The BLE stack automatically handles all security. Just configure:

```c
static const sm_cfg_t sm_config = {
    .slave_set_wait_security = 1,  /* Enforce encryption */
    .io_capabilities = IO_CAPABILITY_NO_INPUT_NO_OUTPUT,  /* Just-Works */
    .authentication_req_flags = SM_AUTHREQ_BONDING | SM_AUTHREQ_SECURE_CONNECTION,
    .min_key_size = 16,
    .max_key_size = 16,
};
```

That's it! No application-layer security code needed.

## SDK-Specific Implementation

### Priority 1: GATT Service Registration
**File**: `vm_ble_service.c` → `vm_ble_service_init()`

Find JieLi SDK examples for:
- `ble_gatt_server_set_profile()`
- Write callback registration

### Priority 2: PWM Control
**File**: `vm_motor_control.c` → `vm_motor_init()` and `vm_motor_set_duty()`

Find JieLi PWM API:
- `mcpwm_init()` - PWM initialization
- `mcpwm_set_duty()` - Duty cycle control (0-10000)

## Testing Steps

### Step 1: Compile
```bash
make clean
make
```

Verify no compilation errors.

### Step 2: Flash and Connect
1. Flash firmware to device
2. Open BLE scanner app on phone
3. Look for device advertising service UUID `9A501A2D-594F-4E2B-B123-5F739A2D594F`
4. Connect - should see pairing dialog

### Step 3: Test Motor Control
Use a BLE testing app (e.g., nRF Connect) to:
1. Connect to device
2. Navigate to service `9A501A2D-594F-4E2B-B123-5F739A2D594F`
3. Find characteristic `9A511A2D-594F-4E2B-B123-5F739A2D594F`
4. Write test packet (see Protocol Testing below)

### Step 4: Verify Security
1. Disconnect and reconnect - should auto-reconnect without pairing
2. Power cycle device - bonding should persist
3. Send duplicate packet - should be rejected (replay protection)

## Protocol Testing

### Test Packet Format
```
Byte 0:    0x01 (CMD_SET_DUTY)
Byte 1-6:  Counter (little-endian, increment each packet)
Byte 7:    Duty cycle (0x00=0%, 0x80=50%, 0xFF=100%)
Byte 8-15: 0x00 (reserved)
Byte 16-19: MIC (computed via AES-CMAC)
```

### Example Test Packets

**50% Duty Cycle (Counter=1)**
```
01 01 00 00 00 00 00 80 00 00 00 00 00 00 00 00 [MIC]
```

**100% Duty Cycle (Counter=2)**
```
01 02 00 00 00 00 00 FF 00 00 00 00 00 00 00 00 [MIC]
```

**Note**: MIC must be computed using CSRK from pairing. During development, you can temporarily disable CMAC verification for testing.

## Troubleshooting

### Device Not Advertising
- Check BLE stack initialization
- Verify advertising data includes service UUID
- Check antenna/RF configuration

### Pairing Fails
- Verify Security Level 4 is enforced
- Check LESC is enabled in SDK config
- Ensure Just-Works pairing is allowed

### Packets Rejected
- Check bonding status: `vm_security_is_bonded()`
- Verify counter is incrementing
- Check CMAC computation
- Enable debug logging: `VM_DEBUG_ENABLE 1`

### Motor Not Responding
- Verify PWM pin configuration
- Check PWM initialization
- Test with fixed duty cycle in `vm_motor_init()`
- Measure PWM output with oscilloscope

### Flash Errors
- Verify VM system is initialized
- Check VM item IDs don't conflict
- Ensure sufficient VM space (16KB configured)

## Production Checklist

Before releasing firmware:

- [ ] Test full pairing flow
- [ ] Test reconnection after power cycle
- [ ] Test counter persistence
- [ ] Test replay attack rejection
- [ ] Verify motor control at 0%, 50%, 100%
- [ ] Enable chip read protection
- [ ] Disable debug keys: `CONFIG_BT_USE_DEBUG_KEYS=n`
- [ ] Enable LESC-only: `CONFIG_BT_SMP_SC_ONLY=y`
- [ ] Test with BLE sniffer to verify encryption
- [ ] Measure flash wear over extended operation
- [ ] Test counter overflow handling (if feasible)

## Support

For issues specific to:
- **Protocol implementation**: Check `IMPLEMENTATION_NOTES.md`
- **JieLi SDK APIs**: Refer to SDK documentation and examples
- **Hardware configuration**: Check board config files

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│              Phone App (Central)                │
│  - Scans for Service UUID                       │
│  - Pairs (Just-Works)                           │
│  - Sends encrypted packets                      │
└────────────────┬────────────────────────────────┘
                 │ BLE (Encrypted)
                 │
┌────────────────▼────────────────────────────────┐
│         AC632N Chip (Peripheral)                │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │  vm_ble_service.c                        │  │
│  │  - GATT service/characteristic           │  │
│  │  - Packet parsing                        │  │
│  └──────────┬───────────────────────────────┘  │
│             │                                    │
│  ┌──────────▼───────────────────────────────┐  │
│  │  vm_security.c                           │  │
│  │  - Counter validation (replay protection)│  │
│  │  - CMAC verification                     │  │
│  └──────────┬───────────────────────────────┘  │
│             │                                    │
│  ┌──────────▼───────────────────────────────┐  │
│  │  vm_storage.c                            │  │
│  │  - Flash NVS (CSRK, counter)             │  │
│  └──────────────────────────────────────────┘  │
│             │                                    │
│  ┌──────────▼───────────────────────────────┐  │
│  │  vm_motor_control.c                      │  │
│  │  - PWM generation                        │  │
│  │  - Duty cycle control                    │  │
│  └──────────┬───────────────────────────────┘  │
│             │                                    │
│             ▼                                    │
│      Vibration Motor                            │
└─────────────────────────────────────────────────┘
```

## Next Steps

1. Complete SDK-specific implementations (see IMPLEMENTATION_NOTES.md)
2. Test basic connectivity
3. Implement security callbacks
4. Test motor control
5. Validate security features
6. Optimize and tune parameters
7. Production testing
