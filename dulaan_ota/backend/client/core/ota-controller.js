/**
 * OTA Controller - Firmware update via BLE
 * Handles OTA update process following V4.0 protocol
 */

// Helper function to get BleClient safely
function getBleClient() {
    if (typeof window !== 'undefined') {
        return window.BleClient || null;
    }
    return null;
}

// Helper function for hexStringToDataView if not available
function hexStringToDataView(hexString) {
    if (typeof window !== 'undefined' && window.hexStringToDataView) {
        return window.hexStringToDataView(hexString);
    }
    
    const bytes = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
        bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
    }
    return new DataView(bytes.buffer);
}

// Helper function to get timestamp for logging
function getTimestamp() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `[${hours}:${minutes}:${seconds}.${ms}]`;
}

class OTAController {
    constructor() {
        this.deviceAddress = null;
        this.isConnected = false;
        this.isUpdating = false;
        this.isScanning = false;
        
        // BLE service and characteristic UUIDs (V4.0 Protocol)
        this.SERVICE_UUID = "9A501A2D-594F-4E2B-B123-5F739A2D594F";
        this.OTA_CHAR_UUID = "9A531A2D-594F-4E2B-B123-5F739A2D594F";
        
        // Device identification
        this.TARGET_DEVICE_NAME = "VibMotor(BLE)";
        this.SCAN_TIMEOUT = 60000; // 60 seconds for OTA scan
        
        // Scan results
        this.scanResults = [];
        
        // OTA state
        this.firmwareData = null;
        this.totalSize = 0;
        this.sentBytes = 0;
        this.currentSequence = 0;
        
        // Flow control
        this.ackReceived = false;
        this.ackSequence = -1;
        this.ackResolve = null;
        
        // Callbacks
        this.onProgress = null;
        this.onStatusChange = null;
        this.onError = null;
        this.onComplete = null;
        this.onScanResult = null;
        this.onDisconnect = null;
        
        // MTU configuration
        this.MTU_SIZE = 244; // Recommended MTU for OTA
        this.DATA_CHUNK_SIZE = 240; // MTU - 3 bytes for header
        
        // Adaptive delay parameters
        this.currentDelay = 50;  // Start with 50ms
        this.minDelay = 50;      // Minimum delay (don't speed up - device can't keep up)
        this.maxDelay = 150;     // Maximum delay (slow devices)
        this.consecutiveSuccesses = 0;
        this.maxRetries = 3;     // Retry failed writes
    }

    /**
     * Initialize BLE
     */
    async initialize() {
        try {
            const BleClient = getBleClient();
            if (!BleClient) {
                throw new Error('BleClient not available');
            }
            
            await BleClient.initialize();
            console.log(getTimestamp() + ' OTA: BLE initialized');
            return true;
        } catch (error) {
            console.error(getTimestamp() + ' OTA: Failed to initialize BLE:', error);
            throw error;
        }
    }

