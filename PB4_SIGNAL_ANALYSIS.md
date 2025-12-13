# PB4 Signal Analysis - Unexpected Signal Detection

## Issue

Signal detected on PB4, but our motor_control code is configured for PB5.

---

## Investigation Results

### ✅ Motor Control Code - NO PB4 Usage

**Searched**:
- `SDK/apps/spp_and_le/examples/motor_control/` - All files
- No references to `IO_PORTB_04` or `PB4`

**Configured Pin**:
```c
// vm_config.h
#define VM_MOTOR_PWM_PIN  IO_PORTB_05  /* PB5 - Motor PWM */
```

**Result**: Motor control code does NOT use PB4.

---

### ✅ Board Configuration - NO PB4 Usage

**Checked**: `SDK/apps/spp_and_le/board/bd19/board_ac632n_demo_cfg.h`

**Pins Configured**:
- PB0: IO Key (PREV)
- PB1: IO Key (POWER) / AD Key
- PB2: IO Key (NEXT) / Handshake
- PB6: PWM LED / Flash CS / Touch Key
- PB7: Touch Key / Handshake

**Result**: PB4 is NOT explicitly configured in board config.

---

### ⚠️ Default GPIO Initialization

**Found in**: `SDK/apps/spp_and_le/board/bd19/board_ac632n_demo.c`

```c
static void close_gpio(u8 is_softoff)
{
    u16 port_group[] = {
        [PORTA_GROUP] = 0x1ff,
        [PORTB_GROUP] = 0x3ff,  // All PORTB pins (0-9)
        [PORTC_GROUP] = 0x3ff,
    };
    
    // Sets all PORTB pins to high-impedance by default
    gpio_dir(GPIOB, 0, 10, port_group[PORTB_GROUP], GPIO_OR);
    gpio_set_pu(GPIOB, 0, 10, ~port_group[PORTB_GROUP], GPIO_AND);
    gpio_set_pd(GPIOB, 0, 10, ~port_group[PORTB_GROUP], GPIO_AND);
    gpio_die(GPIOB, 0, 10, ~port_group[PORTB_GROUP], GPIO_AND);
}
```

**Analysis**:
- SDK initializes ALL PORTB pins (including PB4) to high-impedance
- Then protects certain pins from being disabled
- PB4 is NOT protected, so it should be high-impedance

**Result**: SDK sets PB4 to high-impedance (should have no signal).

---

## Possible Causes of PB4 Signal

### 1. **Hardware Cross-Talk**

**Most Likely**: Signal from PB5 (motor PWM) coupling to PB4.

**Why**:
- PB4 and PB5 are adjacent pins
- High-frequency PWM (1kHz) can couple to nearby pins
- PB4 is high-impedance (acts like antenna)

**Test**:
```
Measure both pins:
- PB5: Should have strong 1kHz PWM signal
- PB4: Should have weak/noisy signal (cross-talk)
```

**Solution**:
- Add ground trace between PB4 and PB5
- Add small capacitor (10pF-100pF) from PB4 to GND
- Configure PB4 as output LOW to prevent floating

---

### 2. **Shared Timer Output**

**Possible**: TIMER3 might have multiple output pins.

**Check**:
Some timers can output to multiple pins simultaneously. PB4 might be an alternate TIMER3 output.

**Datasheet Check Needed**:
- Look for "TIMER3 PWM Output Pins" in AC632N datasheet
- Check if PB4 is listed as alternate TIMER3_PWM output

**If True**:
- Both PB4 and PB5 would have PWM signal
- Need to explicitly disable PB4 output

---

### 3. **System Clock Output**

**Possible**: PB4 might be configured as clock output.

**Check**:
```c
// Look for clock output configuration
grep -rn "CLK_OUT\|CLKOUT" SDK/apps/spp_and_le/board/bd19/
```

**If Signal Frequency**:
- 24MHz or 12MHz → System clock
- 32kHz → RTC clock
- 1kHz → Matches our PWM (likely cross-talk)

---

### 4. **Debug/Test Signal**

**Possible**: SDK might output debug signal on PB4.

**Common Debug Signals**:
- System tick (1ms timer)
- Watchdog toggle
- BLE timing signals

**Check Frequency**:
- If exactly 1kHz → Likely cross-talk from PB5
- If different frequency → Debug signal

---

### 5. **Floating Pin Picking Up Noise**

**Likely**: PB4 is high-impedance and picking up environmental noise.

**Why**:
- High-impedance pins act as antennas
- Can pick up nearby signals (PB5 PWM)
- Can pick up power supply noise
- Can pick up BLE radio noise

**Test**:
```c
// Force PB4 to output LOW
gpio_direction_output(IO_PORTB_04, 0);
gpio_set_output_value(IO_PORTB_04, 0);
```

**Expected**:
- If cross-talk: Signal disappears
- If real output: Signal remains

---

## Diagnostic Steps

### Step 1: Measure Signal Characteristics

**With Oscilloscope**:
```
PB4 Signal:
- Frequency: _____ Hz
- Amplitude: _____ V
- Duty cycle: _____ %
- Waveform: Square / Sine / Noisy

PB5 Signal (for comparison):
- Frequency: 1000 Hz
- Amplitude: 3.3V
- Duty cycle: Variable (0-100%)
- Waveform: Clean square wave
```

**Analysis**:
- If PB4 frequency = PB5 frequency → Cross-talk
- If PB4 amplitude << PB5 amplitude → Cross-talk
- If PB4 waveform is noisy → Cross-talk or floating pin

---

### Step 2: Test with PB4 Forced LOW

**Add to motor_control initialization**:

