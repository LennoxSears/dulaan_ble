/**
 * Motor Controller - Core BLE communication and motor control
 * Handles low-level hardware communication with the motor device
 */

// BleClient and hexStringToDataView are expected to be available globally
// via Capacitor plugins or browser environment

// Helper function for hexStringToDataView if not available
function hexStringToDataView(hexString) {
    if (typeof window !== 'undefined' && window.hexStringToDataView) {
        return window.hexStringToDataView(hexString);
    }
    
    // Fallback implementation
    const bytes = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
        bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
    }
    return new DataView(bytes.buffer);
}

// Helper function to get BleClient safely
function getBleClient() {
    if (typeof window !== 'undefined') {
        return window.BleClient ||
               null;
    }
    return null;
}

class MotorController {
    constructor() {
        this.deviceAddress = null;
        this.isConnected = false;
        this.currentPwm = 0; // Motor starts stopped
        this.isScanning = false;
        this.scanResults = [];
        this.onScanResult = null;
        this.onDisconnect = null;
        
        // Remote control integration
        this.remoteService = null;
        this.remotePwm = 0; // PWM value when acting as remote
        
        // BLE service and characteristic UUIDs (V3.0 Protocol)
        this.SERVICE_UUID = "9A501A2D-594F-4E2B-B123-5F739A2D594F";
        this.MOTOR_CONTROL_CHAR_UUID = "9A511A2D-594F-4E2B-B123-5F739A2D594F";
        this.DEVICE_INFO_CHAR_UUID = "9A521A2D-594F-4E2B-B123-5F739A2D594F";
        
        // Keep backward compatibility
        this.CHARACTERISTIC_UUID = this.MOTOR_CONTROL_CHAR_UUID;
        
        // Device identification
        this.TARGET_DEVICE_NAME = "VibMotor(BLE)";
        this.SCAN_TIMEOUT = 10000; // 10 seconds default
        
        // Device info (from V3.0 protocol)
        // Accessible via window.dulaan.motor.deviceInfo
        this.deviceInfo = {
            motorCount: null,
            firmwareVersion: null,
            batteryLevel: null,
            battery: null,        // Alias for batteryLevel
            firmware: null,       // Alias for firmwareVersion
            lastUpdated: null,
            isReady: false        // True when first data received
        };
        this.onBatteryUpdate = null; // Callback for battery updates
        
        // Periodic battery query
        this.batteryQueryInterval = null;
        this.batteryQueryIntervalMs = 30000; // Default: 30 seconds
        
        // Write queue management
        this.writeQueue = [];
        this.maxQueueLength = 10; // Handle 1 second of 100ms interval writes
        this.isProcessingQueue = false;
        this.lastWrittenPwm = null; // Track last written value to avoid duplicates
    }

    /**
     * Initialize BLE and connect to device
     */
    async initialize() {
        try {
            const BleClient = getBleClient();
            if (!BleClient) {
                console.warn('BleClient not available - using mock mode');
                return true;
            }
            
            await BleClient.initialize();
            console.log('BLE initialized');
            
            // Check if Bluetooth is enabled
            const isEnabled = await this.isBluetoothEnabled();
            if (!isEnabled) {
                console.warn('Bluetooth is not enabled on device');
                return false;
            }
            
            // Request Bluetooth permissions
            const hasPermission = await this.requestBluetoothPermissions();
            if (!hasPermission) {
                console.warn('Bluetooth permissions not granted');
                return false;
            }
            
            console.log('BLE initialized with permissions');
            return true;
        } catch (error) {
            console.error('BLE initialization failed:', error);
            return false;
        }
    }

    /**
     * Build 2-byte packet for Protocol V3.0
     * Format: duty_cycle (uint16 little-endian, 0-10000 = 0.00%-100.00%)
     */
    buildPacket(dutyCycle) {
        const packet = new Uint8Array(2);
        
        // Ensure duty cycle is in valid range (0-10000)
        const duty = Math.max(0, Math.min(10000, Math.round(dutyCycle)));
        
        // Bytes 0-1: duty_cycle (uint16 little-endian)
        packet[0] = duty & 0xFF;           // Low byte
        packet[1] = (duty >> 8) & 0xFF;    // High byte
        
        return packet;
    }

