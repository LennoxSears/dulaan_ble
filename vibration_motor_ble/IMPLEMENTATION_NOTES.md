# Implementation Notes

## TODO: SDK-Specific Integration

The following functions need to be implemented using JieLi SDK APIs:

### 1. GATT Service Registration (`vm_ble_service.c`)

**Location**: `vm_ble_service_init()`

**Required SDK APIs**:
- Service creation with 128-bit UUID
- Characteristic creation with Write-Without-Response property
- Security level enforcement (Level 4)
- Write callback registration

**Reference Files**:
- `../../../../apps/common/third_party_profile/jieli/gatt_common/le_gatt_server.c`
- `../../../../include_lib/btstack/`

**Example Pattern**:
```c
// Look for similar patterns in SDK examples
vm_service_handle = le_gatt_server_add_service(vm_service_uuid, 16);
vm_char_handle = le_gatt_server_add_characteristic(...);
```

### 2. Cryptography (`vm_security.c`)

**Location**: `vm_aes_cmac_32()`

**Required SDK APIs**:
- AES-CMAC-128 computation
- The chip has `CONFIG_NEW_ECC_ENABLE` and `CONFIG_CRYPTO_TOOLBOX_OSIZE_IN_MASKROM`

**Reference Files**:
- Look for crypto functions in SDK includes
- May be in `../../../../include_lib/system/` or similar

**Implementation**:
```c
// Compute full AES-CMAC-128, take first 4 bytes
uint8_t mac_128[16];
aes_cmac_128(data, len, key, mac_128);
*mac_out = (mac_128[0] << 0) | (mac_128[1] << 8) | 
           (mac_128[2] << 16) | (mac_128[3] << 24);
```

### 3. Flash Storage (`vm_storage.c`)

**Location**: All functions

**Required SDK APIs**:
- `syscfg_write()` or similar VM write function
- `syscfg_read()` or similar VM read function
- `syscfg_remove()` or similar VM delete function

**Configuration**:
- VM_MAX_SIZE_CONFIG=16*1024
- VM_ITEM_MAX_NUM=256
- CONFIG_ITEM_FORMAT_VM enabled

**Reference Files**:
- `../../../../include_lib/system/vm.h` or similar
- Look for VM/NVS examples in SDK

**VM Item IDs**:
- 0xA0: CSRK (16 bytes)
- 0xA1: Counter (8 bytes)
- 0xA2: Bonded flag (1 byte)

### 4. PWM Motor Control (`vm_motor_control.c`)

**Location**: `vm_motor_init()` and `vm_motor_set_duty()`

**Required SDK APIs**:
- PWM initialization
- PWM duty cycle control
- GPIO configuration

**Reference Files**:
- `../../../../include_lib/driver/cpu/bd19/asm/pwm.h` or similar
- Board files show PWM LED examples

**Configuration**:
- Frequency: 20kHz
- Duty: 0-255 maps to 0%-100%
- Pin: Configurable via VM_MOTOR_PWM_PIN

### 5. BLE Security Callbacks

**Location**: Integration example shows pattern

**Required SDK APIs**:
- Pairing complete event handler
- CSRK extraction from pairing data
- Security level enforcement
- Disconnect trigger

**Events to Handle**:
- Pairing complete → save CSRK
- Disconnection → save counter
- Connection → enforce Level 4

## Testing Checklist

### Phase 1: Basic Integration
- [ ] Project compiles with VM BLE files included
- [ ] GATT service registers successfully
- [ ] Service UUID appears in advertising
- [ ] Phone can discover and connect

### Phase 2: Security
- [ ] Pairing dialog appears (Just-Works)
- [ ] CSRK is saved to flash after pairing
- [ ] Counter is loaded from flash on boot
- [ ] Replay attack is rejected (old counter)
- [ ] CMAC verification works

### Phase 3: Motor Control
- [ ] PWM output is generated
- [ ] Duty cycle changes with packet value
- [ ] Motor responds to 0%, 50%, 100% commands

### Phase 4: Persistence
- [ ] Counter survives power cycle
- [ ] Bonding survives power cycle
- [ ] Counter is written every 256 packets
- [ ] Flash wear is acceptable

### Phase 5: Security Validation
- [ ] Unbonded device rejects packets
- [ ] Wrong CMAC is rejected
- [ ] Counter overflow triggers disconnect
- [ ] Re-pairing works after overflow

## Performance Considerations

### Flash Wear
- Counter written every 256 packets
- At 100ms/packet: 25.6s between writes
- Daily writes: ~3375
- 100k cycle flash: ~29 years lifetime

### Latency
- Write-Without-Response: No ACK delay
- Packet processing: <1ms typical
- PWM update: Immediate

### Memory Usage
- RAM: ~100 bytes (security state)
- Flash: ~32 bytes (bonding data)
- Code: ~4-6KB (depends on optimization)

## Security Notes

### Production Checklist
- [ ] Enable `CONFIG_BT_SMP_SC_ONLY=y` (LESC only)
- [ ] Disable `CONFIG_BT_USE_DEBUG_KEYS=n`
- [ ] Enable chip read protection (RDP/APPROTECT)
- [ ] Test with BLE sniffer to verify encryption
- [ ] Verify counter persistence across power cycles

### Known Limitations
- Just-Works pairing: No MITM protection
  - Acceptable for this use case (physical proximity)
- 48-bit counter: Will overflow after 2^48 packets
  - At 10 packets/sec: ~894 years
- CMAC-32: Truncated MAC (4 bytes)
  - Collision probability: 1 in 4 billion
  - Acceptable with replay protection

## Debugging Tips

### Enable Verbose Logging
Set `VM_DEBUG_ENABLE 1` in `vm_config.h`

### Check Security State
Call `vm_security_get_state()` to inspect:
- Bonding status
- Current counter value
- Packets since last flash write

### Monitor Flash Writes
Add logging in `vm_storage_save_counter()` to track wear

### Test Replay Protection
Send same packet twice - second should be rejected

### Verify CMAC
Log computed vs received MIC values during development
