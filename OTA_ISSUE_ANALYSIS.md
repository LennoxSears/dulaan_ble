# OTA Issue Analysis - Why JL OTA App Fails

## Problem

**JL OTA app cannot perform OTA update on motor_control firmware.**

---

## Root Cause

The motor_control application **does NOT include the RCSP OTA service** in its GATT profile.

### What's Missing:

**1. RCSP GATT Service (UUID: ae30)**
- Characteristic ae01 (Write) - RCSP commands
- Characteristic ae02 (Notify) - RCSP responses  
- Characteristic ae05 (Indicate) - OTA data transfer

**2. RCSP Initialization**
- `rcsp_init()` not called
- RCSP bluetooth module not initialized
- OTA update handlers not registered

**3. RCSP Profile Integration**
- Motor control uses custom profile (9A50...)
- Trans_data uses RCSP profile (ae30...)
- **Motor control profile doesn't include RCSP service**

---

## Comparison

### Trans_Data Example (✅ OTA Works):

**GATT Profile**:
```
Service 1800 (Generic Access)
Service 1801 (Generic Attribute)
Service ae30 (RCSP/JL OTA Service) ← Has this!
  ├─ ae01 (Write) - Commands
  ├─ ae02 (Notify) - Responses
  ├─ ae03 (Write) - Data
  ├─ ae04 (Notify) - Status
  └─ ae05 (Indicate) - OTA transfer
```

**Code**:
```c
#include "rcsp_bluetooth.h"
#include "JL_rcsp_api.h"

// RCSP initialized in bt_ble_init()
rcsp_init();
```

---

### Motor_Control (❌ OTA Fails):

**GATT Profile**:
```
Service 9A50 (Motor Control Service)
  ├─ 9A51 (Write) - Motor control
  └─ 9A52 (Read) - Device info
  
❌ NO RCSP Service (ae30)
❌ NO OTA characteristics
```

**Code**:
```c
// No RCSP includes
// No rcsp_init()
// Only motor control service
```

---

## Why OTA Fails

### JL OTA App Behavior:

1. **Connects to device** ✅ Works
2. **Searches for service ae30** ❌ Not found!
3. **Looks for characteristic ae01** ❌ Not found!
4. **Tries to write OTA command** ❌ Fails!
5. **OTA update aborted** ❌

### Error Flow:

```
JL OTA App
    ↓
Scan for "VibMotor"
    ↓
Connect ✅
    ↓
Discover services
    ↓
Look for service ae30 ❌ NOT FOUND
    ↓
OTA FAILS
```

---

## Configuration Status

### ✅ What's Enabled:

**1. Build Configuration**:
```c
// board_ac632n_demo_global_build_cfg.h
#define CONFIG_APP_OTA_ENABLE  1  ✅
```

**2. RCSP Macros**:
```c
// app_config.h
#if CONFIG_APP_OTA_ENABLE
#define RCSP_BTMATE_EN   1  ✅
#define RCSP_UPDATE_EN   1  ✅
#endif
```

**3. Flash Layout**:
```
VM Storage: 80KB  ✅ (enough for OTA)
```

### ❌ What's Missing:

**1. GATT Profile**:
```c
// vm_ble_profile.h
// ❌ NO service ae30
// ❌ NO characteristics ae01, ae02, ae05
```

**2. RCSP Initialization**:
```c
// ble_motor.c
// ❌ NO #include "rcsp_bluetooth.h"
// ❌ NO rcsp_init() call
```

**3. RCSP Handlers**:
```c
// vm_ble_service.c
// ❌ NO RCSP write handler
// ❌ NO RCSP read handler
// ❌ NO OTA data handler
```

---

## Solution Options

### Option 1: Add RCSP Service to Motor Control Profile (Recommended)

**Pros**:
- ✅ Keeps motor control functionality
- ✅ Adds OTA capability
- ✅ Works with JL OTA app
- ✅ Single unified profile

**Cons**:
- ⚠️ More complex GATT profile
- ⚠️ Larger code size
- ⚠️ Need to integrate RCSP handlers

**Implementation**:
1. Add RCSP service (ae30) to `vm_ble_profile.h`
2. Add RCSP characteristics (ae01, ae02, ae05)
3. Include `rcsp_bluetooth.h` in `ble_motor.c`
4. Call `rcsp_init()` in `bt_ble_init()`
5. Add RCSP handlers in `vm_ble_service.c`

---

### Option 2: Use Trans_Data Example Instead

**Pros**:
- ✅ OTA already works
- ✅ RCSP fully integrated
- ✅ Well-tested

**Cons**:
- ❌ Lose motor control service
- ❌ Need to reimplement motor control in trans_data
- ❌ Different service UUIDs

**Implementation**:
1. Start with trans_data example
2. Add motor control code
3. Keep RCSP service intact

---

### Option 3: Dual Profile (Motor + RCSP)

**Pros**:
- ✅ Both services available
- ✅ Motor control independent
- ✅ OTA independent

**Cons**:
- ⚠️ Two separate services
- ⚠️ More complex profile
- ⚠️ Larger code/RAM usage

**Implementation**:
1. Keep motor service (9A50)
2. Add RCSP service (ae30)
3. Both services in same GATT profile

---

## Recommended Solution: Option 1

### Add RCSP Service to Motor Control

**Step 1: Update GATT Profile**

