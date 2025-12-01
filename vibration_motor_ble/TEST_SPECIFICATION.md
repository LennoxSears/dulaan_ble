# Test Specification

## Test Environment Setup

### Hardware Required
- AC632N development board
- Vibration motor connected to PWM pin
- Power supply
- Oscilloscope (for PWM verification)
- Android/iOS phone with BLE

### Software Required
- nRF Connect app (or similar BLE testing tool)
- Serial terminal (for debug logs)
- BLE sniffer (optional, for security validation)

## Test Cases

### TC-001: Basic Initialization
**Objective**: Verify service initializes correctly

**Steps**:
1. Flash firmware with VM BLE service
2. Power on device
3. Check debug logs for initialization messages

**Expected**:
- No initialization errors
- Service registers successfully
- Device starts advertising

**Pass Criteria**: ✅ No errors in logs

---

### TC-002: BLE Advertising
**Objective**: Verify device is discoverable

**Steps**:
1. Open nRF Connect on phone
2. Scan for BLE devices
3. Look for service UUID `9A501A2D-594F-4E2B-B123-5F739A2D594F`

**Expected**:
- Device appears in scan results
- Service UUID is visible in advertising data
- Signal strength is reasonable (>-80 dBm)

**Pass Criteria**: ✅ Device discovered with correct UUID

---

### TC-003: Initial Pairing
**Objective**: Verify Just-Works pairing

**Steps**:
1. Connect to device from nRF Connect
2. Wait for pairing dialog
3. Accept pairing

**Expected**:
- System pairing dialog appears
- Dialog shows "Just-Works" (no PIN)
- Pairing completes successfully
- CSRK is saved to flash

**Pass Criteria**: ✅ Pairing succeeds, bonding data saved

---

### TC-004: Service Discovery
**Objective**: Verify GATT service structure

**Steps**:
1. After pairing, browse services
2. Find service `9A501A2D-594F-4E2B-B123-5F739A2D594F`
3. Find characteristic `9A511A2D-594F-4E2B-B123-5F739A2D594F`

**Expected**:
- Service is present
- Characteristic has Write-Without-Response property
- Security level is enforced

**Pass Criteria**: ✅ Service and characteristic found with correct properties

---

### TC-005: Motor Control - 0% Duty
**Objective**: Verify motor stops

**Steps**:
1. Write packet with duty=0x00
2. Observe motor
3. Measure PWM output

**Packet**:
```
01 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 [MIC]
```

**Expected**:
- Motor stops
- PWM duty cycle = 0%
- No vibration

**Pass Criteria**: ✅ Motor off, PWM = 0%

---

### TC-006: Motor Control - 50% Duty
**Objective**: Verify medium intensity

**Steps**:
1. Write packet with duty=0x80 (128)
2. Observe motor
3. Measure PWM output

**Packet**:
```
01 02 00 00 00 00 00 80 00 00 00 00 00 00 00 00 [MIC]
```

**Expected**:
- Motor runs at medium speed
- PWM duty cycle ≈ 50%
- Moderate vibration

**Pass Criteria**: ✅ Motor at ~50%, PWM ≈ 50%

---

### TC-007: Motor Control - 100% Duty
**Objective**: Verify maximum intensity

**Steps**:
1. Write packet with duty=0xFF (255)
2. Observe motor
3. Measure PWM output

**Packet**:
```
01 03 00 00 00 00 00 FF 00 00 00 00 00 00 00 00 [MIC]
```

**Expected**:
- Motor runs at full speed
- PWM duty cycle = 100%
- Strong vibration

**Pass Criteria**: ✅ Motor at 100%, PWM = 100%

---

### TC-008: Replay Attack Protection
**Objective**: Verify counter validation

**Steps**:
1. Send packet with counter=10
2. Send same packet again (counter=10)
3. Check debug logs

**Expected**:
- First packet: Accepted
- Second packet: Rejected (VM_ERR_REPLAY_ATTACK)
- Motor does not respond to second packet

**Pass Criteria**: ✅ Duplicate packet rejected

---

### TC-009: Counter Sequence Validation
**Objective**: Verify counter must increment

**Steps**:
1. Send packet with counter=20
2. Send packet with counter=19 (backwards)
3. Check debug logs

**Expected**:
- First packet: Accepted
- Second packet: Rejected (counter too old)

**Pass Criteria**: ✅ Backwards counter rejected

---

### TC-010: CMAC Verification
**Objective**: Verify message authentication

**Steps**:
1. Send packet with correct CMAC
2. Send packet with incorrect CMAC (flip one bit)
3. Check debug logs

**Expected**:
- First packet: Accepted
- Second packet: Rejected (VM_ERR_AUTH_FAILED)

**Pass Criteria**: ✅ Invalid CMAC rejected

---

### TC-011: Reconnection Without Pairing
**Objective**: Verify bonding persistence

**Steps**:
1. Pair device (if not already paired)
2. Disconnect
3. Reconnect from phone

**Expected**:
- No pairing dialog appears
- Connection establishes immediately
- Encryption is active
- Packets work normally

**Pass Criteria**: ✅ Reconnects without re-pairing

---

### TC-012: Power Cycle Persistence
**Objective**: Verify flash storage

**Steps**:
1. Pair device
2. Send 10 packets (counter 1-10)
3. Power off device
4. Power on device
5. Reconnect
6. Send packet with counter=11

**Expected**:
- Device remembers bonding
- Counter state is restored
- Packet with counter=11 is accepted
- Packet with counter≤10 is rejected

**Pass Criteria**: ✅ Bonding and counter survive power cycle

