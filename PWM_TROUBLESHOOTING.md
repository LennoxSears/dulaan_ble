# PWM Signal Troubleshooting Guide

## Current Configuration

### PWM Settings (from `vm_config.h`):
```c
#define VM_MOTOR_PWM_PIN        IO_PORTB_08  /* PB8 */
#define VM_MOTOR_TIMER          JL_TIMER3
#define VM_MOTOR_PWM_FREQ_HZ    1000         /* 1kHz */
```

### Pin Information:
- **Physical Pin**: PB8 (Port B, Pin 8)
- **Timer**: TIMER3
- **Function**: FO_TMR3_PWM (Timer 3 PWM output)
- **Frequency**: 1kHz (1000 Hz)
- **Duty Range**: 0-10000 (0.00% - 100.00%)

---

## Why You Can't Detect PWM - Possible Causes

### 1. **Wrong Pin on Your Board**

**Issue**: PB8 might not be the correct pin for your specific AC632N variant.

**Check**:
- What AC632N chip variant do you have? (AC6321A, AC6328A, AC6329C, etc.)
- Check your board schematic
- Verify which pin is connected to your motor/MOS transistor

**Common AC632N Variants**:
- AC6321A - Mouse/keyboard applications
- AC6328A - BLE applications  
- AC6329C - BLE applications
- AC6328B - Dongle applications

**Solution**: Change `VM_MOTOR_PWM_PIN` in `vm_config.h` to match your hardware.

---

### 2. **Pin Conflict with Other Functions**

**Issue**: PB8 might be used by another peripheral (UART, SPI, etc.)

**Check Board Config**:
```bash
# Check if PB8 is used elsewhere
grep -rn "IO_PORTB_08\|PORTB_08" SDK/apps/spp_and_le/board/bd19/board_ac632n_demo_cfg.h
```

**Common Conflicts**:
- UART RX/TX (PB7/PB8 often used for UART)
- Debug pins
- LED pins
- Key matrix

**Solution**: 
1. Check `board_ac632n_demo_cfg.h` for pin assignments
2. Choose a different pin that's not in use
3. Update `VM_MOTOR_PWM_PIN` accordingly

---

### 3. **Motor Not Initialized**

**Issue**: `vm_motor_init()` might not be called at startup.

**Check Logs**:
Look for this message in serial output:
```
[VM_MOTOR] Initializing PWM: Timer=TIMER3, Pin=PB8, Freq=1000Hz
[VM_MOTOR] PWM initialized successfully
```

**If Missing**:
- `vm_ble_service_init()` not called
- `motor_server_init()` not called
- `bt_ble_init()` not called

**Solution**: Verify BLE initialization sequence in logs.

---

### 4. **No Motor Control Commands Sent**

**Issue**: You're not sending motor control packets from your app.

**Check Logs**:
Look for:
```
[VM_BLE] Motor write: duty=5000 (0x88 0x13)
[VM_MOTOR] Setting duty: 5000/10000 (50.00%)
[VM_MOTOR] PWM duty updated, PRD=6000, PWM=3000
```

**If Missing**:
- App not connected to BLE
- Writing to wrong characteristic
- Packet format incorrect

**Test with nRF Connect**:
1. Connect to "VibMotor"
2. Find characteristic `9A511A2D-594F-4E2B-B123-5F739A2D594F`
3. Write hex: `88 13` (50% duty)
4. Check serial logs

---

### 5. **PWM Signal Too Weak to Detect**

**Issue**: PWM is working but signal is too weak for your measurement tool.

**Check**:
- **Voltage Level**: AC632N GPIO is 3.3V logic
- **Current Drive**: Limited GPIO current (~10mA)
- **Load**: Heavy load might pull signal down

**Measurement Tips**:
- Use oscilloscope (not multimeter)
- Probe directly at chip pin (not after MOS transistor)
- Check with 10x probe (not 1x)
- Set trigger to edge mode
- Timebase: 500µs/div (for 1kHz signal)

---

### 6. **Timer Not Enabled**