Add to `vm_ble_profile.h`:
```c
// After motor control service, add RCSP service

//////////////////////////////////////////////////////
//
// RCSP OTA Service (ae30)
//
//////////////////////////////////////////////////////
0x0a, 0x00, 0x02, 0x00, 0x06, 0x00, 0x00, 0x28, 0x30, 0xae,

/* CHARACTERISTIC ae01 - RCSP Write */
0x0d, 0x00, 0x02, 0x00, 0x07, 0x00, 0x03, 0x28, 0x04, 0x08, 0x00, 0x01, 0xae,
0x08, 0x00, 0x04, 0x01, 0x08, 0x00, 0x01, 0xae,

/* CHARACTERISTIC ae02 - RCSP Notify */
0x0d, 0x00, 0x02, 0x00, 0x09, 0x00, 0x03, 0x28, 0x10, 0x0a, 0x00, 0x02, 0xae,
0x08, 0x00, 0x10, 0x00, 0x0a, 0x00, 0x02, 0xae,
0x0a, 0x00, 0x0a, 0x01, 0x0b, 0x00, 0x02, 0x29, 0x00, 0x00,

/* CHARACTERISTIC ae05 - OTA Indicate */
0x0d, 0x00, 0x02, 0x00, 0x0c, 0x00, 0x03, 0x28, 0x20, 0x0d, 0x00, 0x05, 0xae,
0x08, 0x00, 0x20, 0x00, 0x0d, 0x00, 0x05, 0xae,
0x0a, 0x00, 0x0a, 0x01, 0x0e, 0x00, 0x02, 0x29, 0x00, 0x00,

// Characteristic handles
#define ATT_CHARACTERISTIC_ae01_VALUE_HANDLE  0x0008
#define ATT_CHARACTERISTIC_ae02_VALUE_HANDLE  0x000a
#define ATT_CHARACTERISTIC_ae02_CLIENT_CONFIG_HANDLE  0x000b
#define ATT_CHARACTERISTIC_ae05_VALUE_HANDLE  0x000d
#define ATT_CHARACTERISTIC_ae05_CLIENT_CONFIG_HANDLE  0x000e
```

**Step 2: Add RCSP Includes**

In `ble_motor.c`:
```c
#include "rcsp_bluetooth.h"
#include "JL_rcsp_api.h"
```

**Step 3: Initialize RCSP**

In `bt_ble_init()`:
```c
void bt_ble_init(void)
{
    log_info("bt_ble_init\n");
    
    ble_comm_set_config_name("VibMotor", 1);
    motor_ble_con_handle = 0;
    motor_server_init();
    
    #if RCSP_BTMATE_EN
    rcsp_init();  // ← Add this
    #endif
    
    ble_module_enable(1);
}
```

**Step 4: Add RCSP Handlers**

In `vm_ble_service.c` write callback:
```c
#if RCSP_BTMATE_EN
    case ATT_CHARACTERISTIC_ae01_VALUE_HANDLE:
        log_info("RCSP write: %d bytes\n", buffer_size);
        ble_gatt_server_receive_update_data(NULL, buffer, buffer_size);
        break;
#endif
```

**Step 5: Add RCSP Read Callback**

In `vm_ble_service.c` read callback:
```c
#if RCSP_BTMATE_EN
    case ATT_CHARACTERISTIC_ae02_VALUE_HANDLE:
    case ATT_CHARACTERISTIC_ae05_VALUE_HANDLE:
        // RCSP handles these internally
        return ble_gatt_server_characteristic_ccc_get(connection_handle, att_handle);
#endif
```

---

## Testing After Fix

### 1. Rebuild Firmware
```bash
cd SDK
make clean_ac632n_spp_and_le
make ac632n_spp_and_le
```

### 2. Flash to Device
Use JieLi download tool to flash new firmware.

### 3. Test with JL OTA App

**Expected Behavior**:
1. ✅ App connects to "VibMotor"
2. ✅ App finds service ae30
3. ✅ App finds characteristics ae01, ae02, ae05
4. ✅ App starts OTA update
5. ✅ Firmware updates successfully

**Check Logs**:
```
[BLE_MOTOR] bt_ble_init
[RCSP] rcsp_init
[RCSP] RCSP service registered
...
[RCSP] OTA write: 512 bytes
[RCSP] OTA progress: 10%
...
[RCSP] OTA complete
```

---

## Alternative: Quick Test with Trans_Data

If you want to test OTA immediately without modifying motor_control:

**1. Switch to Trans_Data**:
```c
// app_config.h
#define CONFIG_APP_MOTOR_CONTROL  0
#define CONFIG_APP_SPP_LE         1
```

**2. Rebuild and Flash**

**3. Test OTA**:
- Device name will be different
- OTA should work
- Motor control won't work (need to add it)

---

## Summary

### Why OTA Fails:
❌ Motor control profile doesn't include RCSP OTA service (ae30)  
❌ RCSP not initialized in motor control app  
❌ JL OTA app can't find required characteristics  

### What's Needed:
✅ Add RCSP service (ae30) to GATT profile  
✅ Add RCSP characteristics (ae01, ae02, ae05)  
✅ Initialize RCSP with `rcsp_init()`  
✅ Add RCSP handlers for write/read/notify  

### Configuration Status:
✅ OTA enabled in build config  
✅ RCSP macros enabled  
✅ Flash layout correct (80KB VM)  
❌ GATT profile missing RCSP service  
❌ RCSP not initialized in code  

---

## Next Steps

**Choose one**:

1. **Add RCSP to motor_control** (recommended)
   - Keeps motor functionality
   - Adds OTA capability
   - More work but better result

2. **Use trans_data + add motor control**
   - OTA works immediately
   - Need to add motor code
   - Easier short-term

3. **Wait for full integration guide**
   - I can create detailed step-by-step
   - With complete code changes
   - Ready to compile

**Let me know which approach you prefer!**