---

### TC-013: Counter Flash Persistence
**Objective**: Verify periodic flash writes

**Steps**:
1. Send 300 packets (counter 1-300)
2. Check debug logs for flash write messages
3. Power cycle after packet 300
4. Reconnect and send packet 301

**Expected**:
- Flash write occurs around packet 256
- After power cycle, counter is restored
- Packet 301 is accepted
- Packets 1-300 are rejected

**Pass Criteria**: ✅ Counter persists with max 255 packet loss

---

### TC-014: Invalid Packet Length
**Objective**: Verify length validation

**Steps**:
1. Send packet with 19 bytes (too short)
2. Send packet with 21 bytes (too long)
3. Check debug logs

**Expected**:
- Both packets rejected (VM_ERR_INVALID_LENGTH)
- Motor does not respond

**Pass Criteria**: ✅ Invalid lengths rejected

---

### TC-015: Invalid Command
**Objective**: Verify command validation

**Steps**:
1. Send packet with cmd=0x02 (invalid)
2. Check debug logs

**Expected**:
- Packet rejected (VM_ERR_INVALID_CMD)
- Motor does not respond

**Pass Criteria**: ✅ Invalid command rejected

---

### TC-016: Unbonded Device
**Objective**: Verify bonding requirement

**Steps**:
1. Clear bonding data (via debug command)
2. Try to send packet without pairing
3. Check debug logs

**Expected**:
- Packet rejected (VM_ERR_NOT_BONDED)
- Motor does not respond

**Pass Criteria**: ✅ Unbonded packets rejected

---

### TC-017: Security Level Enforcement
**Objective**: Verify Level 4 security

**Steps**:
1. Use BLE sniffer to capture connection
2. Verify encryption is active
3. Check security level

**Expected**:
- Link is encrypted (AES-CCM)
- Security Level 4 is active
- LESC is used (P-256 ECDH)

**Pass Criteria**: ✅ Level 4 encryption verified

---

### TC-018: Disconnect on Counter Overflow
**Objective**: Verify overflow handling

**Steps**:
1. Manually set counter to near-max value
2. Send packets until overflow
3. Check behavior

**Expected**:
- Device detects overflow
- Connection is terminated
- Bonding is cleared
- Re-pairing is required

**Pass Criteria**: ✅ Overflow triggers disconnect and unbond

**Note**: This test may require special firmware build to accelerate overflow

---

### TC-019: Flash Wear Test
**Objective**: Verify flash endurance

**Steps**:
1. Send 25,600 packets (100 flash writes)
2. Monitor flash health
3. Verify counter still works

**Expected**:
- Flash writes succeed
- No corruption
- Counter remains accurate

**Pass Criteria**: ✅ Flash handles expected wear

**Note**: This is a long-running test (several hours at 10 pkt/sec)

---

### TC-020: Concurrent Connection Handling
**Objective**: Verify single connection limit

**Steps**:
1. Connect from phone A
2. Try to connect from phone B

**Expected**:
- Only one connection active
- Second connection is rejected or first is dropped

**Pass Criteria**: ✅ Single connection enforced

---

## Performance Tests

### PT-001: Latency Measurement
**Objective**: Measure packet-to-motor latency

**Steps**:
1. Send packet
2. Measure time until PWM changes
3. Repeat 100 times

**Expected**:
- Average latency < 10ms
- Max latency < 50ms

**Pass Criteria**: ✅ Latency within spec

---

### PT-002: Throughput Test
**Objective**: Verify packet rate handling

**Steps**:
1. Send packets at 10 Hz (100ms interval)
2. Send packets at 20 Hz (50ms interval)
3. Send packets at 50 Hz (20ms interval)

**Expected**:
- All packets processed correctly
- No packet loss
- Motor responds smoothly

**Pass Criteria**: ✅ Handles expected packet rates

---

### PT-003: Flash Write Performance
**Objective**: Measure flash write time

**Steps**:
1. Trigger flash write (256th packet)
2. Measure write duration
3. Verify no packet loss during write

**Expected**:
- Write completes in < 100ms
- No packets dropped
- Motor continues operating

**Pass Criteria**: ✅ Flash write doesn't block operation

---

## Security Tests

### ST-001: Man-in-the-Middle
**Objective**: Verify MITM protection

**Steps**:
1. Use BLE sniffer to capture pairing
2. Attempt to replay captured packets
3. Verify rejection

**Expected**:
- Captured packets are encrypted
- Replay fails (counter mismatch)
- LESC prevents key extraction

**Pass Criteria**: ✅ MITM attack fails

---

### ST-002: Brute Force CMAC
**Objective**: Verify CMAC strength

**Steps**:
1. Send packets with random CMAC values
2. Measure rejection rate

**Expected**:
- All invalid CMACs rejected
- Success rate ≈ 1 in 4 billion (32-bit)

**Pass Criteria**: ✅ CMAC provides adequate protection

---

## Test Report Template

```
Test ID: TC-XXX
Date: YYYY-MM-DD
Tester: [Name]
Firmware Version: [Version]
Hardware: [Board revision]

Result: PASS / FAIL
Notes: [Any observations]
Issues: [Bug IDs if failed]
```

## Automated Testing

Consider implementing automated tests for:
- Packet parsing (unit tests)
- Counter validation (unit tests)
- CMAC computation (unit tests)
- Flash operations (integration tests)
- Motor control (hardware-in-loop tests)

## Regression Testing

Before each release, run:
- All TC-001 through TC-020
- PT-001 through PT-003
- ST-001 through ST-002

Estimated time: 4-6 hours for full suite
