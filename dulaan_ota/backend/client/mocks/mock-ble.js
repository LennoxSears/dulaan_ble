/**
 * Mock BLE Client for testing and development
 * Simulates Capacitor BLE plugin behavior without actual hardware
 */

class MockBleClient {
    constructor() {
        this.isInitialized = false;
        this.isScanning = false;
        this.connectedDevices = new Set();
        this.scanCallback = null;
        this.disconnectCallbacks = new Map();
        
        // Mock device data - using actual target device name
        this.mockDevices = [
            {
                device: {
                    deviceId: 'MOCK_DEVICE_001',
                    name: 'XKL-Q086-BT',
                    rssi: -45
                }
            },
            {
                device: {
                    deviceId: 'MOCK_DEVICE_002', 
                    name: 'XKL-Q086-BT',
                    rssi: -67
                }
            },
            // Add some non-target devices for realistic scanning
            {
                device: {
                    deviceId: 'OTHER_DEVICE_001',
                    name: 'Random BLE Device',
                    rssi: -78
                }
            }
        ];
        
        console.log('[MOCK BLE] MockBleClient initialized');
    }

    /**
     * Initialize BLE adapter
     */
    async initialize() {
        console.log('[MOCK BLE] Initializing...');
        await this.delay(100);
        this.isInitialized = true;
        console.log('[MOCK BLE] ✅ Initialized successfully');
    }

    /**
     * Start scanning for BLE devices
     */
    async requestLEScan(options = {}, callback) {
        if (!this.isInitialized) {
            throw new Error('BLE not initialized');
        }

        console.log('[MOCK BLE] Starting scan...', options);
        this.isScanning = true;
        this.scanCallback = callback;

        // Simulate finding devices over time (more realistic timing)
        setTimeout(() => {
            if (this.isScanning && this.scanCallback) {
                console.log('[MOCK BLE] Found non-target device');
                this.scanCallback(this.mockDevices[2]); // Non-target device first
            }
        }, 300);

        setTimeout(() => {
            if (this.isScanning && this.scanCallback) {
                console.log('[MOCK BLE] Found target device 1');
                this.scanCallback(this.mockDevices[0]); // First target device
            }
        }, 800);

        setTimeout(() => {
            if (this.isScanning && this.scanCallback) {
                console.log('[MOCK BLE] Found target device 2');
                this.scanCallback(this.mockDevices[1]); // Second target device
            }
        }, 1500);
    }

    /**
     * Stop scanning for BLE devices
     */
    async stopLEScan() {
        console.log('[MOCK BLE] Stopping scan...');
        this.isScanning = false;
        this.scanCallback = null;
        await this.delay(50);
        console.log('[MOCK BLE] ✅ Scan stopped');
    }

    /**
     * Connect to a BLE device
     */
    async connect(deviceAddress, disconnectCallback) {
        console.log('[MOCK BLE] Connecting to device:', deviceAddress);
        
        if (!this.isInitialized) {
            throw new Error('BLE not initialized');
        }

        // Simulate connection delay
        await this.delay(800);

        // Check if device exists in our mock list
        const deviceExists = this.mockDevices.some(d => d.device.deviceId === deviceAddress);
        if (!deviceExists) {
            throw new Error(`Device ${deviceAddress} not found`);
        }

        this.connectedDevices.add(deviceAddress);
        if (disconnectCallback) {
            this.disconnectCallbacks.set(deviceAddress, disconnectCallback);
        }

        console.log('[MOCK BLE] ✅ Connected to device:', deviceAddress);

        // Simulate random disconnections for testing
        if (Math.random() < 0.1) { // 10% chance of random disconnect after 10 seconds
            setTimeout(() => {
                if (this.connectedDevices.has(deviceAddress)) {
                    console.log('[MOCK BLE] ⚠️ Simulated random disconnect:', deviceAddress);
                    this.simulateDisconnect(deviceAddress);
                }
            }, 10000);
        }
    }

    /**
     * Disconnect from a BLE device
     */
    async disconnect(deviceAddress) {
        console.log('[MOCK BLE] Disconnecting from device:', deviceAddress);
        await this.delay(200);
        
        this.connectedDevices.delete(deviceAddress);
        this.disconnectCallbacks.delete(deviceAddress);
        
        console.log('[MOCK BLE] ✅ Disconnected from device:', deviceAddress);
    }

    /**
     * Write data to a BLE characteristic
     */
    async write(deviceAddress, serviceUuid, characteristicUuid, data) {
        if (!this.connectedDevices.has(deviceAddress)) {
            throw new Error(`Device ${deviceAddress} not connected`);
        }

        // Extract PWM value from data for logging
        let pwmValue = 'unknown';
        try {
            if (data && data.buffer) {
                const uint8Array = new Uint8Array(data.buffer);
                if (uint8Array.length > 0) {
                    pwmValue = uint8Array[0];
                }
            }
        } catch (e) {
            // Ignore parsing errors
        }

        console.log(`[MOCK BLE] Writing to ${deviceAddress}: PWM=${pwmValue}`);
        
        // Simulate write delay
        await this.delay(10);
        
        // Simulate occasional write failures for testing
        if (Math.random() < 0.02) { // 2% failure rate
            throw new Error('Mock BLE write failed');
        }
    }

    /**
     * Simulate a device disconnect
     */
    simulateDisconnect(deviceAddress) {
        if (this.connectedDevices.has(deviceAddress)) {
            this.connectedDevices.delete(deviceAddress);
            const callback = this.disconnectCallbacks.get(deviceAddress);
            if (callback) {
                callback(deviceAddress);
                this.disconnectCallbacks.delete(deviceAddress);
            }
        }
    }

    /**
     * Utility method to simulate async delays
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get mock status for debugging
     */
    getMockStatus() {
        return {
            isInitialized: this.isInitialized,
            isScanning: this.isScanning,
            connectedDevices: Array.from(this.connectedDevices),
            availableDevices: this.mockDevices.length
        };
    }
}

// Create and install mock BLE client
function installMockBLE() {
    if (typeof window !== 'undefined') {
        const mockBleClient = new MockBleClient();
        window.BleClient = mockBleClient;
        
        // Also provide hexStringToDataView mock if needed
        if (!window.hexStringToDataView) {
            window.hexStringToDataView = function(hexString) {
                const bytes = new Uint8Array(hexString.length / 2);
                for (let i = 0; i < hexString.length; i += 2) {
                    bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
                }
                return new DataView(bytes.buffer);
            };
        }
        
        console.log('[MOCK BLE] ✅ Mock BLE client installed on window.BleClient');
        return mockBleClient;
    } else {
        console.warn('[MOCK BLE] ⚠️ Window object not available, cannot install mock');
        return null;
    }
}

// Auto-install if this file is loaded directly
if (typeof window !== 'undefined' && !window.BleClient) {
    installMockBLE();
}

// Export for manual installation
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MockBleClient, installMockBLE };
}