    /**
     * Check if Bluetooth is enabled on device
     */
    async isBluetoothEnabled() {
        try {
            const BleClient = getBleClient();
            if (!BleClient) {
                return true; // Mock mode
            }
            
            const enabled = await BleClient.isEnabled();
            console.log(`Bluetooth enabled: ${enabled}`);
            return enabled;
        } catch (error) {
            console.error('Failed to check Bluetooth status:', error);
            return false;
        }
    }

    /**
     * Request Bluetooth permissions
     */
    async requestBluetoothPermissions() {
        try {
            const BleClient = getBleClient();
            if (!BleClient) {
                return true; // Mock mode
            }
            
            // Request location permission (required for BLE scanning on Android)
            if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.Geolocation) {
                try {
                    const permission = await window.Capacitor.Plugins.Geolocation.requestPermissions();
                    console.log('Location permission:', permission);
                } catch (error) {
                    console.warn('Location permission request failed:', error);
                }
            }
            
            // BleClient.initialize() already requests BLE permissions
            // Just verify we have them
            console.log('Bluetooth permissions requested');
            return true;
        } catch (error) {
            console.error('Failed to request Bluetooth permissions:', error);
            return false;
        }
    }

    /**
     * Scan for motor devices (based on plugin.js implementation)
     */
    async scan(timeout = this.SCAN_TIMEOUT) {
        if (this.isScanning) {
            console.warn('Scan already in progress, stopping previous scan...');
            await this.stopScan();
        }

        try {
            const BleClient = getBleClient();
            if (!BleClient) {
                console.warn('BleClient not available - cannot scan');
                return false;
            }

            // Check Bluetooth is enabled before scanning
            const isEnabled = await this.isBluetoothEnabled();
            if (!isEnabled) {
                console.error('Cannot scan: Bluetooth is not enabled');
                return false;
            }

            this.isScanning = true;
            this.scanResults = [];
            
            console.log(`Starting BLE scan for "${this.TARGET_DEVICE_NAME}" (timeout: ${timeout}ms)...`);
            
            await BleClient.requestLEScan({}, async (result) => {
                console.log('Scan result:', JSON.stringify(result));
                
                // Filter for target device name (matches plugin.js)
                if (result.device.name === this.TARGET_DEVICE_NAME) {
                    console.log('✅ Found target device:', result.device.deviceId);
                    this.deviceAddress = result.device.deviceId;
                    this.scanResults.push(result.device);
                    
                    // Stop scan immediately when target device is found
                    console.log('Target device found, stopping scan...');
                    await this.stopScan();
                    
                    // Trigger callback if set
                    if (this.onScanResult) {
                        this.onScanResult(result.device);
                    }
                }
            });

            // Stop scan after timeout
            setTimeout(async () => {
                if (this.isScanning) {
                    console.log('Scan timeout reached, stopping scan...');
                    await this.stopScan();
                    
                    if (this.scanResults.length === 0) {
                        console.warn(`❌ No devices found with name "${this.TARGET_DEVICE_NAME}"`);
                    }
                }
            }, timeout);

            return true;
        } catch (error) {
            console.error('Failed to start scan:', error);
            // Ensure scan state is reset on error
            await this.resetScanState();
            return false;
        }
    }

    /**
     * Stop BLE scanning
     */
    async stopScan() {
        if (!this.isScanning) {
            return;
        }

        try {
            const BleClient = getBleClient();
            if (BleClient) {
                await BleClient.stopLEScan();
            }
            this.isScanning = false;
            console.log('BLE scan stopped');
        } catch (error) {
            console.error('Failed to stop scan:', error);
            // Force reset scan state even if stop fails
            await this.resetScanState();
        }
    }

    /**
     * Reset scan state (used for error recovery)
     */
    async resetScanState() {
        try {
            const BleClient = getBleClient();
            if (BleClient && this.isScanning) {
                try {
                    await BleClient.stopLEScan();
                } catch (e) {
                    // Ignore errors during forced stop
                }
            }
        } catch (error) {
            console.error('Error during scan state reset:', error);
        } finally {
            this.isScanning = false;
            console.log('Scan state reset');
        }
    }

    /**
     * Scan and connect to motor device automatically
     */
    async scanAndConnect(timeout = this.SCAN_TIMEOUT) {
        try {
            console.log('Scanning for motor device...');
            
            // Use a promise to wait for scan completion properly
            const scanPromise = new Promise((resolve, reject) => {
                // Set up callback for when device is found
                const originalCallback = this.onScanResult;
                this.onScanResult = (device) => {
                    // Call original callback if it exists
                    if (originalCallback) {
                        originalCallback(device);
                    }
                    // Resolve the promise when device is found
                    resolve(true);
                };
                
                // Start scan
                this.scan(timeout).then(scanStarted => {
                    if (!scanStarted) {
                        reject(new Error('Failed to start scan'));
                    }
                }).catch(reject);
                
                // Timeout if device not found
                setTimeout(() => {
                    if (this.isScanning) {
                        this.stopScan();
                    }
                    if (!this.deviceAddress) {
                        resolve(false); // Timeout without finding device
                    }
                }, timeout + 500); // Add 500ms buffer
            });
            
            // Wait for scan to complete or timeout
            const deviceFound = await scanPromise;
            
            if (deviceFound && this.deviceAddress) {
                console.log('Device found, attempting to connect...');
                return await this.connect();
            } else {
                console.warn('❌ No motor device found during scan');
                console.warn(`Make sure device "${this.TARGET_DEVICE_NAME}" is powered on and in range`);
                return false;
            }
        } catch (error) {
            console.error('Scan and connect failed:', error);
            await this.resetScanState();
            return false;
        }
    }

    /**
     * Connect to motor device
     */
    async connect(deviceAddress = null) {
        try {
            if (deviceAddress) {
                this.deviceAddress = deviceAddress;
            }
            
            if (!this.deviceAddress) {
                throw new Error('No device address provided. Use scan() or scanAndConnect() first.');
            }

            const BleClient = getBleClient();
            if (!BleClient) {
                console.warn('BleClient not available - using mock mode');
                this.isConnected = true;
                return true;
            }
            
            // Set up disconnect callback (matches plugin.js pattern)
            const disconnectCallback = (deviceId) => {
                this.isConnected = false;
                this.deviceAddress = null;
                console.log(`Motor device ${deviceId} disconnected`);
                
                if (this.onDisconnect) {
                    this.onDisconnect(deviceId);
                }
            };
            
            await BleClient.connect(this.deviceAddress, disconnectCallback);
            this.isConnected = true;
            console.log('Connected to motor device:', this.deviceAddress);
            
            // Set up device info notifications (V3.0 protocol)
            try {
                await this.startDeviceInfoNotifications();
                // Start periodic battery queries (default: 30 seconds)
                this.startPeriodicBatteryQuery();
            } catch (error) {
                console.warn('[DEVICE INFO] ⚠️ Failed to set up device info:', error);
                // Don't fail connection if device info setup fails
            }
            
            return true;
        } catch (error) {
            console.error('Failed to connect to motor device:', error);
            this.isConnected = false;
            return false;
        }
    }

    /**
     * Disconnect from motor device
     */
    async disconnect() {
        try {
            // Stop periodic battery queries
            this.stopPeriodicBatteryQuery();
            
            // Stop device info notifications before disconnecting
            await this.stopDeviceInfoNotifications();
            
            const BleClient = getBleClient();
            if (this.deviceAddress && BleClient) {
                await BleClient.disconnect(this.deviceAddress);
            }
            this.isConnected = false;
            this.deviceAddress = null;
            console.log('Disconnected from motor device');
        } catch (error) {
            console.error('Failed to disconnect:', error);
        }
    }

    /**
     * Write PWM value to motor (0-255)
     * Automatically routes to remote host if connected as remote user
     * Uses queue to prevent BLE stack overload
     * Converts PWM (0-255) to duty cycle (0-10000) for V3.0 protocol
     */
    async write(pwmValue) {
        // Validate PWM value (0-255) and convert to duty cycle (0-10000)
        const pwm = Math.max(0, Math.min(255, Math.round(pwmValue)));
        const dutyCycle = Math.round((pwm / 255) * 10000);
        
        // Check if we're connected as remote to another host
        if (this.remoteService && this.remoteService.isRemote) {
            return this.writeToRemoteHost(dutyCycle);
        }
        
        // Skip if same as last written value (avoid duplicate writes)
        if (dutyCycle === this.lastWrittenPwm) {
            // console.log(`[MOTOR WRITE] ⏭️ Skipping - same as last value (${dutyCycle})`);
            return true;
        }
        
        // Add to queue
        this.writeQueue.push(dutyCycle);
        
        // If queue full, remove oldest and keep latest
        if (this.writeQueue.length > this.maxQueueLength) {
            const removed = this.writeQueue.shift();
            console.log(`[MOTOR WRITE] ⚠️ Queue full (${this.maxQueueLength}), dropped oldest value: ${removed}`);
        }
        
        // Start processing queue if not already running
        if (!this.isProcessingQueue) {
            this.processWriteQueue();
        }
        
        return true;
    }

    /**
     * Process write queue sequentially
     */
    async processWriteQueue() {
        if (this.isProcessingQueue) {
            return; // Already processing
        }
        
        this.isProcessingQueue = true;
        
        while (this.writeQueue.length > 0) {
            const pwm = this.writeQueue.shift();
            
            // Skip if same as last written (might have duplicates in queue)
            if (pwm === this.lastWrittenPwm) {
                continue;
            }
            
            try {
                const success = await this.writeToLocalBLE(pwm);
                if (success) {
                    this.lastWrittenPwm = pwm;
                }
            } catch (error) {
                console.error('[MOTOR WRITE] Queue processing error:', error);
            }
        }
        
        this.isProcessingQueue = false;
    }

    /**
     * Write PWM value to remote host (when acting as remote)
     */
    async writeToRemoteHost(pwmValue) {
        try {
            const success = this.remoteService.sendControlCommand('motor', pwmValue, {
                timestamp: Date.now(),
                source: 'motor_controller'
            });
            
            if (success) {
                this.remotePwm = pwmValue;
                return true;
            } else {
                console.warn('[MOTOR WRITE] ❌ Failed to send remote PWM command');
                return false;
            }
        } catch (error) {
            console.error('[MOTOR WRITE] ❌ Error sending remote PWM command:', error);
            return false;
        }
    }

    /**
     * Write duty cycle to local BLE device
     * Uses Protocol V3.0: 2-byte packet (duty cycle 0-10000)
     * Uses writeWithoutResponse for fire-and-forget pattern
     */
    async writeToLocalBLE(dutyCycle) {
        
        if (!this.isConnected || !this.deviceAddress) {
            console.warn('[MOTOR WRITE] ❌ Motor not connected, cannot write duty cycle');
            return false;
        }

        try {
            // Write to BLE characteristic
            const BleClient = getBleClient();
            if (!BleClient) {
                console.warn('[MOTOR WRITE] ⚠️ BleClient not available - duty cycle stored but not transmitted');
                this.currentPwm = dutyCycle;
                return true;
            }
            
            // Build 2-byte packet (Protocol V3.0)
            const packet = this.buildPacket(dutyCycle);
            
            // Convert to DataView for BLE write
            const dataView = new DataView(packet.buffer);
            
            // Use writeWithoutResponse for fire-and-forget (V3.0 protocol requirement)
            BleClient.writeWithoutResponse(
                this.deviceAddress,
                this.SERVICE_UUID,
                this.CHARACTERISTIC_UUID,
                dataView
            ).catch(error => {
                console.error('[MOTOR WRITE] ❌ Write failed:', error);
            });
            
            this.currentPwm = dutyCycle;
            return true;
        } catch (error) {
            console.error('[MOTOR WRITE] ❌ Failed to write PWM value:', error);
            return false;
        }
    }

    /**
     * Query device information (battery, firmware version, motor count)
     * Protocol V3.0: Send 2-byte query request [0xB0, 0x00]
     * Response will be received via notification
     */
    async queryDeviceInfo() {
        if (!this.isConnected || !this.deviceAddress) {
            console.warn('[DEVICE INFO] ❌ Motor not connected, cannot query device info');
            return false;
        }

        try {
            const BleClient = getBleClient();
            if (!BleClient) {
                console.warn('[DEVICE INFO] ⚠️ BleClient not available');
                return false;
            }

            // Build query packet: [0xB0, 0x00]
            const packet = new Uint8Array(2);
            packet[0] = 0xB0; // Protocol header
            packet[1] = 0x00; // Query command

            const dataView = new DataView(packet.buffer);
            
            console.log('[DEVICE INFO] 📤 Sending query:', {
                deviceAddress: this.deviceAddress,
                serviceUUID: this.SERVICE_UUID,
                charUUID: this.DEVICE_INFO_CHAR_UUID,
                packet: Array.from(packet)
            });

            // Write query to Device Info characteristic
            await BleClient.write(
                this.deviceAddress,
                this.SERVICE_UUID,
                this.DEVICE_INFO_CHAR_UUID,
                dataView
            );

            console.log('[DEVICE INFO] ✅ Query sent successfully, waiting for notification...');
            
            // Fallback: If notifications don't work, try reading after a delay
            setTimeout(async () => {
                if (!this.deviceInfo.isReady) {
                    console.warn('[DEVICE INFO] ⚠️ No notification received, trying READ fallback...');
                    await this.readDeviceInfoFallback();
                }
            }, 1000); // Wait 1 second for notification
            
            return true;
        } catch (error) {
            console.error('[DEVICE INFO] ❌ Failed to query device info:', error);
            return false;
        }
    }

    /**
     * Fallback: Read device info directly if notifications don't work
     * Some devices may not support notifications properly
     */
    async readDeviceInfoFallback() {
        if (!this.isConnected || !this.deviceAddress) {
            return false;
        }

        try {
            const BleClient = getBleClient();
            if (!BleClient) {
                return false;
            }

            console.log('[DEVICE INFO] 📖 Attempting to READ characteristic...');

            // Read the characteristic directly
            const result = await BleClient.read(
                this.deviceAddress,
                this.SERVICE_UUID,
                this.DEVICE_INFO_CHAR_UUID
            );

            console.log('[DEVICE INFO] 📖 READ result:', result);

            // Process the result (same as notification handler)
            if (result) {
                this.handleDeviceInfoNotification(result);
                return true;
            }
        } catch (error) {
            console.error('[DEVICE INFO] ❌ READ fallback failed:', error);
            console.log('[DEVICE INFO] 💡 Possible reasons:');
            console.log('  1. Device firmware not responding to query');
            console.log('  2. Characteristic not readable');
            console.log('  3. Device needs pairing/bonding first');
            return false;
        }
    }

    /**
     * Handle device info notification response
     * Protocol V3.0: 6-byte response [0xB0, 0x00, motor_count, fw_low, fw_high, battery]
     */
    handleDeviceInfoNotification(data) {
        try {
            console.log('[DEVICE INFO] 📨 Notification received, data:', data);
            
            // Handle different data formats (DataView or ArrayBuffer)
            let bytes;
            if (data instanceof DataView) {
                bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
            } else if (data instanceof ArrayBuffer) {
                bytes = new Uint8Array(data);
            } else if (data.buffer) {
                bytes = new Uint8Array(data.buffer);
            } else {
                console.error('[DEVICE INFO] ❌ Unknown data format:', typeof data);
                return;
            }
            
            console.log('[DEVICE INFO] 📊 Parsed bytes:', Array.from(bytes));
            
            // Expect 6 bytes
            if (bytes.length !== 6) {
                console.warn('[DEVICE INFO] ⚠️ Invalid response length:', bytes.length);
                return;
            }

            // Validate header and command
            if (bytes[0] !== 0xB0 || bytes[1] !== 0x00) {
                console.warn('[DEVICE INFO] ⚠️ Invalid header/command:', bytes[0], bytes[1]);
                return;
            }

            // Parse device info
            const motorCount = bytes[2];
            const fwVersionLow = bytes[3];
            const fwVersionHigh = bytes[4];
            const batteryLevel = bytes[5];
            
            console.log('[DEVICE INFO] 🔍 Parsed values:', {
                motorCount,
                fwVersionLow,
                fwVersionHigh,
                batteryLevel
            });

            // Update device info (accessible via window.dulaan.motor.deviceInfo)
            this.deviceInfo = {
                motorCount: motorCount,
                firmwareVersion: `${fwVersionHigh}.${fwVersionLow}`,
                batteryLevel: batteryLevel,
                battery: batteryLevel, // Alias for convenience
                firmware: `${fwVersionHigh}.${fwVersionLow}`, // Alias for convenience
                lastUpdated: new Date().toISOString(),
                isReady: true // Data has been received
            };

            console.log('[DEVICE INFO] 📥 Received:', {
                motorCount,
                firmwareVersion: this.deviceInfo.firmwareVersion,
                batteryLevel: `${batteryLevel}%`
            });

            // Trigger callback if set
            if (this.onBatteryUpdate) {
                this.onBatteryUpdate(this.deviceInfo);
            }
        } catch (error) {
            console.error('[DEVICE INFO] ❌ Failed to parse notification:', error);
        }
    }

    /**
     * Start listening for device info notifications
     */
    async startDeviceInfoNotifications() {
        if (!this.isConnected || !this.deviceAddress) {
            console.warn('[DEVICE INFO] ❌ Motor not connected');
            return false;
        }

        try {
            const BleClient = getBleClient();
            if (!BleClient) {
                console.warn('[DEVICE INFO] ⚠️ BleClient not available');
                return false;
            }

            console.log('[DEVICE INFO] 🔔 Starting notifications...', {
                deviceAddress: this.deviceAddress,
                serviceUUID: this.SERVICE_UUID,
                charUUID: this.DEVICE_INFO_CHAR_UUID
            });
            
            // Start notifications on Device Info characteristic
            await BleClient.startNotifications(
                this.deviceAddress,
                this.SERVICE_UUID,
                this.DEVICE_INFO_CHAR_UUID,
                (data) => {
                    console.log('[DEVICE INFO] 🔔 Notification callback triggered!');
                    this.handleDeviceInfoNotification(data);
                }
            );

            console.log('[DEVICE INFO] ✅ Notifications enabled successfully');
            return true;
        } catch (error) {
            console.error('[DEVICE INFO] ❌ Failed to start notifications:', error);
            console.log('[DEVICE INFO] 💡 This is OK - will use READ fallback instead');
            console.log('[DEVICE INFO] 💡 Notification error details:', error.message);
            // Don't fail - we'll use read fallback
            return false;
        }
    }

    /**
     * Stop listening for device info notifications
     */
    async stopDeviceInfoNotifications() {
        if (!this.deviceAddress) {
            return;
        }

        try {
            const BleClient = getBleClient();
            if (!BleClient) {
                return;
            }

            await BleClient.stopNotifications(
                this.deviceAddress,
                this.SERVICE_UUID,
                this.DEVICE_INFO_CHAR_UUID
            );

            console.log('[DEVICE INFO] 🔕 Notifications disabled');
        } catch (error) {
            console.error('[DEVICE INFO] ❌ Failed to stop notifications:', error);
        }
    }

    /**
     * Start periodic battery info queries
     * @param {number} intervalMs - Query interval in milliseconds (default: 30000 = 30 seconds)
     */
    startPeriodicBatteryQuery(intervalMs = null) {
        // Stop existing interval if any
        this.stopPeriodicBatteryQuery();

        // Use provided interval or default
        if (intervalMs !== null) {
            this.batteryQueryIntervalMs = intervalMs;
        }

        // Query immediately
        this.queryDeviceInfo().catch(error => {
            console.warn('[DEVICE INFO] ⚠️ Initial query failed:', error);
        });

        // Set up periodic query
        this.batteryQueryInterval = setInterval(() => {
            if (this.isConnected) {
                this.queryDeviceInfo().catch(error => {
                    console.warn('[DEVICE INFO] ⚠️ Periodic query failed:', error);
                });
            } else {
                console.warn('[DEVICE INFO] ⚠️ Device not connected, skipping query');
            }
        }, this.batteryQueryIntervalMs);

        console.log(`[DEVICE INFO] 🔄 Periodic query started (interval: ${this.batteryQueryIntervalMs}ms)`);
    }

    /**
     * Stop periodic battery info queries
     */
    stopPeriodicBatteryQuery() {
        if (this.batteryQueryInterval) {
            clearInterval(this.batteryQueryInterval);
            this.batteryQueryInterval = null;
            console.log('[DEVICE INFO] ⏹️ Periodic query stopped');
        }
    }

    /**
     * Check if periodic battery query is active
     */
    isPeriodicBatteryQueryActive() {
        return this.batteryQueryInterval !== null;
    }

    /**
     * Get current PWM value (local or remote depending on mode)
     */
    getCurrentPwm() {
        if (this.remoteService && this.remoteService.isRemote) {
            return this.remotePwm;
        }
        return this.currentPwm;
    }

    /**
     * Check if motor is connected
     */
    isMotorConnected() {
        return this.isConnected;
    }

    /**
     * Convert decimal to hex string for BLE communication
     */
    decimalToHexString(decimal) {
        const hex = decimal.toString(16).toUpperCase();
        return hex.length === 1 ? '0' + hex : hex;
    }

    /**
     * Get device address
     */
    getDeviceAddress() {
        return this.deviceAddress;
    }

    /**
     * Set device address
     */
    setDeviceAddress(address) {
        this.deviceAddress = address;
    }

    /**
     * Get scan results
     */
    getScanResults() {
        return [...this.scanResults];
    }

    /**
     * Check if currently scanning
     */
    isScanningActive() {
        return this.isScanning;
    }

    /**
     * Set scan result callback
     */
    setScanResultCallback(callback) {
        this.onScanResult = callback;
    }

    /**
     * Set disconnect callback
     */
    setDisconnectCallback(callback) {
        this.onDisconnect = callback;
    }

    /**
     * Set target device name for scanning
     */
    setTargetDeviceName(name) {
        this.TARGET_DEVICE_NAME = name;
    }

    /**
     * Get target device name
     */
    getTargetDeviceName() {
        return this.TARGET_DEVICE_NAME;
    }

    /**
     * Set remote service for remote control integration
     */
    setRemoteService(remoteService) {
        this.remoteService = remoteService;
        console.log('[MOTOR CONTROLLER] Remote service integration enabled');
    }

    /**
     * Get remote control status
     */
    getRemoteStatus() {
        if (!this.remoteService) {
            return { enabled: false };
        }
        
        return {
            enabled: true,
            isRemote: this.remoteService.isRemote,
            isHost: this.remoteService.isHost,
            isControlledByRemote: this.remoteService.isControlledByRemote,
            hostId: this.remoteService.hostId,
            currentPwm: this.getCurrentPwm(),
            localPwm: this.currentPwm,
            remotePwm: this.remotePwm
        };
    }

    /**
     * Get write queue status (for debugging)
     */
    getQueueStatus() {
        return {
            queueLength: this.writeQueue.length,
            maxQueueLength: this.maxQueueLength,
            isProcessing: this.isProcessingQueue,
            lastWrittenPwm: this.lastWrittenPwm,
            currentPwm: this.currentPwm,
            protocol: 'V3.0'
        };
    }

    /**
     * Get device information (battery, firmware, motor count)
     */
    getDeviceInfo() {
        return { ...this.deviceInfo };
    }

    /**
     * Get battery level (0-100%)
     */
    getBatteryLevel() {
        return this.deviceInfo.batteryLevel;
    }

    /**
     * Get firmware version
     */
    getFirmwareVersion() {
        return this.deviceInfo.firmwareVersion;
    }

    /**
     * Get motor count
     */
    getMotorCount() {
        return this.deviceInfo.motorCount;
    }

    /**
     * Set battery update callback
     */
    setBatteryUpdateCallback(callback) {
        this.onBatteryUpdate = callback;
    }

    /**
     * Check if device info is ready (has been received at least once)
     */
    isDeviceInfoReady() {
        return this.deviceInfo.isReady === true;
    }
}

// Create singleton instance
const motorController = new MotorController();

// Export both the class and instance for flexibility
export { MotorController, motorController };

// Global access
if (typeof window !== 'undefined') {
    window.motorController = motorController;
}