    /**
     * Scan for OTA-capable devices (matches motor-controller pattern)
     */
    async scan(timeout = this.SCAN_TIMEOUT) {
        if (this.isScanning) {
            console.warn(getTimestamp() + ' OTA: Scan already in progress, stopping previous scan...');
            await this.stopScan();
        }

        try {
            const BleClient = getBleClient();
            if (!BleClient) {
                console.warn(getTimestamp() + ' OTA: BleClient not available - cannot scan');
                return false;
            }

            this.isScanning = true;
            this.scanResults = [];
            
            console.log(getTimestamp() + ` OTA: Starting BLE scan for "${this.TARGET_DEVICE_NAME}" (timeout: ${timeout}ms)...`);
            this.updateStatus('Scanning for devices...');
            
            await BleClient.requestLEScan({}, async (result) => {
                console.log(getTimestamp() + ' OTA: Scan result:', JSON.stringify(result));
                
                // Filter for target device name (matches motor-controller)
                if (result.device.name === this.TARGET_DEVICE_NAME) {
                    console.log(getTimestamp() + ' OTA: ✅ Found target device:', result.device.deviceId);
                    this.deviceAddress = result.device.deviceId;
                    this.scanResults.push(result.device);
                    
                    // Stop scan immediately when target device is found (matches motor-controller)
                    console.log(getTimestamp() + ' OTA: Target device found, stopping scan...');
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
                    console.log(getTimestamp() + ' OTA: Scan timeout reached, stopping scan...');
                    await this.stopScan();
                    
                    if (this.scanResults.length === 0) {
                        console.warn(getTimestamp() + ` OTA: ❌ No devices found with name "${this.TARGET_DEVICE_NAME}"`);
                    } else {
                        console.log(getTimestamp() + ` OTA: Found ${this.scanResults.length} device(s)`);
                    }
                }
            }, timeout);

            return true;
        } catch (error) {
            console.error(getTimestamp() + ' OTA: Failed to start scan:', error);
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
            console.log(getTimestamp() + ' OTA: BLE scan stopped');
        } catch (error) {
            console.error(getTimestamp() + ' OTA: Failed to stop scan:', error);
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
            console.error(getTimestamp() + ' OTA: Error during scan state reset:', error);
        } finally {
            this.isScanning = false;
            console.log(getTimestamp() + ' OTA: Scan state reset');
        }
    }

