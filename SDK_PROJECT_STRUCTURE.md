# JieLi SDK Project Structure Analysis

## Main Entry Point

### 1. Application Entry: `app_main()`

**Location:** `/SDK/apps/spp_and_le/app_main.c`

**Function:** `void app_main()`

This is the **main entry point** for all BLE applications in the SDK.

```c
void app_main()
{
    struct intent it;
    
    // System initialization
    // Battery check
    // Audio initialization
    
    // Select which example to run based on CONFIG_APP_* flags
    init_intent(&it);
    
    #if CONFIG_APP_SPP_LE
        it.name = "spp_le";
        it.action = ACTION_SPPLE_MAIN;
    #elif CONFIG_APP_MULTI
        it.name = "multi_conn";
        it.action = ACTION_MULTI_MAIN;
    #elif CONFIG_APP_FINDMY
        it.name = "findmy";
        it.action = ACTION_FINDMY_MAIN;
    // ... more examples
    #endif
    
    start_app(&it);  // Launch selected example
}
```

### 2. Example Selection: `app_config.h`

**Location:** `/SDK/apps/spp_and_le/include/app_config.h`

**Purpose:** Select which example to compile and run

```c
// Only ONE should be set to 1, others to 0
#define CONFIG_APP_SPP_LE      1  // ← Currently active
#define CONFIG_APP_MULTI       0
#define CONFIG_APP_FINDMY      0
#define CONFIG_APP_CENTRAL     0
#define CONFIG_APP_DONGLE      0
// ... more options
```

## Project Organization

```
SDK/apps/spp_and_le/
├── app_main.c              ← Main entry point (app_main function)
├── include/
│   └── app_config.h        ← Example selection (CONFIG_APP_*)
├── examples/               ← All example implementations
│   ├── trans_data/         ← SPP+LE example (CONFIG_APP_SPP_LE)
│   │   ├── app_spp_and_le.c      ← Example main logic
│   │   ├── ble_trans.c           ← BLE GATT implementation
│   │   └── ble_trans_profile.h   ← GATT database
│   ├── multi_conn/         ← Multi-connection example
│   │   ├── ble_multi.c
│   │   └── ble_multi_peripheral.c
│   ├── findmy/             ← Apple FindMy example
│   │   ├── ble_fmy.c
│   │   └── ble_fmy_fmna.c
│   ├── ftms/               ← Fitness Machine Service
│   ├── central/            ← BLE Central (scanner)
│   ├── beacon/             ← iBeacon
│   └── ...
├── board/                  ← Hardware board configurations
├── config/                 ← System configurations
└── modules/                ← Shared modules
```

## How Examples Work

### Step 1: Configure (Compile Time)

Edit `include/app_config.h`:
```c
#define CONFIG_APP_SPP_LE      0  // Disable default
#define CONFIG_APP_MULTI       1  // Enable multi-connection
```

### Step 2: Build System

The build system compiles:
- `app_main.c` (always)
- Only the selected example from `examples/` directory
- Shared modules

### Step 3: Runtime Flow

```
System Boot
    ↓
app_main()
    ↓
Check CONFIG_APP_* flags
    ↓
init_intent() with selected example
    ↓
start_app() launches example
    ↓
Example's main function runs
    ↓
Example initializes BLE stack
    ↓
Example registers GATT services
    ↓
Example enters event loop
```

## Example Structure (trans_data)

**Files:**
- `app_spp_and_le.c` - Application logic, power management, events
- `ble_trans.c` - BLE GATT server implementation
- `ble_trans_profile.h` - GATT database definition

**Key Functions:**
```c
// In app_spp_and_le.c
static int spple_state_machine(struct application *app, 
                               enum app_state state, 
                               struct intent *it)
{
    switch (state) {
        case APP_STA_CREATE:
            // Initialize BLE
            break;
        case APP_STA_START:
            // Start advertising
            break;
        case APP_STA_PAUSE:
            // Handle pause
            break;
        case APP_STA_DESTROY:
            // Cleanup
            break;
    }
}

// In ble_trans.c
void ble_module_enable(u8 en)
{
    // Initialize BLE stack
    ble_comm_init(&ble_gatt_control_block);
}
```

## Task System

**Defined in:** `app_main.c`

```c
const struct task_info task_info_table[] = {
    {"app_core",    1, 0, 640, 128},   // Main application
    {"btctrler",    4, 0, 512, 256},   // BLE controller
    {"btstack",     3, 0, 768, 256},   // BLE stack
    {"btencry",     1, 0, 512, 128},   // Encryption
    // ... more tasks
};
```

Each example runs in the `app_core` task.

## How to Add Your Project

### Option 1: Modify Existing Example

1. Edit `examples/trans_data/ble_trans.c`
2. Add your GATT services
3. Implement your logic

### Option 2: Create New Example

1. Create `examples/my_project/`
2. Add your source files
3. Edit `app_config.h`:
   ```c
   #define CONFIG_APP_MY_PROJECT  1
   ```
4. Edit `app_main.c`:
   ```c
   #elif CONFIG_APP_MY_PROJECT
       it.name = "my_project";
       it.action = ACTION_MY_PROJECT_MAIN;
   #endif
   ```
5. Implement your example following the pattern

## Integration Points for Our Motor Control

### Recommended Approach: Modify trans_data Example

**File:** `examples/trans_data/ble_trans.c`

**Add our code:**
```c
#include "vibration_motor_ble/vm_ble_service.h"

// In ble_module_enable()
void ble_module_enable(u8 en)
{
    // ... existing code ...
    
    // Add our motor control service
    vm_ble_service_init();
    
    // Use our GATT config
    ble_gatt_control_block.server_config = vm_ble_get_server_config();
    ble_gatt_control_block.sm_config = vm_ble_get_sm_config();
    
    ble_comm_init(&ble_gatt_control_block);
}
```

## Key SDK APIs

### BLE Stack Initialization
```c
void ble_comm_init(gatt_ctrl_t *config);
```

### GATT Profile Registration
```c
void ble_gatt_server_set_profile(const uint8_t *data, uint16_t size);
```

### Advertising Control
```c
void ble_module_enable(u8 en);  // Start/stop advertising
```

### Event Handling
```c
// Callbacks registered in gatt_ctrl_t
int att_write_callback(...);
int att_read_callback(...);
int event_packet_handler(...);
```

## Summary

**Main Entry:** `app_main()` in `app_main.c`

**Example Selection:** `CONFIG_APP_*` flags in `app_config.h`

**Example Location:** `examples/<name>/` directory

**Integration:** Modify existing example or create new one

**Our Motor Control:** Best integrated into `trans_data` example

The SDK uses a **plugin architecture** where:
- Core system is in `app_main.c`
- Examples are in `examples/` directory
- Only one example is compiled at a time
- Selection is via compile-time flags
