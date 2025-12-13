# Battery Level BLE Service - SDK Example

Found in HID example: `SDK/apps/hid/modules/bt/ble_hogp.c`

---

## Standard BLE Battery Service

### Service UUID: 0x180F (Battery Service)
### Characteristic UUID: 0x2A19 (Battery Level)

---

## GATT Profile Structure

From `SDK/apps/hid/modules/bt/ble_hogp_profile.h`:

```c
//////////////////////////////////////////////////////
// PRIMARY_SERVICE  180f (Battery Service)
//////////////////////////////////////////////////////
0x0a, 0x00, 0x02, 0x00, 0x1f, 0x00, 0x00, 0x28, 0x0f, 0x18,

/* CHARACTERISTIC 2a19, READ | NOTIFY */
// 0x0020 CHARACTERISTIC 2a19 READ | NOTIFY
0x0d, 0x00, 0x02, 0x00, 0x20, 0x00, 0x03, 0x28, 0x12, 0x21, 0x00, 0x19, 0x2a,

// 0x0021 VALUE 2a19 READ | NOTIFY
0x08, 0x00, 0x12, 0x01, 0x21, 0x00, 0x19, 0x2a,

// 0x0022 CLIENT_CHARACTERISTIC_CONFIGURATION (for notifications)
0x0a, 0x00, 0x0a, 0x01, 0x22, 0x00, 0x02, 0x29, 0x00, 0x00,
```

**Handle Definitions**:
```c
#define ATT_CHARACTERISTIC_2a19_01_VALUE_HANDLE 0x0021
#define ATT_CHARACTERISTIC_2a19_01_CLIENT_CONFIGURATION_HANDLE 0x0022
```

---

## Implementation

### 1. Battery Level Variable

```c
static u8 hid_battery_level = 88;  // Initial value
```

---

### 2. Read Callback

```c
case ATT_CHARACTERISTIC_2a19_01_VALUE_HANDLE:
    att_value_len = 1;  // Battery level is 1 byte
    if (buffer) {
        if (get_vbat_percent_call) {
            hid_battery_level = hid_get_vbat_handle();
            log_info("read vbat:%d\n", hid_battery_level);
        }
        buffer[0] = hid_battery_level;
    }
    break;
```

---

### 3. Get Battery Level

```c
static u8 hid_get_vbat_handle(void)
{
    if (!get_vbat_percent_call) {
        return 0;
    }

    u8 cur_val, avg_val, val;

    // Average over 10 readings
    if (hid_battery_level_add_cnt > 10) {
        hid_battery_level_add_sum = hid_battery_level_add_sum / hid_battery_level_add_cnt;
        hid_battery_level_add_cnt = 1;
    }

    cur_val = get_vbat_percent_call();  // Get from SDK
    
    // Accumulate for averaging
    hid_battery_level_add_sum += cur_val;
    hid_battery_level_add_cnt++;
    
    avg_val = hid_battery_level_add_sum / hid_battery_level_add_cnt;
    
    // Smooth changes (only update if difference > 1%)
    if (hid_battery_level > avg_val) {
        val = hid_battery_level - avg_val;
        if (val > 1) {
            hid_battery_level--;
        }
    } else if (hid_battery_level < avg_val) {
        val = avg_val - hid_battery_level;
        if (val > 1) {
            hid_battery_level++;
        }
    }
    
    return hid_battery_level;
}
```

---

### 4. Periodic Battery Update (Timer)

```c
#define HID_BATTERY_TIMER_SET  (60000)  // 60 seconds

static void hid_battery_timer_handler(void *priev)
{
#if TCFG_SYS_LVD_EN
    static u8 low_power_cnt = 0;
    
    u8 tmp_val = hid_get_vbat_handle();
    
    // Only notify if battery level changed
    if (tmp_val != hid_battery_level) {
        hid_battery_level = tmp_val;
        
        // Check if notifications enabled
        if (ble_gatt_server_characteristic_ccc_get(hogp_con_handle, 
            ATT_CHARACTERISTIC_2a19_01_CLIENT_CONFIGURATION_HANDLE)) {
            
            log_info("notify battery: %d\n", hid_battery_level);
            
            // Send notification
            ble_comm_att_send_data(hogp_con_handle, 
                                   ATT_CHARACTERISTIC_2a19_01_VALUE_HANDLE,
                                   &hid_battery_level, 
                                   1,  // 1 byte
                                   ATT_OP_AUTO_READ_CCC);
        }
    }
#endif
}

// Start timer
sys_timer_add(NULL, hid_battery_timer_handler, HID_BATTERY_TIMER_SET);
```

---

### 5. CCC Write Handler

```c
case ATT_CHARACTERISTIC_2a19_01_CLIENT_CONFIGURATION_HANDLE:
    log_info("------write ccc:%04x,%02x\n", handle, buffer[0]);
    ble_gatt_server_characteristic_ccc_set(connection_handle, handle, buffer[0]);
    break;
```

