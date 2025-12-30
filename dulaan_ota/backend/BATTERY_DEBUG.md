# Battery Info - Debugging Guide

## Problem: deviceInfo shows all null values

This happens when you check `window.dulaan.motor.deviceInfo` **before** the device has responded to the first query.

## Solution: Wait for Data

### Check if Data is Ready

```javascript
// Method 1: Check isReady flag
if (window.dulaan.motor.deviceInfo.isReady) {
    console.log('Battery:', window.dulaan.motor.deviceInfo.battery + '%');
} else {
    console.log('Waiting for device info...');
}

// Method 2: Use helper method
if (window.dulaan.motor.isDeviceInfoReady()) {
    console.log('Battery:', window.dulaan.motor.deviceInfo.battery + '%');
}

// Method 3: Check if battery is not null
const info = window.dulaan.motor.deviceInfo;
if (info.battery !== null) {
    console.log('Battery:', info.battery + '%');
}
```

### Wait for First Update

```javascript
// Option 1: Use callback (fires immediately when data arrives)
window.dulaan.motor.setBatteryUpdateCallback((info) => {
    console.log('✅ Battery info received:', info);
    // Now update your UI
    updateBatteryUI(info);
});

// Option 2: Poll until ready
function waitForBatteryInfo() {
    const checkInterval = setInterval(() => {
        if (window.dulaan.motor.deviceInfo.isReady) {
            clearInterval(checkInterval);
            console.log('✅ Battery info ready:', window.dulaan.motor.deviceInfo);
            updateBatteryUI(window.dulaan.motor.deviceInfo);
        }
    }, 100); // Check every 100ms
}

// Call after connection
await window.dulaan.motor.connect();
waitForBatteryInfo();
```

## Timeline

```
0ms:    connect() called
100ms:  Connection established
150ms:  Notifications enabled
200ms:  First query sent [0xB0, 0x00]
300ms:  Device responds with 6 bytes
350ms:  deviceInfo updated, isReady = true ✅
        Callback triggered (if set)
30s:    Second query (automatic)
60s:    Third query (automatic)
...
```

## Recommended Pattern

```javascript
// 1. Set up callback BEFORE connecting
window.dulaan.motor.setBatteryUpdateCallback((info) => {
    console.log('Battery updated:', info.battery + '%');
    document.getElementById('battery').textContent = info.battery + '%';
});

// 2. Connect (this triggers automatic query)
await window.dulaan.motor.connect();

// 3. Callback will fire when data arrives (~300ms later)
```

## React Pattern

```jsx
function BatteryDisplay() {
    const [battery, setBattery] = useState(null);
    const [isReady, setIsReady] = useState(false);
    
    useEffect(() => {
        // Set up callback
        window.dulaan.motor.setBatteryUpdateCallback((info) => {
            setBattery(info.battery);
            setIsReady(true);
        });
        
        // Or poll
        const interval = setInterval(() => {
            const info = window.dulaan?.motor?.deviceInfo;
            if (info?.isReady) {
                setBattery(info.battery);
                setIsReady(true);
            }
        }, 100);
        
        return () => clearInterval(interval);
    }, []);
    
    if (!isReady) {
        return <div>Loading battery info...</div>;
    }
    
    return <div>Battery: {battery}%</div>;
}
```

## Debug Console Commands

```javascript
// Check connection status
console.log('Connected:', window.dulaan.motor.isMotorConnected());

// Check if data is ready
console.log('Data ready:', window.dulaan.motor.isDeviceInfoReady());

// Check deviceInfo
console.log('Device info:', window.dulaan.motor.deviceInfo);

// Check if periodic queries are running
console.log('Periodic queries active:', 
    window.dulaan.motor.isPeriodicBatteryQueryActive());

// Manually trigger query
await window.dulaan.motor.queryDeviceInfo();

// Wait 500ms then check again
setTimeout(() => {
    console.log('Device info:', window.dulaan.motor.deviceInfo);
}, 500);
```

## Common Issues

### Issue 1: All values are null
**Cause**: Checking too early, before first response  
**Solution**: Use callback or check `isReady` flag

### Issue 2: Values never update
**Cause**: Device not responding, or notifications not enabled  
**Solution**: Check console for errors, verify device is connected

### Issue 3: Values update once then stop
**Cause**: Periodic queries stopped  
**Solution**: Check `isPeriodicBatteryQueryActive()`, restart if needed

### Issue 4: window.dulaan is undefined
**Cause**: Bundle not loaded yet  
**Solution**: Wait for bundle to load, or use DOMContentLoaded event

## Best Practice

```javascript
// Wait for bundle to load
window.addEventListener('DOMContentLoaded', async () => {
    // Set up callback first
    window.dulaan.motor.setBatteryUpdateCallback((info) => {
        console.log('Battery:', info.battery + '%');
        updateUI(info);
    });
    
    // Then connect
    try {
        await window.dulaan.motor.scan();
        await window.dulaan.motor.connect();
        console.log('✅ Connected, waiting for battery info...');
    } catch (error) {
        console.error('❌ Connection failed:', error);
    }
});
```

---

**Key Takeaway**: Battery info takes ~300ms to arrive after connection. Use callbacks or check `isReady` flag!