**Issue**: TIMER3 might be disabled or used by another function.

**Check**:
```c
// In vm_motor_control.c, timer_pwm_init()
JL_TIMERx->CON |= BIT(8);  // PWM enable bit
```

**Verify**:
- Timer clock source configured (STD_24M)
- Timer clock divider set (/4)
- PWM mode enabled (bit 8)

---

### 7. **GPIO Not Configured for PWM**

**Issue**: GPIO might still be in default mode (input/output) instead of PWM function.

**Check**:
```c
// Should be called in timer_pwm_init()
gpio_set_fun_output_port(pwm_io, FO_TMR3_PWM, 0, 1);
```

**Verify**:
- GPIO function set to `FO_TMR3_PWM`
- GPIO direction set to output
- GPIO pull-up/pull-down disabled

---

## Diagnostic Steps

### Step 1: Check Serial Logs

**Enable Debug Output**:
1. Connect UART to PC (usually PB7=TX, PB8=RX or check your board)
2. Baud rate: 1000000 (1Mbps) - check `TCFG_UART0_BAUDRATE`
3. Open serial terminal

**Expected Logs**:
```
[MOTOR_APP] =======================================
[MOTOR_APP] -------Motor Control BLE Demo---------
[MOTOR_APP] =======================================
...
[VM_MOTOR] Initializing PWM: Timer=TIMER3, Pin=PB8, Freq=1000Hz
[VM_MOTOR] PWM initialized successfully
...
bt_ble_init
motor_server_init
VM BLE service initialized - LESC + Just-Works
```

**When You Write Motor Control**:
```
[VM_BLE] Motor write: duty=5000 (0x88 0x13)
[VM_MOTOR] Setting duty: 5000/10000 (50.00%)
[VM_MOTOR] PWM duty updated, PRD=6000, PWM=3000
```

---

### Step 2: Verify Pin with Multimeter

**Test 1: Check Voltage at Idle (0% duty)**
```
Expected: 0V (LOW)
```

**Test 2: Set 100% Duty**
Write `10 27` (10000 = 100%) to motor characteristic
```
Expected: 3.3V (HIGH)
```

**Test 3: Set 50% Duty**
Write `88 13` (5000 = 50%) to motor characteristic
```
Expected: ~1.65V (average)
Note: Multimeter shows average, not PWM
```

---

### Step 3: Verify Pin with Oscilloscope

**Settings**:
- Voltage: 5V/div
- Time: 500µs/div (for 1kHz)
- Trigger: Rising edge, 1.5V
- Coupling: DC

**Expected Waveform (50% duty)**:
```
3.3V ┐     ┌─────┐     ┌─────
     │     │     │     │
     │     │     │     │
0V   └─────┘     └─────┘
     |<-500µs->|<-500µs->|
     (1ms period = 1kHz)
```

**Measurements**:
- Frequency: 1000 Hz ± 10 Hz
- High level: 3.3V ± 0.1V
- Low level: 0V ± 0.1V
- Duty cycle: Should match your command

---

### Step 4: Test Different Pins

If PB8 doesn't work, try other pins that support TIMER3 PWM:

**Check Datasheet**: Look for "Timer3 PWM Output" pins

**Common Alternatives**:
- PA0, PA1, PA2, PA3
- PB0, PB1, PB2, PB3
- PC0, PC1, PC2, PC3

**To Change Pin**:
Edit `vm_config.h`:
```c
#define VM_MOTOR_PWM_PIN  IO_PORTA_05  // Try PA5
```

---

### Step 5: Test with Simple GPIO Toggle

**Create Test Function**:
```c
// In app_motor.c
void test_gpio_toggle(void)
{
    gpio_direction_output(IO_PORTB_08, 0);
    gpio_set_die(IO_PORTB_08, 1);
    
    while(1) {
        gpio_set_output_value(IO_PORTB_08, 1);
        os_time_dly(50);  // 500ms
        gpio_set_output_value(IO_PORTB_08, 0);
        os_time_dly(50);  // 500ms
    }
}
```

