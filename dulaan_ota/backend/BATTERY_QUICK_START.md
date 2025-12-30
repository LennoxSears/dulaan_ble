# Battery Info - Quick Start Guide

## TL;DR - Just Read This Property

```javascript
// After connecting, battery info is automatically available here:
window.dulaan.motor.deviceInfo = {
    battery: 85,              // Battery percentage (0-100)
    batteryLevel: 85,         // Same as battery
    firmware: "1.2",          // Firmware version
    firmwareVersion: "1.2",   // Same as firmware
    motorCount: 1,            // Number of motors
    lastUpdated: "2024-12-12T08:56:00.000Z"
};
```

## Simplest Usage

```javascript
// 1. Connect to device
await window.dulaan.motor.connect();

// 2. Read battery info (updates automatically every 30 seconds)
function showBattery() {
    const info = window.dulaan.motor.deviceInfo;
    if (info && info.battery !== null) {
        console.log('Battery:', info.battery + '%');
    }
}

// 3. Update UI every second
setInterval(showBattery, 1000);
```

## React Example

```jsx
function BatteryDisplay() {
    const [battery, setBattery] = useState(null);
    
    useEffect(() => {
        const interval = setInterval(() => {
            const info = window.dulaan?.motor?.deviceInfo;
            if (info && info.battery !== null) {
                setBattery(info.battery);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, []);
    
    return <div>Battery: {battery !== null ? `${battery}%` : '--'}</div>;
}
```

## Vanilla JavaScript

```html
<div id="battery">--</div>
<div id="firmware">--</div>

<script>
    setInterval(() => {
        const info = window.dulaan?.motor?.deviceInfo;
        if (info && info.battery !== null) {
            document.getElementById('battery').textContent = info.battery + '%';
            document.getElementById('firmware').textContent = info.firmware;
        }
    }, 1000);
</script>
```

## Configuration

```javascript
// Change query interval (default: 30 seconds)
window.dulaan.motor.startPeriodicBatteryQuery(60000); // 60 seconds

// Stop automatic queries
window.dulaan.motor.stopPeriodicBatteryQuery();

// Query manually
await window.dulaan.motor.queryDeviceInfo();
```

## How It Works

1. **On Connection**: Automatically starts querying every 30 seconds
2. **Updates**: `window.dulaan.motor.deviceInfo` is updated with each response
3. **Your UI**: Just read the property whenever you need it
4. **On Disconnect**: Automatically stops querying

## That's It!

No callbacks, no complex setup. Just connect and read `window.dulaan.motor.deviceInfo`.

---

For more details, see [BATTERY_INFO_FEATURE.md](BATTERY_INFO_FEATURE.md)