---

## How It Works

### Flow:

```
1. Phone enables notifications (writes 0x0100 to CCC)
   ↓
2. Timer fires every 60 seconds
   ↓
3. hid_battery_timer_handler() called
   ↓
4. hid_get_vbat_handle() reads battery
   ↓
5. get_vbat_percent_call() → SDK function
   ↓
6. Average over 10 readings (smooth)
   ↓
7. If battery changed by >1%
   ↓
8. Check if notifications enabled
   ↓
9. Send notification via ble_comm_att_send_data()
   ↓
10. Phone receives battery update
```

---

## Key Points

### Standard BLE Service
- Uses official Battery Service UUID (0x180F)
- Uses official Battery Level characteristic (0x2A19)
- Compatible with all BLE apps/phones

### Read Support
- Phone can read battery level anytime
- Returns current cached value

### Notification Support
- Phone can enable notifications
- Updates sent when battery changes
- Periodic check every 60 seconds

### Smoothing
- Averages 10 readings
- Only updates if change > 1%
- Prevents jitter/noise

---

## Adapting for Motor Control

### Option 1: Add Standard Battery Service

Add to `vm_ble_profile.h`:

```c
//////////////////////////////////////////////////////
// PRIMARY_SERVICE  180f (Battery Service)
//////////////////////////////////////////////////////
0x0a, 0x00, 0x02, 0x00, 0x06, 0x00, 0x00, 0x28, 0x0f, 0x18,

/* CHARACTERISTIC 2a19, READ | NOTIFY */
0x0d, 0x00, 0x02, 0x00, 0x07, 0x00, 0x03, 0x28, 0x12, 0x08, 0x00, 0x19, 0x2a,
0x08, 0x00, 0x12, 0x01, 0x08, 0x00, 0x19, 0x2a,
0x0a, 0x00, 0x0a, 0x01, 0x09, 0x00, 0x02, 0x29, 0x00, 0x00,

// Handle definitions
#define ATT_CHARACTERISTIC_2a19_01_VALUE_HANDLE 0x0008
#define ATT_CHARACTERISTIC_2a19_01_CLIENT_CONFIGURATION_HANDLE 0x0009
```

Add read handler in `vm_ble_service.c`:

```c
case ATT_CHARACTERISTIC_2a19_01_VALUE_HANDLE:
    if (buffer && buffer_size >= 1) {
        buffer[0] = vm_ble_get_battery_level();
        return 1;
    }
    return 0;
```

Add notification timer:

```c
static void battery_notify_timer(void *priv)
{
    static uint8_t last_battery = 0;
    uint8_t current_battery = vm_ble_get_battery_level();
    
    // Only notify if changed
    if (current_battery != last_battery) {
        last_battery = current_battery;
        
        // Check if notifications enabled
        if (ble_gatt_server_characteristic_ccc_get(vm_connection_handle,
            ATT_CHARACTERISTIC_2a19_01_CLIENT_CONFIGURATION_HANDLE)) {
            
            ble_comm_att_send_data(vm_connection_handle,
                                   ATT_CHARACTERISTIC_2a19_01_VALUE_HANDLE,
                                   &current_battery,
                                   1,
                                   ATT_OP_AUTO_READ_CCC);
        }
    }
}

// Start timer (60 seconds)
sys_timer_add(NULL, battery_notify_timer, 60000);
```

---

### Option 2: Keep Custom Device Info (Current)

Current implementation already returns battery in device info characteristic:

```c
// Read device info (0x9A52...)
buffer[5] = vm_ble_get_battery_level();  // Battery at byte 5
```

**Pros**:
- Already implemented
- Works with custom app
- Simple protocol

**Cons**:
- Not standard BLE service
- Requires custom app
- No automatic notifications

---

## Recommendation

### For Custom App: Keep Current Implementation
- Device info read already includes battery
- Simple and working
- No need for standard service

### For Standard BLE Apps: Add Battery Service
- Use standard 0x180F service
- Compatible with all BLE apps
- Automatic battery display on phones
- Can coexist with custom service

---

## Summary

**SDK Example Found**: `SDK/apps/hid/modules/bt/ble_hogp.c`

**Key Features**:
- Standard Battery Service (0x180F)
- Battery Level characteristic (0x2A19)
- Read support (anytime)
- Notification support (on change)
- Periodic updates (60 seconds)
- Smoothing (average 10 readings)
- Uses SDK `get_vbat_percent_call()`

**Can be adapted** to motor_control by:
1. Adding battery service to GATT profile
2. Adding read handler
3. Adding notification timer
4. Reusing existing `vm_ble_get_battery_level()`

**Current motor_control** already has battery in device info characteristic, which works for custom apps.