    /**
     * Scan and connect to device automatically (matches motor-controller pattern)
     */
    async scanAndConnect(timeout = this.SCAN_TIMEOUT) {
        try {
            console.log(getTimestamp() + ' OTA: Scanning for device...');
            
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
                console.log(getTimestamp() + ' OTA: Device found, attempting to connect...');
                return await this.connect();
            } else {
                console.warn(getTimestamp() + ' OTA: ❌ No device found during scan');
                console.warn(getTimestamp() + ` OTA: Make sure device "${this.TARGET_DEVICE_NAME}" is powered on and in range`);
                return false;
            }
        } catch (error) {
            console.error(getTimestamp() + ' OTA: Scan and connect failed:', error);
            await this.resetScanState();
            return false;
        }
    }

    /**
     * Connect to device (matches motor-controller pattern)
     */
    async connect(deviceAddress = null) {
        try {
            if (deviceAddress) {
                this.deviceAddress = deviceAddress;
            }
            
            if (!this.deviceAddress) {
                throw new Error('No device address provided. Use scan() first or provide deviceAddress.');
            }

            const BleClient = getBleClient();
            if (!BleClient) {
                console.warn(getTimestamp() + ' OTA: BleClient not available - using mock mode');
                this.isConnected = true;
                return true;
            }
            
            this.updateStatus('Connecting...');
            
            // Set up disconnect callback (matches motor-controller pattern)
            const disconnectCallback = (deviceId) => {
                this.handleDisconnect();
            };
            
            await BleClient.connect(this.deviceAddress, disconnectCallback);
            this.isConnected = true;
            
            console.log(getTimestamp() + ' OTA: Connected to device:', this.deviceAddress);
            this.updateStatus('Connected');
            
            // Enable notifications
            await this.enableNotifications();
            
            return true;
        } catch (error) {
            console.error(getTimestamp() + ' OTA: Failed to connect to device:', error);
            this.isConnected = false;
            throw error;
        }
    }

    /**
     * Enable OTA notifications
     */
    async enableNotifications() {
        const BleClient = getBleClient();
        if (!BleClient || !this.isConnected) {
            throw new Error('Not connected to device');
        }

        try {
            await BleClient.startNotifications(
                this.deviceAddress,
                this.SERVICE_UUID,
                this.OTA_CHAR_UUID,
                (value) => this.handleNotification(value)
            );
            console.log(getTimestamp() + ' OTA: Notifications enabled');
        } catch (error) {
            console.error(getTimestamp() + ' OTA: Failed to enable notifications:', error);
            throw error;
        }
    }

    /**
     * Handle OTA notifications from device
     */
    handleNotification(value) {
        const data = new Uint8Array(value.buffer);
        const status = data[0];
        const statusData = data[1];

        console.log(getTimestamp() + ' OTA: Notification received:', { status, statusData });

        switch (status) {
            case 0x01: // READY
                console.log(getTimestamp() + ' OTA: Device ready to receive firmware');
                this.updateStatus('Device ready');
                this.sendDataPackets();
                break;

            case 0x02: // PROGRESS
                const progress = statusData;
                console.log(getTimestamp() + ` OTA: Progress ${progress}%`);
                this.updateProgress(progress);
                break;

            case 0x03: // SUCCESS
                console.log(getTimestamp() + ' OTA: Update successful! Device will reboot...');
                this.updateStatus('Update complete');
                this.isUpdating = false;
                if (this.onComplete) {
                    this.onComplete();
                }
                // Device will disconnect and reboot
                break;

            case 0x04: // ACK (flow control - not supported by SDK, kept for future)
                // ACK format: [0x04][seq_low][seq_high]
                if (data.length >= 3) {
                    const ackSeq = data[1] | (data[2] << 8);
                    console.log(getTimestamp() + ` OTA: ACK received for sequence ${ackSeq} (unexpected - callback not supported)`);
                }
                break;

            case 0xFF: // ERROR
                const errorCode = statusData;
                const errorMsg = this.getErrorMessage(errorCode);
                console.error(getTimestamp() + ` OTA: Error 0x${errorCode.toString(16).padStart(2, '0')}: ${errorMsg}`);
                this.updateStatus(`Error: ${errorMsg}`);
                this.isUpdating = false;
                if (this.onError) {
                    this.onError(errorMsg);
                }
                break;

            default:
                console.warn(getTimestamp() + ' OTA: Unknown notification status:', status);
        }
    }

    /**
     * Get error message from error code
     */
    getErrorMessage(code) {
        const errors = {
            0x01: 'Invalid START command',
            0x02: 'Firmware size too large',
            0x03: 'Not in receiving state',
            0x04: 'Invalid DATA packet',
            0x05: 'Flash write failed',
            0x06: 'Not in receiving state',
            0x07: 'Invalid FINISH command',
            0x08: 'Size mismatch',
            0x09: 'CRC verification failed',
            0xFF: 'Unknown command'
        };
        return errors[code] || 'Unknown error';
    }

    /**
     * Load firmware file
     */
    async loadFirmware(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                this.firmwareData = new Uint8Array(event.target.result);
                this.totalSize = this.firmwareData.length;
                
                const sizeKB = (this.totalSize / 1024).toFixed(2);
                console.log(getTimestamp() + ` OTA: Loaded firmware: ${file.name} (${sizeKB} KB)`);
                
                if (this.totalSize > 240 * 1024) {
                    reject(new Error(`Firmware too large: ${sizeKB} KB (max 240 KB)`));
                    return;
                }
                
                resolve({
                    name: file.name,
                    size: this.totalSize,
                    sizeKB: sizeKB
                });
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read firmware file'));
            };
            
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Start OTA update
     */
    async startUpdate() {
        if (!this.isConnected) {
            throw new Error('Not connected to device');
        }

        if (!this.firmwareData) {
            throw new Error('No firmware loaded');
        }

        if (this.isUpdating) {
            throw new Error('Update already in progress');
        }

        this.isUpdating = true;
        this.sentBytes = 0;
        this.currentSequence = 0;

        this.updateStatus('Starting update...');
        console.log(getTimestamp() + ' OTA: Starting update, size:', this.totalSize);

        try {
            await this.sendStartCommand();
        } catch (error) {
            this.isUpdating = false;
            throw error;
        }
    }

    /**
     * Send START command
     */
    async sendStartCommand() {
        const BleClient = getBleClient();
        if (!BleClient) {
            throw new Error('BleClient not available');
        }

        // START command: [0x01][size_low][size_high][size_mid][size_top]
        const data = new Uint8Array(5);
        data[0] = 0x01; // START command
        data[1] = this.totalSize & 0xFF;
        data[2] = (this.totalSize >> 8) & 0xFF;
        data[3] = (this.totalSize >> 16) & 0xFF;
        data[4] = (this.totalSize >> 24) & 0xFF;

        console.log(getTimestamp() + ' OTA: Sending START command, size:', this.totalSize);

        try {
            await BleClient.writeWithoutResponse(
                this.deviceAddress,
                this.SERVICE_UUID,
                this.OTA_CHAR_UUID,
                new DataView(data.buffer)
            );
            
            this.updateStatus('Waiting for device...');
        } catch (error) {
            console.error(getTimestamp() + ' OTA: Failed to send START command:', error);
            throw error;
        }
    }

    /**
     * Wait for ACK from device (flow control)
     */
    async waitForAck(expectedSequence, timeoutMs = 5000) {
        return new Promise((resolve, reject) => {
            // Check if ACK already received
            if (this.ackReceived && this.ackSequence === expectedSequence) {
                this.ackReceived = false;
                resolve(expectedSequence);
                return;
            }

            // Set up timeout
            const timeout = setTimeout(() => {
                this.ackResolve = null;
                reject(new Error(`Timeout waiting for ACK (seq=${expectedSequence})`));
            }, timeoutMs);

            // Set up resolve callback
            this.ackResolve = (ackSeq) => {
                clearTimeout(timeout);
                if (ackSeq === expectedSequence) {
                    this.ackReceived = false;
                    resolve(ackSeq);
                } else {
                    reject(new Error(`ACK sequence mismatch: expected ${expectedSequence}, got ${ackSeq}`));
                }
            };
        });
    }

    /**
     * Send data packets
     */
    async sendDataPackets() {
        const BleClient = getBleClient();
        if (!BleClient) {
            throw new Error('BleClient not available');
        }

        this.updateStatus('Sending firmware...');

        try {
            const totalPackets = Math.ceil(this.totalSize / this.DATA_CHUNK_SIZE);
            const PACKET_DELAY = 2000;  // 2 second delay for testing (extremely conservative)
            console.log(getTimestamp() + ` OTA: Sending ${totalPackets} packets with ${PACKET_DELAY}ms delay (testing)...`);
            
            let packetsSent = 0;
            
            while (this.sentBytes < this.totalSize) {
                const remaining = this.totalSize - this.sentBytes;
                const chunkSize = Math.min(this.DATA_CHUNK_SIZE, remaining);
                
                // DATA command: [0x02][seq_low][seq_high][data...]
                const packet = new Uint8Array(3 + chunkSize);
                packet[0] = 0x02; // DATA command
                packet[1] = this.currentSequence & 0xFF;
                packet[2] = (this.currentSequence >> 8) & 0xFF;
                
                // Copy firmware data
                packet.set(
                    this.firmwareData.subarray(this.sentBytes, this.sentBytes + chunkSize),
                    3
                );

                // Send packet with fixed delay (fallback - callback not supported)
                let sent = false;
                for (let attempt = 0; attempt < this.maxRetries; attempt++) {
                    try {
                        // Send packet
                        console.log(getTimestamp() + ` OTA: Sending packet ${this.currentSequence} (${this.sentBytes}/${this.totalSize} bytes)...`);
                        await BleClient.writeWithoutResponse(
                            this.deviceAddress,
                            this.SERVICE_UUID,
                            this.OTA_CHAR_UUID,
                            new DataView(packet.buffer)
                        );
                        console.log(getTimestamp() + ` OTA: Packet ${this.currentSequence} sent successfully`);
                        
                        // Fixed delay to prevent buffer overflow (callback not supported by SDK)
                        // Skip delay for first packet to avoid timeout
                        if (packetsSent > 0) {
                            console.log(getTimestamp() + ` OTA: Waiting ${PACKET_DELAY}ms before next packet...`);
                            await this.delay(PACKET_DELAY);  // Conservative delay for testing
                        } else {
                            console.log(getTimestamp() + ' OTA: First packet sent, no delay');
                        }
                        packetsSent++;
                        
                        sent = true;
                        break;  // Success, exit retry loop
                        
                    } catch (error) {
                        console.warn(getTimestamp() + ` OTA: Attempt ${attempt + 1}/${this.maxRetries} failed:`, error.message);
                        
                        if (attempt === this.maxRetries - 1) {
                            // Last attempt failed, give up
                            throw error;
                        }
                        
                        // Wait before retry
                        console.warn(getTimestamp() + ` OTA: Retrying in ${100 * (attempt + 1)}ms...`);
                        await this.delay(100 * (attempt + 1));
                    }
                }
                
                if (!sent) {
                    throw new Error('Failed to send packet after retries');
                }

                this.sentBytes += chunkSize;
                this.currentSequence++;

                // Update progress locally (device will also send notifications)
                const progress = Math.floor((this.sentBytes / this.totalSize) * 100);
                this.updateProgress(progress);

                // Fixed 150ms delay - very safe for reliable transfer
                await this.delay(150);
            }

            console.log(getTimestamp() + ' OTA: All data sent, sending FINISH command');
            await this.sendFinishCommand();

        } catch (error) {
            console.error(getTimestamp() + ' OTA: Failed to send data:', error);
            this.isUpdating = false;
            throw error;
        }
    }

    /**
     * Send FINISH command with CRC
     */
    async sendFinishCommand() {
        const BleClient = getBleClient();
        if (!BleClient) {
            throw new Error('BleClient not available');
        }

        const crc = this.calculateCRC32(this.firmwareData);
        console.log(getTimestamp() + ' OTA: Calculated CRC32:', crc.toString(16));

        // FINISH command: [0x03][crc_low][crc_high][crc_mid][crc_top]
        const data = new Uint8Array(5);
        data[0] = 0x03; // FINISH command
        data[1] = crc & 0xFF;
        data[2] = (crc >> 8) & 0xFF;
        data[3] = (crc >> 16) & 0xFF;
        data[4] = (crc >> 24) & 0xFF;

        try {
            await BleClient.writeWithoutResponse(
                this.deviceAddress,
                this.SERVICE_UUID,
                this.OTA_CHAR_UUID,
                new DataView(data.buffer)
            );
            
            this.updateStatus('Verifying...');
        } catch (error) {
            console.error(getTimestamp() + ' OTA: Failed to send FINISH command:', error);
            throw error;
        }
    }

    /**
     * Calculate CRC32
     */
    calculateCRC32(data) {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            table[i] = c;
        }

        let crc = 0xFFFFFFFF;
        for (let i = 0; i < data.length; i++) {
            crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    /**
     * Disconnect from device
     */
    async disconnect() {
        const BleClient = getBleClient();
        if (!BleClient || !this.isConnected) {
            return;
        }

        try {
            await BleClient.disconnect(this.deviceAddress);
            console.log(getTimestamp() + ' OTA: Disconnected');
        } catch (error) {
            console.warn(getTimestamp() + ' OTA: Disconnect error:', error);
        }

        this.handleDisconnect();
    }

    /**
     * Handle disconnect event (matches motor-controller pattern)
     */
    handleDisconnect() {
        console.log(getTimestamp() + ' OTA: Device disconnected');
        this.isConnected = false;
        this.isUpdating = false;
        this.deviceAddress = null;
        this.updateStatus('Disconnected');
        
        if (this.onDisconnect) {
            this.onDisconnect();
        }
    }

    /**
     * Update status
     */
    updateStatus(status) {
        console.log(getTimestamp() + ' OTA Status:', status);
        if (this.onStatusChange) {
            this.onStatusChange(status);
        }
    }

    /**
     * Update progress
     */
    updateProgress(percent) {
        if (this.onProgress) {
            this.onProgress(percent);
        }
    }

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Check if device is connected
     */
    isDeviceConnected() {
        return this.isConnected;
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            isUpdating: this.isUpdating,
            deviceAddress: this.deviceAddress,
            firmwareLoaded: !!this.firmwareData,
            totalSize: this.totalSize,
            sentBytes: this.sentBytes,
            progress: this.totalSize > 0 ? Math.floor((this.sentBytes / this.totalSize) * 100) : 0
        };
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OTAController };
}

// Create global instance
if (typeof window !== 'undefined') {
    window.OTAController = OTAController;
    window.otaController = new OTAController();
}

export { OTAController };