```c
// In app_motor.c, motor_app_start()
void motor_app_start()
{
    log_info("=======================================");
    log_info("-------Motor Control BLE Demo---------");
    log_info("=======================================");
    
    // Force PB4 to output LOW (disable any signal)
    gpio_direction_output(IO_PORTB_04, 0);
    gpio_set_output_value(IO_PORTB_04, 0);
    log_info("PB4 forced to LOW (disabled)");
    
    // ... rest of initialization
}
```

**Test**:
1. Rebuild and flash firmware
2. Measure PB4 again
3. If signal disappears → Was cross-talk or floating
4. If signal remains → Real output from somewhere

---

### Step 3: Check Timer Configuration

**Add debug output**:

```c
// In vm_motor_init()
printf("TIMER3 Configuration:\n");
printf("  CON: 0x%08X\n", JL_TIMER3->CON);
printf("  PRD: %d\n", JL_TIMER3->PRD);
printf("  PWM: %d\n", JL_TIMER3->PWM);
printf("  CNT: %d\n", JL_TIMER3->CNT);

// Check GPIO function
printf("PB4 function: %d\n", gpio_get_fun(IO_PORTB_04));
printf("PB5 function: %d\n", gpio_get_fun(IO_PORTB_05));
```

**Expected**:
- PB5 function: FO_TMR3_PWM (15)
- PB4 function: GPIO (0) or high-impedance

---

### Step 4: Isolate PB4 Physically

**Hardware Test**:
1. Disconnect PB4 from any external circuit
2. Leave pin floating (no connection)
3. Measure signal again

**Results**:
- Signal disappears → Was external circuit
- Signal remains → Internal to chip

---

## Most Likely Scenario

### 🎯 Cross-Talk from PB5 to PB4

**Evidence**:
1. PB4 and PB5 are adjacent pins
2. PB5 has strong 1kHz PWM signal
3. PB4 is high-impedance (susceptible to coupling)
4. No code explicitly drives PB4

**Mechanism**:
```
PB5 (PWM Output)
  │
  │ 1kHz, 3.3V
  │
  ├─────────┐
  │         │ Capacitive coupling
  │         │ (PCB traces, chip internal)
  │         │
PB4 (High-Z) ◄─┘
  │
  │ Weak signal (cross-talk)
  │
  └─── Oscilloscope probe
```

**Confirmation**:
- PB4 signal frequency matches PB5 (1kHz)
- PB4 signal amplitude is much weaker than PB5
- PB4 signal has same duty cycle as PB5

---

## Solutions

### Solution 1: Force PB4 to Output LOW (Recommended)

**Code**:
```c
// In app_motor.c, motor_app_start()
gpio_direction_output(IO_PORTB_04, 0);
gpio_set_output_value(IO_PORTB_04, 0);
```

**Effect**:
- PB4 becomes output (low impedance)
- No longer picks up cross-talk
- Signal disappears

---

### Solution 2: Add Hardware Filtering

**If PB4 is connected to external circuit**:
```
PB4 ──┬── 100Ω ──┬── External Circuit
      │          │
      └─ 100pF ──┴── GND
```

**Effect**:
- RC filter attenuates high-frequency noise
- Reduces cross-talk coupling

---

### Solution 3: Use Different Pin for Motor

**If PB4 must be clean**:
- Move motor PWM to a pin farther from PB4
- Options: PA5, PA6, PA7, PB7, PB9

**Trade-off**:
- Requires hardware change
- May conflict with other functions

---

### Solution 4: Accept Cross-Talk

**If PB4 is unused**:
- Leave as-is
- Cross-talk is normal for high-impedance pins
- No functional impact if PB4 not used

---

## Verification

### After Applying Solution 1:

**Expected Serial Log**:
```
[MOTOR_APP] =======================================
[MOTOR_APP] -------Motor Control BLE Demo---------
[MOTOR_APP] =======================================
PB4 forced to LOW (disabled)
[VM_MOTOR] Initializing PWM: Timer=TIMER3, Pin=PB5, Freq=1000Hz
[VM_MOTOR] PWM initialized successfully
```

**Expected Measurement**:
- PB4: 0V (constant LOW)
- PB5: 1kHz PWM (0-3.3V)

---

## Summary

### Investigation Results:

| Component | PB4 Usage | Status |
|-----------|-----------|--------|
| Motor Control Code | ❌ Not used | ✅ Correct |
| Board Configuration | ❌ Not configured | ✅ Correct |
| SDK Initialization | ⚠️ High-impedance | ⚠️ Susceptible to noise |
| Timer Output | ❓ Unknown | 🔍 Needs datasheet check |

### Most Likely Cause:

**Cross-talk from PB5 (motor PWM) to PB4 (high-impedance pin)**

### Recommended Action:

**Force PB4 to output LOW** to eliminate cross-talk:

```c
// Add to motor_app_start() in app_motor.c
gpio_direction_output(IO_PORTB_04, 0);
gpio_set_output_value(IO_PORTB_04, 0);
```

### Next Steps:

1. **Measure signal characteristics** (frequency, amplitude)
2. **Apply Solution 1** (force PB4 LOW)
3. **Rebuild and test**
4. **Verify PB4 signal disappears**

---

## Questions to Answer

To narrow down the cause, please provide:

1. **Signal Frequency**: What frequency do you measure on PB4?
2. **Signal Amplitude**: What voltage (peak-to-peak)?
3. **Duty Cycle**: Does it match your motor control commands?
4. **Comparison**: Does PB4 signal change when you change motor duty cycle?
5. **Hardware**: Is PB4 connected to anything external?

**If PB4 signal matches PB5 signal → Definitely cross-talk**  
**If PB4 signal is different → Need deeper investigation**