**Call in motor_app_start()**:
```c
// test_gpio_toggle();  // Uncomment to test
```

**Expected**: Pin toggles at ~1Hz (visible on LED or scope)

**If This Works**: Pin is correct, issue is with PWM configuration  
**If This Fails**: Pin is wrong or hardware issue

---

## Quick Fixes

### Fix 1: Change to a Known Working Pin

**For AC6321A Development Board**:
```c
// vm_config.h
#define VM_MOTOR_PWM_PIN  IO_PORTA_05  // PA5 is commonly available
```

### Fix 2: Increase PWM Frequency (Easier to Measure)

```c
// vm_config.h
#define VM_MOTOR_PWM_FREQ_HZ  10000  // 10kHz instead of 1kHz
```

### Fix 3: Test with 100% Duty (Constant HIGH)

```c
// In vm_motor_init(), change:
timer_pwm_init(VM_MOTOR_TIMER, VM_MOTOR_PWM_PIN, VM_MOTOR_PWM_FREQ_HZ, 10000);
//                                                                         ^^^^^
//                                                                         100%
```

This should give constant 3.3V output (easy to measure with multimeter).

---

## Hardware Checklist

### ✅ Things to Verify:

1. **Chip Variant**: What AC632N chip do you have?
2. **Board Schematic**: Which pin is motor connected to?
3. **Pin Availability**: Is PB8 available on your chip package?
4. **Pin Conflicts**: Is PB8 used for UART/debug?
5. **External Circuit**: Is there a MOS transistor? What's the circuit?
6. **Power Supply**: Is motor power separate from chip power?
7. **Ground**: Are chip GND and motor GND connected?

### 📋 Information Needed:

To help you further, please provide:

1. **Chip marking**: What's printed on the chip?
2. **Board type**: Development board or custom PCB?
3. **Schematic**: Can you share the motor control circuit?
4. **Serial logs**: What do you see in UART output?
5. **Measurement**: What tool are you using? (Multimeter/Oscilloscope/Logic Analyzer)
6. **Pin tested**: Which physical pin are you probing?

---

## Common Pin Mappings for AC632N Variants

### AC6321A (Mouse/Keyboard):
- TIMER3_PWM can output on: PA5, PA6, PA7, PB5, PB6, PB7

### AC6328A (BLE):
- TIMER3_PWM can output on: PA0, PA1, PA2, PB0, PB1, PB2

### AC6329C (BLE):
- TIMER3_PWM can output on: PA3, PA4, PA5, PB3, PB4, PB5

**Note**: Check your specific chip datasheet for exact pin mappings.

---

## Next Steps

1. **Check Serial Logs**: Verify motor init and write commands
2. **Verify Pin**: Confirm PB8 is correct for your board
3. **Test with Scope**: Measure PWM signal directly at chip pin
4. **Try Different Pin**: If PB8 doesn't work, try alternatives
5. **Report Back**: Share logs and measurements for further help

---

## Debug Commands to Add

Add these to help diagnose:

```c
// In vm_motor_init()
printf("TIMER3 CON: 0x%08X\n", JL_TIMER3->CON);
printf("TIMER3 PRD: %d\n", JL_TIMER3->PRD);
printf("TIMER3 PWM: %d\n", JL_TIMER3->PWM);
printf("GPIO PB8 DIR: %d\n", gpio_read(IO_PORTB_08));
```

This will show if timer is actually configured.

---

## Summary

**Most Likely Issues**:
1. ❌ Wrong pin (PB8 not available on your chip variant)
2. ❌ Pin conflict (PB8 used for UART or other function)
3. ❌ Not sending motor control commands from app
4. ❌ Measuring wrong pin or with wrong tool

**How to Confirm PWM is Working**:
1. ✅ See init logs in serial output
2. ✅ See motor write logs when sending commands
3. ✅ Measure 3.3V with multimeter at 100% duty
4. ✅ See square wave on oscilloscope at 50% duty

**Need Help?**
Share:
- Chip variant (AC632xx)
- Serial logs
- Schematic (motor circuit)
- Measurement results
