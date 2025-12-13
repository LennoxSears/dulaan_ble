# What is TIMER3?

## Simple Explanation

**TIMER3** is a **hardware timer** built into the AC632N chip. Think of it as a **digital stopwatch** that can:
1. Count clock cycles
2. Generate precise timing
3. **Create PWM signals** (what we use for motor control)

---

## AC632N Timer Peripherals

The AC632N chip has **4 hardware timers**:

```
┌─────────────────────────────────────┐
│         AC632N Chip                 │
│                                     │
│  ┌─────────┐  ┌─────────┐         │
│  │ TIMER0  │  │ TIMER1  │         │
│  └─────────┘  └─────────┘         │
│                                     │
│  ┌─────────┐  ┌─────────┐         │
│  │ TIMER2  │  │ TIMER3  │ ← We use this one
│  └─────────┘  └─────────┘         │
│                                     │
└─────────────────────────────────────┘
```

Each timer can:
- Count time
- Generate interrupts
- **Generate PWM signals** (for motor control, LED dimming, etc.)

---

## Why We Use TIMER3 for PWM

### Timer Selection:
- **TIMER0**: Often used by system (avoid)
- **TIMER1**: Often used by system (avoid)
- **TIMER2**: Available, but less common
- **TIMER3**: ✅ **Commonly available for user applications**

### PWM Mode:
When configured in **PWM mode**, TIMER3 can:
1. Generate a square wave signal
2. Control the duty cycle (on/off ratio)
3. Output the signal to a GPIO pin

---

## How TIMER3 Creates PWM

### Basic Concept:

```
TIMER3 counts from 0 to PRD (Period):

0 ──► 1 ──► 2 ──► 3 ──► ... ──► PRD ──► 0 (repeat)
```

### PWM Generation:

```
When COUNT < PWM value: Output = HIGH (3.3V)
When COUNT ≥ PWM value: Output = LOW  (0V)

Example: PRD=6000, PWM=3000 (50% duty)

Count:  0    1500   3000   4500   6000   0
        │     │      │      │      │      │
Output: HIGH  HIGH   LOW    LOW    HIGH   HIGH
        └─────┴──────┴──────┴──────┘
        |<--- 50% --->|<--- 50% --->|
```

### Waveform:

```
3.3V ┐      ┌──────┐      ┌──────
     │      │      │      │
     │      │      │      │
0V   └──────┘      └──────┘
     |<-T/2->|<-T/2->|
     (50% duty cycle)
```

---

## TIMER3 Configuration in Our Code

### From `vm_motor_control.c`:

```c
/* Clock Configuration */
u32 u_clk = 24000000;  // 24MHz system clock
u32 clk_div = 4;       // Divide by 4
// Effective clock = 24MHz / 4 = 6MHz

/* Frequency Configuration */
JL_TIMERx->PRD = (u_clk / clk_div) / fre;
// For 1kHz: PRD = 6,000,000 / 1000 = 6000

/* Duty Cycle Configuration */
JL_TIMERx->PWM = (JL_TIMERx->PRD * duty) / 10000;
// For 50%: PWM = 6000 * 5000 / 10000 = 3000
```

### What This Means:

**PRD = 6000**:
- Timer counts from 0 to 6000
- Takes 1ms (1/1000 second)
- Creates 1kHz frequency

**PWM = 3000** (50% duty):
- Output HIGH for counts 0-2999 (0.5ms)
- Output LOW for counts 3000-5999 (0.5ms)
- Result: 50% duty cycle

---

## TIMER3 Registers

### Key Registers:

```c
JL_TIMER3->CON   // Control register (enable, clock source, mode)
JL_TIMER3->PRD   // Period register (frequency)
JL_TIMER3->PWM   // PWM duty register (duty cycle)
JL_TIMER3->CNT   // Counter register (current count)
```

### Control Register (CON):

```
Bits [11:10] = Clock source (0b110 = STD_24M)
Bits [7:4]   = Clock divider (0b0001 = /4)
Bit  [8]     = PWM enable (1 = enabled)
Bits [1:0]   = Count mode (0b01 = up counting)
```

---

## TIMER3 PWM Output Pin

### Pin Mapping:

TIMER3 can output PWM to **specific GPIO pins** (chip-dependent):

**Common TIMER3 PWM Pins**:
- PA5, PA6, PA7
- PB5, PB6, PB7, **PB8** ← We use this
- PC5, PC6, PC7

**Note**: Not all pins support TIMER3 PWM. Check your chip datasheet.

### GPIO Configuration:

```c
// Set GPIO to TIMER3 PWM function
gpio_set_fun_output_port(IO_PORTB_08, FO_TMR3_PWM, 0, 1);
//                       ^^^^^^^^^^^  ^^^^^^^^^^^
//                       Pin          Function = Timer3 PWM
```

This tells the chip:
> "Use PB8 as TIMER3 PWM output, not regular GPIO"

---

## Why Hardware Timer (Not Software)?

### Hardware Timer (TIMER3):
✅ **Precise timing** - Not affected by CPU load  
✅ **No CPU overhead** - Runs independently  
✅ **Stable frequency** - Exact 1kHz  
✅ **Smooth PWM** - No jitter  

### Software Timer (CPU-based):
❌ **Imprecise** - Affected by interrupts  
❌ **CPU overhead** - Wastes CPU cycles  
❌ **Unstable** - Frequency varies  
❌ **Jittery PWM** - Motor vibrates unevenly  

---

## TIMER3 vs Other Timers

### Why Not TIMER0/1/2?

**TIMER0**:
- Often used by **system tick** (OS timing)
- Used by **Bluetooth stack** timing
- ❌ **Don't use** - system needs it

**TIMER1**:
- Often used by **audio** subsystem
- Used by **USB** timing
- ❌ **Avoid** - may conflict

**TIMER2**:
- ✅ Available for user applications
- Less commonly used than TIMER3

**TIMER3**:
- ✅ **Best choice** for user PWM
- Commonly available
- Well-documented examples

---

## TIMER3 in the SDK

### SDK Files:

**Timer Header**:
```
SDK/include_lib/driver/cpu/bd19/asm/timer.h
```

**Timer Definitions**:
```c
#define JL_TIMER0  ((JL_TIMER_TypeDef *)0x1E0000)
#define JL_TIMER1  ((JL_TIMER_TypeDef *)0x1E1000)
#define JL_TIMER2  ((JL_TIMER_TypeDef *)0x1E2000)
#define JL_TIMER3  ((JL_TIMER_TypeDef *)0x1E3000)  ← We use this
```

**Timer Structure**:
```c
typedef struct {
    volatile u32 CON;   // Control register
    volatile u32 CNT;   // Counter register
    volatile u32 PRD;   // Period register
    volatile u32 PWM;   // PWM duty register
} JL_TIMER_TypeDef;
```

---

## Real-World Analogy

### TIMER3 is like a **metronome**:

**Metronome** (TIMER3):
- Ticks at precise intervals (1kHz)
- You can adjust the tempo (frequency)
- You can control when it makes sound (duty cycle)

**Motor Control**:
- TIMER3 "ticks" 1000 times per second
- Each tick, it decides: output HIGH or LOW
- Motor sees average voltage = duty cycle

---

## Example: 50% Duty Cycle

### Configuration:
```c
Frequency: 1000 Hz (1ms period)
Duty: 50% (5000/10000)
```

### What TIMER3 Does:

```
Time:     0ms    0.5ms   1.0ms   1.5ms   2.0ms
          │       │       │       │       │
Count:    0      3000    6000    3000    6000
          │       │       │       │       │
Output:   HIGH    LOW     HIGH    LOW     HIGH
          └───────┴───────┴───────┴───────┘
          |<-0.5ms->|<-0.5ms->|
          (50% on)  (50% off)
```

### Motor Sees:
- Average voltage: 1.65V (50% of 3.3V)
- Motor speed: 50% of maximum
- Vibration intensity: Medium

---

## Changing PWM Settings

### Change Frequency:

**Current**: 1kHz (1ms period)
```c
#define VM_MOTOR_PWM_FREQ_HZ  1000
```

**Faster**: 10kHz (0.1ms period)
```c
#define VM_MOTOR_PWM_FREQ_HZ  10000
```

**Slower**: 100Hz (10ms period)
```c
#define VM_MOTOR_PWM_FREQ_HZ  100
```

### Change Duty Cycle:

**From App** (BLE write):
```
0x00 0x00  = 0% (motor off)
0x88 0x13  = 50% (5000 = medium)
0x10 0x27  = 100% (10000 = full power)
```

**In Code**:
```c
vm_motor_set_duty(5000);  // 50%
```

---

## Summary

### What is TIMER3?
A **hardware timer peripheral** inside the AC632N chip that can generate precise PWM signals.

### Why Use TIMER3?
- ✅ Hardware-based (precise, no CPU overhead)
- ✅ Available for user applications
- ✅ Can output to GPIO pins
- ✅ Perfect for motor control

### How Does It Work?
1. Counts from 0 to PRD at 6MHz
2. Outputs HIGH when count < PWM value
3. Outputs LOW when count ≥ PWM value
4. Creates square wave with adjustable duty cycle

### What Does It Control?
- **Motor speed** via PWM duty cycle
- **Vibration intensity** via average voltage
- **LED brightness** (if used for LEDs)

### Key Takeaway:
**TIMER3 is the hardware that creates the PWM signal on PB8 to control your motor.**

---

## Visual Summary

```
┌─────────────────────────────────────────────────────┐
│                   AC632N Chip                       │
│                                                     │
│  ┌──────────────────────────────────────────┐     │
│  │            TIMER3 Peripheral             │     │
│  │                                          │     │
│  │  Clock: 24MHz / 4 = 6MHz                │     │
│  │  PRD: 6000 (1kHz frequency)             │     │
│  │  PWM: 3000 (50% duty)                   │     │
│  │                                          │     │
│  │  Counter: 0→1→2→...→6000→0 (repeat)    │     │
│  │                                          │     │
│  │  Output: HIGH when count < 3000         │     │
│  │          LOW  when count ≥ 3000         │     │
│  └──────────────┬───────────────────────────┘     │
│                 │                                  │
│                 ▼                                  │
│            PB8 (GPIO Pin)                         │
│                 │                                  │
└─────────────────┼──────────────────────────────────┘
                  │
                  ▼
            PWM Signal (1kHz, 50% duty)
                  │
                  ▼
            MOS Transistor
                  │
                  ▼
            Vibration Motor
```

**TIMER3 = The hardware that makes the PWM magic happen!**
