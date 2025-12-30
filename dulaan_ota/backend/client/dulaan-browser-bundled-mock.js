/**
 * Dulaan Browser Bundle - Auto-generated from modular sources
 * Generated on: 2025-09-26T08:11:31.593Z
 * Build type: Mock
 * 
 * This file combines all modular ES6 files into a single browser-compatible bundle.
 * 
 * Source files:
 * - mocks/mock-ble.js
 * - mocks/mock-voice-recorder.js
 * - utils/constants.js
 * - utils/audio-utils.js
 * - utils/motor-patterns.js
 * - core/motor-controller.js
 * - core/streaming-processor.js
 * - services/api-service.js
 * - services/consent-service.js
 * - services/remote-service.js
 * - services/motor-pattern-library.js
 * - modes/ai-voice-control.js
 * - modes/ambient-control.js
 * - modes/touch-control.js
 * - modes/pattern-control.js
 * - dulaan-sdk.js
 */

(function(window) {
    'use strict';


    // ============================================================================
    // mocks/mock-ble.js
    // ============================================================================

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

    // ============================================================================
    // mocks/mock-voice-recorder.js
    // ============================================================================

/**
 * Mock Voice Recorder for testing and development
 * Simulates Capacitor VoiceRecorder plugin behavior without actual microphone access
 */

class MockVoiceRecorder {
    constructor() {
        this.isStreaming = false;
        this.listeners = new Map();
        this.streamInterval = null;
        this.chunkCounter = 0;
        
        // Error simulation flags for testing edge cases
        this.simulatePermissionDenied = false;
        this.simulateStartError = false;
        this.simulateStopError = false;
        this.simulateChunkError = false;
        
        console.log('[MOCK VOICE] MockVoiceRecorder initialized');
    }

    /**
     * Request audio recording permission
     */
    async requestAudioRecordingPermission() {
        console.log('[MOCK VOICE] Requesting audio permission...');
        await this.delay(300);
        
        // Simulate permission denied for testing
        if (this.simulatePermissionDenied) {
            const result = { value: false };
            console.log('[MOCK VOICE] ❌ Audio permission denied (simulated)');
            return result;
        }
        
        // Simulate permission granted
        const result = { value: true };
        console.log('[MOCK VOICE] ✅ Audio permission granted');
        return result;
    }

    /**
     * Remove all event listeners
     */
    async removeAllListeners() {
        console.log('[MOCK VOICE] Removing all listeners...');
        this.listeners.clear();
        await this.delay(50);
        console.log('[MOCK VOICE] ✅ All listeners removed');
    }

    /**
     * Add event listener
     */
    addListener(eventName, callback) {
        console.log('[MOCK VOICE] Adding listener for:', eventName);
        
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }
        this.listeners.get(eventName).push(callback);
        
        console.log('[MOCK VOICE] ✅ Listener added for:', eventName);
    }

    /**
     * Start audio streaming
     */
    async startStreaming() {
        if (this.isStreaming) {
            console.warn('[MOCK VOICE] ⚠️ Already streaming');
            return;
        }

        console.log('[MOCK VOICE] Starting audio streaming...');
        await this.delay(200);
        
        // Simulate start error for testing
        if (this.simulateStartError) {
            const error = new Error('Failed to start audio streaming (simulated)');
            console.error('[MOCK VOICE] ❌ Start streaming error:', error.message);
            throw error;
        }
        
        this.isStreaming = true;
        this.chunkCounter = 0;
        
        // Start generating mock audio chunks
        this.streamInterval = setInterval(() => {
            this.generateMockAudioChunk();
        }, 100); // Generate chunk every 100ms
        
        console.log('[MOCK VOICE] ✅ Audio streaming started');
    }

    /**
     * Stop audio streaming
     */
    async stopStreaming() {
        if (!this.isStreaming) {
            console.warn('[MOCK VOICE] ⚠️ Not currently streaming');
            return;
        }

        console.log('[MOCK VOICE] Stopping audio streaming...');
        
        // Simulate stop error for testing
        if (this.simulateStopError) {
            const error = new Error('Failed to stop audio streaming (simulated)');
            console.error('[MOCK VOICE] ❌ Stop streaming error:', error.message);
            throw error;
        }
        
        this.isStreaming = false;
        if (this.streamInterval) {
            clearInterval(this.streamInterval);
            this.streamInterval = null;
        }
        
        await this.delay(100);
        console.log('[MOCK VOICE] ✅ Audio streaming stopped');
    }

    /**
     * Generate mock audio chunk and trigger listeners
     */
    generateMockAudioChunk() {
        if (!this.isStreaming) return;

        this.chunkCounter++;
        
        // Simulate chunk error for testing
        if (this.simulateChunkError && this.chunkCounter % 10 === 0) {
            console.error('[MOCK VOICE] ❌ Simulated chunk processing error');
            return; // Skip this chunk
        }
        
        // Generate mock audio data (simulates real audio patterns)
        const mockAudioData = this.generateMockAudioData();
        
        // Convert to base64 (simulates real plugin behavior)
        const base64Chunk = this.arrayBufferToBase64(mockAudioData);
        
        // Trigger audioChunk listeners
        const audioChunkListeners = this.listeners.get('audioChunk') || [];
        audioChunkListeners.forEach(callback => {
            try {
                callback({ chunk: base64Chunk });
            } catch (error) {
                console.error('[MOCK VOICE] Error in audioChunk callback:', error);
            }
        });

        // Log occasionally to show activity
        if (this.chunkCounter % 50 === 0) {
            console.log(`[MOCK VOICE] Generated ${this.chunkCounter} audio chunks`);
        }
    }

    /**
     * Generate realistic mock audio data
     */
    generateMockAudioData() {
        const sampleRate = 16000;
        const chunkDurationMs = 100;
        const samplesPerChunk = Math.floor(sampleRate * chunkDurationMs / 1000);
        
        // Create Float32Array for audio samples
        const audioData = new Float32Array(samplesPerChunk);
        
        // Generate different types of mock audio patterns
        const time = this.chunkCounter * chunkDurationMs / 1000;
        const patternType = Math.floor(time / 5) % 4; // Change pattern every 5 seconds
        
        for (let i = 0; i < samplesPerChunk; i++) {
            const t = (time * sampleRate + i) / sampleRate;
            let sample = 0;
            
            switch (patternType) {
                case 0: // Quiet background noise
                    sample = (Math.random() - 0.5) * 0.01;
                    break;
                    
                case 1: // Low frequency tone (simulates voice)
                    sample = Math.sin(2 * Math.PI * 200 * t) * 0.1 + 
                            Math.sin(2 * Math.PI * 400 * t) * 0.05 +
                            (Math.random() - 0.5) * 0.02;
                    break;
                    
                case 2: // Medium energy (simulates speech)
                    sample = Math.sin(2 * Math.PI * 300 * t) * 0.15 * Math.sin(2 * Math.PI * 5 * t) +
                            Math.sin(2 * Math.PI * 600 * t) * 0.08 +
                            (Math.random() - 0.5) * 0.03;
                    break;
                    
                case 3: // Higher energy (simulates louder speech)
                    sample = Math.sin(2 * Math.PI * 250 * t) * 0.2 * Math.sin(2 * Math.PI * 3 * t) +
                            Math.sin(2 * Math.PI * 500 * t) * 0.12 +
                            Math.sin(2 * Math.PI * 1000 * t) * 0.06 +
                            (Math.random() - 0.5) * 0.04;
                    break;
            }
            
            // Clamp to valid range
            audioData[i] = Math.max(-1, Math.min(1, sample));
        }
        
        return audioData.buffer;
    }

    /**
     * Convert ArrayBuffer to base64 string
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
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
            isStreaming: this.isStreaming,
            chunkCounter: this.chunkCounter,
            listenerCount: this.listeners.size,
            listeners: Array.from(this.listeners.keys()),
            errorSimulation: {
                permissionDenied: this.simulatePermissionDenied,
                startError: this.simulateStartError,
                stopError: this.simulateStopError,
                chunkError: this.simulateChunkError
            }
        };
    }

    /**
     * Control error simulation for testing
     */
    setErrorSimulation(errorType, enabled = true) {
        switch (errorType) {
            case 'permission':
                this.simulatePermissionDenied = enabled;
                break;
            case 'start':
                this.simulateStartError = enabled;
                break;
            case 'stop':
                this.simulateStopError = enabled;
                break;
            case 'chunk':
                this.simulateChunkError = enabled;
                break;
            case 'all':
                this.simulatePermissionDenied = enabled;
                this.simulateStartError = enabled;
                this.simulateStopError = enabled;
                this.simulateChunkError = enabled;
                break;
            default:
                console.warn('[MOCK VOICE] Unknown error type:', errorType);
                return;
        }
        console.log(`[MOCK VOICE] Error simulation ${errorType}: ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Manually trigger a specific audio pattern for testing
     */
    triggerTestPattern(patternType = 'speech') {
        if (!this.isStreaming) {
            console.warn('[MOCK VOICE] ⚠️ Not streaming, cannot trigger test pattern');
            return;
        }

        console.log('[MOCK VOICE] Triggering test pattern:', patternType);
        
        // Generate specific test audio
        const testAudio = this.generateTestAudioPattern(patternType);
        const base64Chunk = this.arrayBufferToBase64(testAudio);
        
        // Trigger listeners
        const audioChunkListeners = this.listeners.get('audioChunk') || [];
        audioChunkListeners.forEach(callback => {
            callback({ chunk: base64Chunk });
        });
    }

    /**
     * Generate specific test audio patterns
     */
    generateTestAudioPattern(patternType) {
        const samplesPerChunk = 1600; // 100ms at 16kHz
        const audioData = new Float32Array(samplesPerChunk);
        
        for (let i = 0; i < samplesPerChunk; i++) {
            const t = i / 16000;
            let sample = 0;
            
            switch (patternType) {
                case 'silence':
                    sample = (Math.random() - 0.5) * 0.001;
                    break;
                case 'tone':
                    sample = Math.sin(2 * Math.PI * 440 * t) * 0.3;
                    break;
                case 'speech':
                    sample = Math.sin(2 * Math.PI * 300 * t) * 0.2 * Math.sin(2 * Math.PI * 10 * t) +
                            Math.sin(2 * Math.PI * 600 * t) * 0.1;
                    break;
                case 'noise':
                    sample = (Math.random() - 0.5) * 0.1;
                    break;
            }
            
            audioData[i] = Math.max(-1, Math.min(1, sample));
        }
        
        return audioData.buffer;
    }
}

// Create and install mock VoiceRecorder
function installMockVoiceRecorder() {
    if (typeof window !== 'undefined') {
        // Create Capacitor structure if it doesn't exist
        if (!window.Capacitor) {
            window.Capacitor = {};
        }
        if (!window.Capacitor.Plugins) {
            window.Capacitor.Plugins = {};
        }
        
        const mockVoiceRecorder = new MockVoiceRecorder();
        window.Capacitor.Plugins.VoiceRecorder = mockVoiceRecorder;
        
        console.log('[MOCK VOICE] ✅ Mock VoiceRecorder installed on window.Capacitor.Plugins.VoiceRecorder');
        return mockVoiceRecorder;
    } else {
        console.warn('[MOCK VOICE] ⚠️ Window object not available, cannot install mock');
        return null;
    }
}

// Auto-install if this file is loaded directly
if (typeof window !== 'undefined' && !window.Capacitor?.Plugins?.VoiceRecorder) {
    installMockVoiceRecorder();
}

// Export for manual installation
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MockVoiceRecorder, installMockVoiceRecorder };
}

    // ============================================================================
    // utils/constants.js
    // ============================================================================

/**
 * Constants - Utility functions for the Dulaan SDK
 */

// Remote Control Configuration (used by UTILS)
const REMOTE_CONFIG = {
    // ID Generation
    ID_LENGTH: 6,
    ID_CHARS: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
};

// Utility Functions
const UTILS = {
    /**
     * Generate a short 6-character unique ID for peer connections
     * @returns {string} 6-character alphanumeric ID
     */
    generateShortId: () => {
        const chars = REMOTE_CONFIG.ID_CHARS;
        let result = '';
        for (let i = 0; i < REMOTE_CONFIG.ID_LENGTH; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },
    
    /**
     * Validate if an ID is in the correct format
     * @param {string} id - ID to validate
     * @returns {boolean} True if valid
     */
    isValidId: (id) => {
        if (!id || typeof id !== 'string') return false;
        if (id.length !== REMOTE_CONFIG.ID_LENGTH) return false;
        return /^[A-Z0-9]+$/.test(id);
    }
};

    // ============================================================================
    // utils/audio-utils.js
    // ============================================================================

/**
 * Audio Utilities - Helper functions for audio processing
 */

/**
 * Efficient Ring Buffer for audio data
 * Optimized for real-time audio processing with minimal memory allocation
 */
class RingBuffer {
    constructor(capacity) {
        this.capacity = capacity;
        this.buffer = new Float32Array(capacity);
        this.writeIndex = 0;
        this.count = 0;
    }

    /**
     * Add data to the buffer (single value or array)
     */
    push(data) {
        if (Array.isArray(data) || data instanceof Float32Array || data instanceof Int16Array) {
            for (let i = 0; i < data.length; i++) {
                this.pushSingle(data[i]);
            }
        } else {
            this.pushSingle(data);
        }
    }

    /**
     * Add single value to buffer
     */
    pushSingle(value) {
        this.buffer[this.writeIndex] = value;
        this.writeIndex = (this.writeIndex + 1) % this.capacity;
        this.count = Math.min(this.count + 1, this.capacity);
    }

    /**
     * Read last N samples from buffer
     */
    readLast(samples) {
        const numSamples = Math.min(samples, this.count);
        const result = new Float32Array(numSamples);
        let readIndex = (this.writeIndex - numSamples + this.capacity) % this.capacity;
        
        for (let i = 0; i < numSamples; i++) {
            result[i] = this.buffer[readIndex];
            readIndex = (readIndex + 1) % this.capacity;
        }
        
        return result;
    }

    /**
     * Read all data from buffer
     */
    readAll() {
        return this.readLast(this.count);
    }

    /**
     * Reset buffer to empty state
     */
    reset() {
        this.writeIndex = 0;
        this.count = 0;
    }

    /**
     * Check if buffer is full
     */
    isFull() {
        return this.count === this.capacity;
    }

    /**
     * Check if buffer is empty
     */
    isEmpty() {
        return this.count === 0;
    }

    /**
     * Get current fill percentage
     */
    getFillPercentage() {
        return (this.count / this.capacity) * 100;
    }
}

/**
 * Convert base64 to Float32Array with error handling
 */
function base64ToFloat32Array(base64) {
    try {
        const pureBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
        const binary = atob(pureBase64);
        const bytes = new Uint8Array(binary.length);
        
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        const view = new DataView(bytes.buffer);
        const floats = new Float32Array(bytes.length / 4);
        
        for (let i = 0; i < floats.length; i++) {
            floats[i] = view.getFloat32(i * 4, true);
        }
        
        return floats;
    } catch (e) {
        console.error("Base64 to Float32Array conversion failed:", e);
        return new Float32Array(0);
    }
}



/**
 * Calculate RMS (Root Mean Square) energy of audio data
 */
function calculateRMS(audioData) {
    if (!audioData || audioData.length === 0) return 0;
    
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
        sum += audioData[i] * audioData[i];
    }
    
    return Math.sqrt(sum / audioData.length);
}







/**
 * Convert energy to PWM value with configurable scaling
 */
function energyToPWM(energy, maxEnergy = 0.075, maxPWM = 255) {
    if (energy <= 0) return 0;
    
    const normalizedEnergy = Math.min(energy / maxEnergy, 1.0);
    const pwmValue = Math.round(normalizedEnergy * maxPWM);
    
    return Math.max(0, Math.min(maxPWM, pwmValue));
}







// Global access
if (typeof window !== 'undefined') {
    window.audioUtils = {
        RingBuffer,
        base64ToFloat32Array,
        calculateRMS,
        energyToPWM
    };
}

    // ============================================================================
    // utils/motor-patterns.js
    // ============================================================================

/**
 * Motor Pattern Library - Predefined PWM patterns for motor control
 * Each pattern defines a sequence of PWM values over time
 */

/**
 * Pattern data structure:
 * {
 *   id: string,           // Unique identifier
 *   name: string,         // Display name (English)
 *   name_sp: string,      // Display name (Spanish)
 *   description: string,  // Pattern description (English)
 *   description_sp: string, // Pattern description (Spanish)
 *   category: string,     // Pattern category
 *   duration: number,     // Total duration in milliseconds
 *   loop: boolean,        // Whether to loop the pattern
 *   frames: [             // Array of time-PWM pairs
 *     { time: number, pwm: number }
 *   ]
 * }
 */

// Relaxing patterns - gentle, calming, peaceful
const RELAXING_PATTERNS = {
    gentle_waves: {
        id: "gentle_waves",
        name: "Gentle Waves",
        name_sp: "Ondas Suaves",
        description: "Gentle waves, relaxing",
        description_sp: "Ondas suaves, relajantes",
        category: "relaxing",
        duration: 10000,
        loop: true,
        frames: [
            { time: 0, pwm: Math.round(20 * 2.55) },      // 51
            { time: 1000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 2000, pwm: Math.round(60 * 2.55) },   // 153
            { time: 3000, pwm: Math.round(80 * 2.55) },   // 204
            { time: 4000, pwm: Math.round(60 * 2.55) },   // 153
            { time: 5000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 6000, pwm: Math.round(20 * 2.55) },   // 51
            { time: 7000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 8000, pwm: Math.round(60 * 2.55) },   // 153
            { time: 9000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 10000, pwm: Math.round(40 * 2.55) }   // 102
        ]
    },

    meditation_flow: {
        id: "meditation_flow",
        name: "Meditation Flow",
        name_sp: "Flujo de Meditación",
        description: "Meditation flow, stable and peaceful",
        description_sp: "Flujo de meditación, estable y pacífico",
        category: "relaxing",
        duration: 10000,
        loop: true,
        frames: [
            { time: 0, pwm: Math.round(40 * 2.55) },      // 102
            { time: 1000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 2000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 3000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 4000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 5000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 6000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 7000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 8000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 9000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 10000, pwm: Math.round(40 * 2.55) }   // 102
        ]
    },

    twilight_drift: {
        id: "twilight_drift",
        name: "Twilight Drift",
        name_sp: "Deriva del Crepúsculo",
        description: "Twilight drift, relaxing wind-down",
        description_sp: "Deriva del crepúsculo, relajación gradual",
        category: "relaxing",
        duration: 10000,
        loop: true,
        frames: [
            { time: 0, pwm: Math.round(60 * 2.55) },      // 153
            { time: 1000, pwm: Math.round(50 * 2.55) },   // 128
            { time: 2000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 3000, pwm: Math.round(30 * 2.55) },   // 77
            { time: 4000, pwm: Math.round(20 * 2.55) },   // 51
            { time: 5000, pwm: Math.round(10 * 2.55) },   // 26
            { time: 6000, pwm: 0 },                       // 0
            { time: 7000, pwm: Math.round(10 * 2.55) },   // 26
            { time: 8000, pwm: 0 },                       // 0
            { time: 9000, pwm: 0 },                       // 0
            { time: 10000, pwm: 0 }                       // 0
        ]
    },

    ocean_breeze: {
        id: "ocean_breeze",
        name: "Ocean Breeze",
        name_sp: "Brisa del Océano",
        description: "Ocean breeze on face, light and airy",
        description_sp: "Brisa del océano en el rostro, ligera y aireada",
        category: "relaxing",
        duration: 10000,
        loop: true,
        frames: [
            { time: 0, pwm: Math.round(30 * 2.55) },      // 77
            { time: 1000, pwm: Math.round(50 * 2.55) },   // 128
            { time: 2000, pwm: Math.round(20 * 2.55) },   // 51
            { time: 3000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 4000, pwm: Math.round(30 * 2.55) },   // 77
            { time: 5000, pwm: Math.round(50 * 2.55) },   // 128
            { time: 6000, pwm: Math.round(20 * 2.55) },   // 51
            { time: 7000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 8000, pwm: Math.round(30 * 2.55) },   // 77
            { time: 9000, pwm: Math.round(20 * 2.55) },   // 51
            { time: 10000, pwm: Math.round(20 * 2.55) }   // 51
        ]
    }
};

// Energizing patterns - boosting, awakening, focusing
const ENERGIZING_PATTERNS = {
    power_pulse: {
        id: "power_pulse",
        name: "Power Pulse",
        name_sp: "Pulso de Poder",
        description: "Powerful pulse, energy boost",
        description_sp: "Pulso poderoso, impulso de energía",
        category: "energizing",
        duration: 10000,
        loop: true,
        frames: [
            { time: 0, pwm: Math.round(90 * 2.55) },      // 230
            { time: 1000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 2000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 3000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 4000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 5000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 6000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 7000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 8000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 9000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 10000, pwm: Math.round(90 * 2.55) }   // 230
        ]
    },

    sunrise_awakening: {
        id: "sunrise_awakening",
        name: "Sunrise Awakening",
        name_sp: "Despertar del Amanecer",
        description: "Sunrise awakening, gradually strengthening",
        description_sp: "Despertar del amanecer, fortalecimiento gradual",
        category: "energizing",
        duration: 10000,
        loop: true,
        frames: [
            { time: 0, pwm: Math.round(10 * 2.55) },      // 26
            { time: 1000, pwm: Math.round(20 * 2.55) },   // 51
            { time: 2000, pwm: Math.round(30 * 2.55) },   // 77
            { time: 3000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 4000, pwm: Math.round(50 * 2.55) },   // 128
            { time: 5000, pwm: Math.round(60 * 2.55) },   // 153
            { time: 6000, pwm: Math.round(70 * 2.55) },   // 179
            { time: 7000, pwm: Math.round(80 * 2.55) },   // 204
            { time: 8000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 9000, pwm: Math.round(100 * 2.55) },  // 255
            { time: 10000, pwm: Math.round(100 * 2.55) }  // 255
        ]
    },

    focus_booster: {
        id: "focus_booster",
        name: "Focus Booster",
        name_sp: "Potenciador de Concentración",
        description: "Focus enhancement, stable concentration",
        description_sp: "Mejora de concentración, enfoque estable",
        category: "energizing",
        duration: 10000,
        loop: true,
        frames: [
            { time: 0, pwm: Math.round(70 * 2.55) },      // 179
            { time: 1000, pwm: Math.round(70 * 2.55) },   // 179
            { time: 2000, pwm: Math.round(70 * 2.55) },   // 179
            { time: 3000, pwm: Math.round(70 * 2.55) },   // 179
            { time: 4000, pwm: Math.round(70 * 2.55) },   // 179
            { time: 5000, pwm: Math.round(70 * 2.55) },   // 179
            { time: 6000, pwm: Math.round(70 * 2.55) },   // 179
            { time: 7000, pwm: Math.round(70 * 2.55) },   // 179
            { time: 8000, pwm: Math.round(70 * 2.55) },   // 179
            { time: 9000, pwm: Math.round(70 * 2.55) },   // 179
            { time: 10000, pwm: Math.round(70 * 2.55) }   // 179
        ]
    }
};

// Dynamic patterns - rhythmic, lively, alternating
const DYNAMIC_PATTERNS = {
    rhythmic_dance: {
        id: "rhythmic_dance",
        name: "Rhythmic Dance",
        name_sp: "Danza Rítmica",
        description: "Rhythmic dance, lively",
        description_sp: "Danza rítmica, animada",
        category: "dynamic",
        duration: 10000,
        loop: true,
        frames: [
            { time: 0, pwm: Math.round(80 * 2.55) },      // 204
            { time: 1000, pwm: Math.round(20 * 2.55) },   // 51
            { time: 2000, pwm: Math.round(80 * 2.55) },   // 204
            { time: 3000, pwm: Math.round(20 * 2.55) },   // 51
            { time: 4000, pwm: Math.round(60 * 2.55) },   // 153
            { time: 5000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 6000, pwm: Math.round(60 * 2.55) },   // 153
            { time: 7000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 8000, pwm: Math.round(80 * 2.55) },   // 204
            { time: 9000, pwm: Math.round(20 * 2.55) },   // 51
            { time: 10000, pwm: Math.round(20 * 2.55) }   // 51
        ]
    },

    storm_rush: {
        id: "storm_rush",
        name: "Storm Rush",
        name_sp: "Tormenta Intensa",
        description: "Storm and rain, intense burst",
        description_sp: "Tormenta y lluvia, ráfaga intensa",
        category: "dynamic",
        duration: 10000,
        loop: true,
        frames: [
            { time: 0, pwm: Math.round(100 * 2.55) },     // 255
            { time: 1000, pwm: 0 },                       // 0
            { time: 2000, pwm: Math.round(100 * 2.55) },  // 255
            { time: 3000, pwm: 0 },                       // 0
            { time: 4000, pwm: Math.round(80 * 2.55) },   // 204
            { time: 5000, pwm: 0 },                       // 0
            { time: 6000, pwm: Math.round(100 * 2.55) },  // 255
            { time: 7000, pwm: 0 },                       // 0
            { time: 8000, pwm: Math.round(100 * 2.55) },  // 255
            { time: 9000, pwm: 0 },                       // 0
            { time: 10000, pwm: 0 }                       // 0
        ]
    },

    tech_pulse: {
        id: "tech_pulse",
        name: "Tech Pulse",
        name_sp: "Pulso Tecnológico",
        description: "Tech rhythm, modern feel",
        description_sp: "Ritmo tecnológico, sensación moderna",
        category: "dynamic",
        duration: 10000,
        loop: true,
        frames: [
            { time: 0, pwm: Math.round(90 * 2.55) },      // 230
            { time: 1000, pwm: 0 },                       // 0
            { time: 2000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 3000, pwm: 0 },                       // 0
            { time: 4000, pwm: Math.round(70 * 2.55) },   // 179
            { time: 5000, pwm: 0 },                       // 0
            { time: 6000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 7000, pwm: 0 },                       // 0
            { time: 8000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 9000, pwm: 0 },                       // 0
            { time: 10000, pwm: 0 }                       // 0
        ]
    }
};

// Remove special patterns - replaced with user-defined patterns

// Combine all patterns into a single library
const MOTOR_PATTERN_LIBRARY = {
    ...RELAXING_PATTERNS,
    ...ENERGIZING_PATTERNS,
    ...DYNAMIC_PATTERNS
};

// Pattern categories for organization
const PATTERN_CATEGORIES = {
    relaxing: {
        name: "Relaxing",
        description: "Gentle, calming, peaceful patterns",
        patterns: Object.keys(RELAXING_PATTERNS)
    },
    energizing: {
        name: "Energizing", 
        description: "Boosting, awakening, focusing patterns",
        patterns: Object.keys(ENERGIZING_PATTERNS)
    },
    dynamic: {
        name: "Dynamic",
        description: "Rhythmic, lively, alternating patterns", 
        patterns: Object.keys(DYNAMIC_PATTERNS)
    }
};

// Utility functions
const PatternUtils = {
    /**
     * Get all pattern IDs
     */
    getAllPatternIds() {
        return Object.keys(MOTOR_PATTERN_LIBRARY);
    },

    /**
     * Get patterns by category
     */
    getPatternsByCategory(category) {
        return Object.values(MOTOR_PATTERN_LIBRARY).filter(pattern => pattern.category === category);
    },

    /**
     * Get pattern by ID
     */
    getPattern(id) {
        return MOTOR_PATTERN_LIBRARY[id] || null;
    },

    /**
     * Validate pattern structure
     */
    validatePattern(pattern) {
        const required = ['id', 'name', 'name_sp', 'description', 'description_sp', 'category', 'duration', 'loop', 'frames'];
        const missing = required.filter(field => !(field in pattern));
        
        if (missing.length > 0) {
            return { valid: false, errors: [`Missing required fields: ${missing.join(', ')}`] };
        }

        if (!Array.isArray(pattern.frames)) {
            return { valid: false, errors: ['Frames must be an array'] };
        }

        const frameErrors = [];
        pattern.frames.forEach((frame, index) => {
            if (typeof frame.time !== 'number' || typeof frame.pwm !== 'number') {
                frameErrors.push(`Frame ${index}: time and pwm must be numbers`);
            }
            if (frame.pwm < 0 || frame.pwm > 255) {
                frameErrors.push(`Frame ${index}: pwm must be between 0 and 255`);
            }
        });

        return { valid: frameErrors.length === 0, errors: frameErrors };
    },

    /**
     * Generate random pattern for random_walk
     */
    generateRandomPattern(duration = 5000, frameCount = 10) {
        const frames = [];
        const timeStep = duration / (frameCount - 1);
        
        for (let i = 0; i < frameCount; i++) {
            frames.push({
                time: Math.round(i * timeStep),
                pwm: Math.round(Math.random() * 255)
            });
        }
        
        return frames;
    }
};

// Global access
if (typeof window !== 'undefined') {
    window.MotorPatterns = {
        MOTOR_PATTERN_LIBRARY,
        PATTERN_CATEGORIES,
        PatternUtils
    };
}

    // ============================================================================
    // core/motor-controller.js
    // ============================================================================

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
        
        // BLE service and characteristic UUIDs
        this.SERVICE_UUID = "0000FFE0-0000-1000-8000-00805F9B34FB";
        this.CHARACTERISTIC_UUID = "0000FFE1-0000-1000-8000-00805F9B34FB";
        
        // Device identification
        this.TARGET_DEVICE_NAME = "XKL-Q086-BT";
        this.SCAN_TIMEOUT = 10000; // 10 seconds default
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
            return true;
        } catch (error) {
            console.error('BLE initialization failed:', error);
            return false;
        }
    }

    /**
     * Scan for motor devices (based on plugin.js implementation)
     */
    async scan(timeout = this.SCAN_TIMEOUT) {
        if (this.isScanning) {
            console.warn('Scan already in progress');
            return false;
        }

        try {
            const BleClient = getBleClient();
            if (!BleClient) {
                console.warn('BleClient not available - cannot scan');
                return false;
            }

            await BleClient.initialize();
            this.isScanning = true;
            this.scanResults = [];
            
            console.log('Starting BLE scan for motor devices...');
            
            await BleClient.requestLEScan({}, async (result) => {
                console.log('Scan result:', JSON.stringify(result));
                
                // Filter for target device name (matches plugin.js)
                if (result.device.name === this.TARGET_DEVICE_NAME) {
                    console.log('Found target device:', result.device.deviceId);
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
                    await this.stopScan();
                }
            }, timeout);

            return true;
        } catch (error) {
            console.error('Failed to start scan:', error);
            this.isScanning = false;
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
        }
    }

    /**
     * Scan and connect to motor device automatically
     */
    async scanAndConnect(timeout = this.SCAN_TIMEOUT) {
        try {
            console.log('Scanning for motor device...');
            await this.scan(timeout);
            
            // Wait for scan to complete
            await new Promise(resolve => setTimeout(resolve, timeout + 1000));
            
            if (this.deviceAddress) {
                console.log('Device found, attempting to connect...');
                return await this.connect();
            } else {
                console.warn('No motor device found during scan');
                return false;
            }
        } catch (error) {
            console.error('Scan and connect failed:', error);
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
     */
    async write(pwmValue) {
        // Validate PWM value first
        const pwm = Math.max(0, Math.min(255, Math.round(pwmValue)));
        
        // Check if we're connected as remote to another host
        if (this.remoteService && this.remoteService.isRemote) {
            return this.writeToRemoteHost(pwm);
        }
        
        // Normal local BLE write
        return this.writeToLocalBLE(pwm);
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
     * Write PWM value to local BLE device
     */
    async writeToLocalBLE(pwmValue) {
        
        if (!this.isConnected || !this.deviceAddress) {
            console.warn('[MOTOR WRITE] ❌ Motor not connected, cannot write PWM value');
            return false;
        }

        try {
            // Convert to hex string
            const hexValue = this.decimalToHexString(pwmValue);
            
            // Write to BLE characteristic
            const BleClient = getBleClient();
            if (!BleClient) {
                console.warn('[MOTOR WRITE] ⚠️ BleClient not available - PWM value stored but not transmitted');
                this.currentPwm = pwmValue;
                return true;
            }
            
            await BleClient.writeWithoutResponse(
                this.deviceAddress,
                this.SERVICE_UUID,
                this.CHARACTERISTIC_UUID,
                hexStringToDataView(hexValue)
            );
            
            this.currentPwm = pwmValue;
            return true;
        } catch (error) {
            console.error('[MOTOR WRITE] ❌ Failed to write PWM value:', error);
            return false;
        }
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
}

// Create singleton instance
const motorController = new MotorController();

// Export both the class and instance for flexibility
// Global access
if (typeof window !== 'undefined') {
    window.motorController = motorController;
}

    // ============================================================================
    // core/streaming-processor.js
    // ============================================================================

/**
 * Streaming Audio Processor
 * Voice Activity Detection and audio processing for Capacitor audio chunks
 * Based on working test-real-api.html implementation
 */

class StreamingProcessor {
    constructor() {
        // Get RingBuffer class - use global if available (for bundled version)
        const RingBufferClass = (typeof RingBuffer !== 'undefined') ? RingBuffer :
                                (typeof window !== 'undefined' && window.DULAAN_COMPONENTS && window.DULAAN_COMPONENTS.RingBuffer) ? window.DULAAN_COMPONENTS.RingBuffer :
                                null;
        
        if (!RingBufferClass) {
            throw new Error('RingBuffer class not available. Make sure audio-utils.js is loaded.');
        }

        // Audio state
        this.isActive = false;
        this.isListening = false;
        this.isProcessing = false;
        this.currentPwm = 0;
        
        // Ring buffers for efficient memory usage
        this.vadBuffer = new RingBufferClass(4800); // 300ms for VAD analysis
        this.speechBuffer = new RingBufferClass(16000 * 30); // 30 seconds max speech
        
        // VAD state
        this.consecutiveVoiceFrames = 0;
        this.consecutiveSilenceFrames = 0;
        this.isVoiceActive = false;
        this.voiceStartTime = 0;
        
        // Efficiency tracking
        this.totalChunks = 0;
        this.apiCalls = 0;
        this.lastRMS = 0;
        this.lastZeroCrossings = 0;
        this.lastApiCall = 0; // Initialize to 0 to allow first API call
        
        // VAD thresholds (from working implementation)
        this.VAD_ENERGY_THRESHOLD = 0.008; // Balanced threshold
        this.VAD_ZCR_THRESHOLD = 0.08; // Balanced ZCR threshold
        this.VAD_VOICE_FRAMES = 3; // 3 consecutive frames to confirm voice
        this.VAD_SILENCE_FRAMES = 20; // 20 frames of silence to end speech
        this.MIN_SPEECH_DURATION = 500; // 500ms minimum (in samples)
        this.MAX_SPEECH_DURATION = 320000; // 20 seconds maximum
        
        // Energy history for adaptive thresholds
        this.energyHistory = [];
        
        // Callbacks
        this.onSpeechReady = null;
        this.onVoiceStateChange = null;
        this.onConversationUpdate = null;

        this.lastApiCall = 0; // Initialize to 0 to allow first API call

    }

    /**
     * Process audio chunk from Capacitor (base64 format)
     */
    processAudioChunk(base64Chunk) {
        try {
            const pcmData = this.base64ToFloat32Array(base64Chunk);
            
            if (pcmData.length === 0) {
                console.warn(`[PROCESSOR] Empty PCM data from base64 chunk`);
                return null;
            }

            this.totalChunks++;

            // Always buffer audio for pre/post-speech context
            this.vadBuffer.push(pcmData);
            
            // Voice Activity Detection
            const isVoiceActive = this.detectVoiceActivity(pcmData);
            
            // Voice activity state machine
            if (isVoiceActive) {
                this.consecutiveVoiceFrames++;
                this.consecutiveSilenceFrames = 0;
                
                // Voice start detection
                if (!this.isVoiceActive && this.consecutiveVoiceFrames >= this.VAD_VOICE_FRAMES) {
                    console.log(`[VAD] 🎤 Voice START detected (${this.consecutiveVoiceFrames} consecutive frames)`);
                    this.handleVoiceStart();
                }
                
                // Buffer speech audio during active speech
                if (this.isVoiceActive) {
                    this.speechBuffer.push(pcmData);
                    this.checkSpeechBufferLimits();
                }
                
            } else {
                this.consecutiveSilenceFrames++;
                this.consecutiveVoiceFrames = 0;
                
                // Voice end detection
                if (this.isVoiceActive && this.consecutiveSilenceFrames >= this.VAD_SILENCE_FRAMES) {
                    this.isVoiceActive = false;
                    this.isListening = false;
                    console.log(`[VAD] 🔇 Voice END detected (${this.consecutiveSilenceFrames} consecutive silence frames)`);
                    this.handleVoiceEnd();
                }
            }

            return {
                isVoiceActive: this.isVoiceActive,
                energy: this.lastRMS,
                zeroCrossings: this.lastZeroCrossings,
                speechBufferSize: this.speechBuffer.count,
                efficiency: {
                    totalChunks: this.totalChunks,
                    apiCalls: this.apiCalls,
                    apiCallRatio: this.apiCalls / this.totalChunks
                }
            };

        } catch (error) {
            console.error("Audio processing failed:", error);
            return null;
        }
    }

    /**
     * Voice Activity Detection (from working implementation)
     */
    detectVoiceActivity(audioData) {
        // Calculate RMS energy
        const rms = this.calculateRMS(audioData);
        this.lastRMS = rms;
        
        // Calculate zero crossing rate
        const zcr = this.calculateZeroCrossingRate(audioData);
        this.lastZeroCrossings = zcr;
        
        // Advanced VAD decision with adaptive thresholds
        const energyActive = rms > this.VAD_ENERGY_THRESHOLD;
        const zcrActive = zcr > this.VAD_ZCR_THRESHOLD && zcr < 0.5; // ZCR too high = noise
        
        // Adaptive threshold based on recent energy history
        this.energyHistory.push(rms);
        if (this.energyHistory.length > 100) this.energyHistory.shift();
        
        const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
        const adaptiveThreshold = Math.max(this.VAD_ENERGY_THRESHOLD, avgEnergy * 2);
        const adaptiveEnergyActive = rms > adaptiveThreshold;
        
        // Combined decision: energy must be active, ZCR should be reasonable
        const voiceDetected = energyActive && (zcrActive || rms > adaptiveThreshold * 1.5);
        
        // Debug logging (every 50 chunks to avoid spam)
        if (this.totalChunks % 50 === 0) {
            console.log(`[VAD] RMS: ${rms.toFixed(4)} (>${this.VAD_ENERGY_THRESHOLD}=${energyActive}, adaptive>${adaptiveThreshold.toFixed(4)}=${adaptiveEnergyActive}) | ZCR: ${zcr.toFixed(4)} (${this.VAD_ZCR_THRESHOLD}-0.5=${zcrActive}) | Voice: ${voiceDetected}`);
        }
        
        return voiceDetected;
    }

    /**
     * Calculate RMS energy
     */
    calculateRMS(audioData) {
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i] * audioData[i];
        }
        return Math.sqrt(sum / audioData.length);
    }

    /**
     * Calculate zero crossing rate
     */
    calculateZeroCrossingRate(audioData) {
        let crossings = 0;
        for (let i = 1; i < audioData.length; i++) {
            if ((audioData[i] >= 0) !== (audioData[i - 1] >= 0)) {
                crossings++;
            }
        }
        return crossings / audioData.length;
    }

    /**
     * Handle voice start
     */
    handleVoiceStart() {
        this.isVoiceActive = true;
        this.isListening = true;
        this.voiceStartTime = Date.now();
        
        // Smart buffering: Include pre-speech context for natural start
        this.speechBuffer.reset();
        
        // Add recent VAD buffer content as pre-speech context (last 300ms)
        const preSpeechSamples = Math.min(4800, this.vadBuffer.count); // 300ms at 16kHz
        if (preSpeechSamples > 0) {
            const preSpeechData = this.vadBuffer.readLast(preSpeechSamples);
            this.speechBuffer.push(preSpeechData);
            console.log(`[Voice Start] Added ${preSpeechSamples} pre-speech samples (${(preSpeechSamples/16000*1000).toFixed(0)}ms)`);
        }
        
        console.log("[Voice Start] Beginning speech capture with smart buffering");
        
        if (this.onVoiceStateChange) {
            this.onVoiceStateChange({
                isActive: true,
                timestamp: this.voiceStartTime,
                energy: this.lastRMS,
                preSpeechSamples: preSpeechSamples
            });
        }
    }

    /**
     * Handle voice end
     */
    async handleVoiceEnd() {
        // Add small post-speech buffer for natural ending (100ms)
        const postSpeechDelay = 100;
        
        setTimeout(async () => {
            const speechDuration = Date.now() - this.voiceStartTime;
            
            // Add recent VAD buffer as post-speech context (200ms for natural ending)
            const postSpeechSamples = Math.min(3200, this.vadBuffer.count); // 200ms
            if (postSpeechSamples > 0) {
                const postSpeechData = this.vadBuffer.readLast(postSpeechSamples);
                this.speechBuffer.push(postSpeechData);
                console.log(`[Voice End] Added ${postSpeechSamples} post-speech samples (${(postSpeechSamples/16000*1000).toFixed(0)}ms)`);
            }
            
            console.log(`[Voice End] Speech duration: ${speechDuration}ms, Buffer: ${this.speechBuffer.count} samples`);
            
            // Send speech to API if we have enough audio
            if (this.speechBuffer.count >= this.MIN_SPEECH_DURATION) {
                const timeSinceLastSend = this.lastApiCall === 0 ? 1000 : Date.now() - this.lastApiCall;
                if (timeSinceLastSend > 500) { // Prevent duplicate sends within 500ms
                    await this.sendSpeechToAPI(true); // Mark as final
                } else {
                    console.log("[Voice End] Speech already sent recently, skipping");
                    this.speechBuffer.reset();
                }
            } else {
                console.log("[Voice End] Speech too short, discarding");
                this.speechBuffer.reset();
            }
            
            if (this.onVoiceStateChange) {
                this.onVoiceStateChange({
                    isActive: false,
                    timestamp: Date.now(),
                    duration: speechDuration,
                    audioLength: this.speechBuffer.count,
                    postSpeechSamples: postSpeechSamples
                });
            }
        }, postSpeechDelay);
    }

    /**
     * Check if speech buffer needs to be sent (max duration reached)
     */
    async checkSpeechBufferLimits() {
        const speechDuration = Date.now() - this.voiceStartTime;
        const bufferSize = this.speechBuffer.count;
        const maxDurationMs = this.MAX_SPEECH_DURATION / 16000 * 1000;
        
        // Send if max duration reached or buffer is 85% full
        if (speechDuration >= maxDurationMs || bufferSize >= this.speechBuffer.capacity * 0.85) {
            
            console.log(`[Buffer Limit] Sending speech chunk (${(speechDuration/1000).toFixed(1)}s / ${(maxDurationMs/1000).toFixed(1)}s max, ${bufferSize} samples)`);
            await this.sendSpeechToAPI(false); // Not final
            
            // Keep overlap for continuity
            const overlapSize = Math.min(8000, bufferSize * 0.15); // 500ms overlap
            const overlapData = this.speechBuffer.readLast(overlapSize);
            this.speechBuffer.reset();
            if (overlapData.length > 0) {
                this.speechBuffer.push(overlapData);
                console.log(`[Buffer Limit] Kept ${overlapSize} samples (${(overlapSize/16000*1000).toFixed(0)}ms) for continuity`);
            }
        }
    }

    /**
     * Send complete speech to API
     */
    async sendSpeechToAPI(isFinal = true) {
        try {
            const speechData = this.speechBuffer.readAll();
            if (speechData.length === 0) return null;

            // Convert to Int16Array for API
            const int16Data = new Int16Array(speechData.length);
            for (let i = 0; i < speechData.length; i++) {
                const scaled = Math.max(-1, Math.min(1, speechData[i])) * 32767;
                int16Data[i] = Math.max(-32768, Math.min(32767, scaled));
            }

            const speechPacket = {
                audioData: Array.from(int16Data),
                timestamp: Date.now(),
                duration: Date.now() - this.voiceStartTime,
                isFinal: isFinal,
                sampleRate: 16000,
                channels: 1
            };

            console.log(`[API Call] Sending speech: ${speechData.length} samples (${(speechData.length/16000).toFixed(2)}s)`);
            
            this.apiCalls++;
            this.lastApiCall = Date.now();

            if (this.onSpeechReady) {
                await this.onSpeechReady(speechPacket);
            }

            // Reset buffer after sending if final
            if (isFinal) {
                this.speechBuffer.reset();
            }

            return speechPacket;

        } catch (error) {
            console.error("Failed to send speech to API:", error);
            throw error;
        }
    }

    /**
     * Convert base64 to Float32Array
     */
    base64ToFloat32Array(base64String) {
        try {
            // Remove MIME header if present
            const pureBase64 = base64String.includes(',') ? base64String.split(',')[1] : base64String;

            // Decode Base64
            const binary = atob(pureBase64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            // Convert to Float32Array with little-endian parsing
            const view = new DataView(bytes.buffer);
            const floats = new Float32Array(bytes.length / 4);
            for (let i = 0; i < floats.length; i++) {
                floats[i] = view.getFloat32(i * 4, true); // true = little-endian
            }
            return floats;
        } catch (error) {
            console.error("Base64 to Float32Array conversion failed:", error);
            return new Float32Array(0);
        }
    }

    /**
     * Set callbacks
     */
    setCallbacks(callbacks) {
        this.onSpeechReady = callbacks.onSpeechReady || null;
        this.onVoiceStateChange = callbacks.onVoiceStateChange || null;
        this.onConversationUpdate = callbacks.onConversationUpdate || null;
    }

    /**
     * Set conversation active state
     */
    setConversationActive(active) {
        if (this.conversationActive !== active) {
            this.conversationActive = active;
            console.log(`[Conversation] ${active ? 'Started' : 'Ended'}`);
            
            if (this.onConversationUpdate) {
                this.onConversationUpdate(active);
            }
        }
    }

    /**
     * Reset processor
     */
    reset() {
        this.speechBuffer.reset();
        this.vadBuffer.reset();
        this.isVoiceActive = false;
        this.isListening = false;
        this.isProcessing = false;
        this.consecutiveVoiceFrames = 0;
        this.consecutiveSilenceFrames = 0;
        
        console.log("[Reset] Processor state cleared");
    }

    /**
     * Get current state
     */
    getState() {
        return {
            isVoiceActive: this.isVoiceActive,
            isListening: this.isListening,
            isProcessing: this.isProcessing,
            speechBufferSize: this.speechBuffer.count,
            energy: this.lastRMS,
            efficiency: {
                totalChunks: this.totalChunks,
                apiCalls: this.apiCalls,
                efficiency: this.totalChunks > 0 ? ((1 - this.apiCalls / this.totalChunks) * 100).toFixed(1) : 0
            }
        };
    }
}



    // ============================================================================
    // services/api-service.js
    // ============================================================================

/**
 * API Service
 * Handles communication with Gemini API for speech processing
 * Based on working test-real-api.html implementation
 */

class ApiService {
    constructor(config = {}) {
        this.baseUrl = 'https://directaudiotopwm-qveg3gkwxa-ew.a.run.app';
        
        // Conversation state
        this.conversationState = {
            history: [],
            currentPwm: 0, // Motor starts at 100
            isProcessing: false,
            lastResponse: 0,
            totalApiCalls: 0,
            totalProcessingTime: 0
        };
        
        // Callbacks
        this.onResponse = null;
        this.onError = null;
        this.onProcessingStateChange = null;
    }

    /**
     * Process complete speech segment (main API method)
     */
    async processSpeechSegment(speechPacket, options = {}) {
        if (this.conversationState.isProcessing) {
            console.warn("[API] Already processing speech, queuing...");
        }

        try {
            this.conversationState.isProcessing = true;
            this.conversationState.totalApiCalls++;
            const startTime = Date.now();
            
            if (this.onProcessingStateChange) {
                this.onProcessingStateChange(true);
            }

            console.log(`[API Call ${this.conversationState.totalApiCalls}] Processing speech segment: ${speechPacket.audioData.length} samples`);

            // Prepare request body (matches working implementation)
            const requestBody = {
                msgHis: this.conversationState.history,
                audioData: speechPacket.audioData, // Int16Array format
                currentPwm: this.conversationState.currentPwm
            };

            console.log(`[API] Request payload size: ${JSON.stringify(requestBody).length} bytes`);
            console.log(`[API] Request structure: msgHis=${requestBody.msgHis.length}, audioData=${requestBody.audioData.length}, currentPwm=${requestBody.currentPwm}`);

            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Processing-Mode': 'standard',
                    'X-Speech-Duration': speechPacket.duration?.toString() || '0'
                },
                body: JSON.stringify(requestBody)
            });

            console.log(`[API] Response Status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API error ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            const processingTime = Date.now() - startTime;
            this.conversationState.totalProcessingTime += processingTime;

            console.log(`[API Response] Processed in ${processingTime}ms`);
            console.log(`[API Response] Full response:`, result);
            console.log(`[API Response] Transcription: "${result.transcription || 'N/A'}"`);
            console.log(`[API Response] Assistant Response: "${result.response || 'N/A'}"`);
            console.log(`[API Response] PWM: ${result.previousPwm || this.conversationState.currentPwm} → ${result.newPwmValue || this.conversationState.currentPwm}`);
            console.log(`[API Response] Intent detected: ${result.intentDetected || false}`);
            console.log(`[API Response] Confidence: ${result.confidence ? (result.confidence * 100).toFixed(1) + '%' : 'N/A'}`);
            console.log(`[API Response] Detected language: ${result.detectedLanguage || 'N/A'}`);

            // Update conversation state
            await this.updateConversationState(result);

            // Notify callback
            if (this.onResponse) {
                this.onResponse({
                    ...result,
                    processingTime: processingTime,
                    apiCallNumber: this.conversationState.totalApiCalls
                });
            }

            return result;

        } catch (error) {
            console.error('Speech processing API error:', error);
            
            if (this.onError) {
                this.onError({
                    error: error,
                    apiCallNumber: this.conversationState.totalApiCalls,
                    timestamp: Date.now()
                });
            }
            
            throw error;
            
        } finally {
            this.conversationState.isProcessing = false;
            
            if (this.onProcessingStateChange) {
                this.onProcessingStateChange(false);
            }
        }
    }

    /**
     * Update conversation state with API response
     */
    async updateConversationState(result) {
        try {
            // Update PWM if provided
            if (result.newPwmValue !== undefined) {
                this.conversationState.currentPwm = result.newPwmValue;
                console.log(`[Conversation] PWM updated: ${result.previousPwm || 'unknown'} → ${result.newPwmValue}`);
            }

            // Add to conversation history
            if (result.transcription || result.response) {
                const historyEntry = {
                    user: result.transcription || 'No transcription',
                    assistant: result.response || 'No response',
                    timestamp: new Date().toISOString(),
                    pwm: result.newPwmValue || this.conversationState.currentPwm,
                    intentDetected: result.intentDetected || false,
                    confidence: result.confidence || 0,
                    detectedLanguage: result.detectedLanguage || 'unknown'
                };

                this.conversationState.history.push(historyEntry);

                // Keep only last 10 messages for context
                if (this.conversationState.history.length > 10) {
                    this.conversationState.history.splice(0, this.conversationState.history.length - 10);
                }

                console.log(`[Conversation] History updated: ${this.conversationState.history.length} messages`);
            }

        } catch (error) {
            console.error('Failed to update conversation state:', error);
        }
    }

    /**
     * Test API connectivity
     */
    async testConnectivity() {
        try {
            console.log('[API] Testing connectivity...');
            
            // Simple test with minimal audio data
            const testAudio = new Array(1600).fill(0); // 100ms of silence
            
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    msgHis: [],
                    audioData: testAudio,
                    currentPwm: 0
                })
            });

            if (response.ok) {
                console.log('[API] ✅ Connectivity test passed');
                return { success: true, status: response.status };
            } else {
                console.log(`[API] ❌ Connectivity test failed: ${response.status}`);
                return { success: false, status: response.status, error: response.statusText };
            }

        } catch (error) {
            console.error('[API] ❌ Connectivity test error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get current conversation state
     */
    getState() {
        return {
            ...this.conversationState,
            averageResponseTime: this.conversationState.totalApiCalls > 0 
                ? this.conversationState.totalProcessingTime / this.conversationState.totalApiCalls 
                : 0
        };
    }

    /**
     * Get conversation history
     */
    getHistory() {
        return [...this.conversationState.history];
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationState.history = [];
        console.log('[Conversation] History cleared');
    }

    /**
     * Set current PWM value
     */
    setCurrentPwm(pwm) {
        this.conversationState.currentPwm = Math.max(0, Math.min(255, pwm));
        console.log(`[Conversation] PWM set to: ${this.conversationState.currentPwm}`);
    }

    /**
     * Get current PWM value
     */
    getCurrentPwm() {
        return this.conversationState.currentPwm;
    }

    /**
     * Set callbacks for events
     */
    setCallbacks(callbacks) {
        this.onResponse = callbacks.onResponse || null;
        this.onError = callbacks.onError || null;
        this.onProcessingStateChange = callbacks.onProcessingStateChange || null;
    }

    /**
     * Reset API service state
     */
    reset() {
        this.conversationState.history = [];
        this.conversationState.currentPwm = 0;
        this.conversationState.isProcessing = false;
        this.conversationState.totalApiCalls = 0;
        this.conversationState.totalProcessingTime = 0;
        
        console.log("[API Service] State reset");
    }

    /**
     * Get API statistics
     */
    getStats() {
        return {
            totalApiCalls: this.conversationState.totalApiCalls,
            totalProcessingTime: this.conversationState.totalProcessingTime,
            averageResponseTime: this.conversationState.totalApiCalls > 0 
                ? (this.conversationState.totalProcessingTime / this.conversationState.totalApiCalls).toFixed(0) + 'ms'
                : '0ms',
            conversationLength: this.conversationState.history.length,
            currentPwm: this.conversationState.currentPwm,
            isProcessing: this.conversationState.isProcessing
        };
    }
}



    // ============================================================================
    // services/consent-service.js
    // ============================================================================

/**
 * Consent Service - User consent and privacy management
 * Handles consent collection, storage, and device fingerprinting
 */

class ConsentService {
    constructor() {
        this.apiUrl = 'https://storeuserconsent-qveg3gkwxa-ew.a.run.app';
        this.storageKeys = {
            deviceId: 'dulaan_device_id',
            consent: 'dulaan_consent_given',
            timestamp: 'dulaan_consent_timestamp'
        };
    }

    /**
     * Generate device fingerprint using ThumbmarkJS
     */
    async generateDeviceId() {
        try {
            // Check if ThumbmarkJS is available
            if (typeof ThumbmarkJS === 'undefined') {
                console.warn('ThumbmarkJS not available, falling back to basic fingerprint');
                return this.generateBasicFingerprint();
            }

            // Use ThumbmarkJS for advanced fingerprinting
            const tm = new ThumbmarkJS.Thumbmark({
                exclude: ['permissions'], // Exclude permissions for faster generation
                timeout: 3000,
                logging: false
            });
            
            const result = await tm.get();
            return result.thumbmark;
        } catch (error) {
            console.error('Error generating device ID:', error);
            // Ultimate fallback
            return 'fallback_' + Date.now() + '_' + Math.random().toString(36).substring(2);
        }
    }

    /**
     * Generate basic fingerprint as fallback
     */
    generateBasicFingerprint() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Device fingerprint', 2, 2);
        const canvasFingerprint = canvas.toDataURL();
        
        const basicFingerprint = {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            screen: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            canvas: canvasFingerprint.slice(-50) // Last 50 chars
        };
        
        // Create a simple hash
        const fingerprintString = JSON.stringify(basicFingerprint);
        let hash = 0;
        for (let i = 0; i < fingerprintString.length; i++) {
            const char = fingerprintString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }

    /**
     * Get or create cached device ID
     */
    async getDeviceId() {
        try {
            // Check if we have a cached device ID
            let deviceId = localStorage.getItem(this.storageKeys.deviceId);
            
            if (!deviceId) {
                // Generate new device ID
                deviceId = await this.generateDeviceId();
                localStorage.setItem(this.storageKeys.deviceId, deviceId);
                console.log('Generated new device ID:', deviceId);
            }
            
            return deviceId;
        } catch (error) {
            console.error('Error getting device ID:', error);
            return 'error_' + Date.now();
        }
    }

    /**
     * Collect and store user consent
     */
    async collectUserConsent(consentData) {
        try {
            const deviceId = await this.getDeviceId();
            
            // Format payload to match server expectations
            const consentPayload = {
                deviceId: deviceId,
                consent: consentData, // Nest consent data under 'consent' property
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                consentSource: 'web',
                consentVersion: '1.0'
            };

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(consentPayload)
            });

            if (!response.ok) {
                // Try to get error details from response
                let errorDetails = `HTTP ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorDetails = errorData.error || errorData.message || errorDetails;
                } catch (e) {
                    // If we can't parse the error response, use the status
                }
                throw new Error(`Consent storage failed: ${errorDetails}`);
            }

            const result = await response.json();
            console.log('User consent stored successfully:', result);
            
            // Cache consent locally
            this.cacheConsent(consentData);
            
            return result;
        } catch (error) {
            console.error('Error collecting user consent:', error);
            throw error;
        }
    }

    /**
     * Cache consent data locally
     */
    cacheConsent(consentData) {
        try {
            localStorage.setItem(this.storageKeys.consent, JSON.stringify(consentData));
            localStorage.setItem(this.storageKeys.timestamp, new Date().toISOString());
        } catch (error) {
            console.error('Error caching consent:', error);
        }
    }

    /**
     * Get cached consent data
     */
    getCachedConsent() {
        try {
            const consentData = localStorage.getItem(this.storageKeys.consent);
            const timestamp = localStorage.getItem(this.storageKeys.timestamp);
            
            if (consentData && timestamp) {
                return {
                    consent: JSON.parse(consentData),
                    timestamp: timestamp,
                    deviceId: localStorage.getItem(this.storageKeys.deviceId)
                };
            }
            
            return null;
        } catch (error) {
            console.error('Error getting cached consent:', error);
            return null;
        }
    }

    /**
     * Check if user has given consent
     */
    hasConsent(consentType = 'dataProcessing') {
        const cached = this.getCachedConsent();
        return cached && cached.consent && cached.consent[consentType] === true;
    }

    /**
     * Revoke consent
     */
    async revokeConsent() {
        try {
            const revokeData = {
                dataProcessing: false,
                analytics: false,
                remoteControl: false,
                consentGiven: false,
                revoked: true
            };

            const result = await this.collectUserConsent(revokeData);
            
            // Clear local cache
            this.clearConsentCache();
            
            return result;
        } catch (error) {
            console.error('Error revoking consent:', error);
            throw error;
        }
    }

    /**
     * Clear consent cache
     */
    clearConsentCache() {
        try {
            localStorage.removeItem(this.storageKeys.consent);
            localStorage.removeItem(this.storageKeys.timestamp);
        } catch (error) {
            console.error('Error clearing consent cache:', error);
        }
    }

    /**
     * Clear device ID (will regenerate on next use)
     */
    clearDeviceId() {
        try {
            localStorage.removeItem(this.storageKeys.deviceId);
        } catch (error) {
            console.error('Error clearing device ID:', error);
        }
    }

    /**
     * Update API endpoint
     */
    updateApiUrl(newUrl) {
        this.apiUrl = newUrl;
    }

    /**
     * Get consent summary
     */
    getConsentSummary() {
        const cached = this.getCachedConsent();
        
        return {
            hasConsent: !!cached,
            deviceId: cached?.deviceId || null,
            timestamp: cached?.timestamp || null,
            consent: cached?.consent || {},
            isExpired: cached ? this.isConsentExpired(cached.timestamp) : false
        };
    }

    /**
     * Check if consent is expired (optional feature)
     */
    isConsentExpired(timestamp, expiryDays = 365) {
        try {
            const consentDate = new Date(timestamp);
            const expiryDate = new Date(consentDate.getTime() + (expiryDays * 24 * 60 * 60 * 1000));
            return new Date() > expiryDate;
        } catch (error) {
            return true; // Consider expired if we can't parse
        }
    }
}

// Create singleton instance
const consentService = new ConsentService();

// Export both class and instance
// Global access
if (typeof window !== 'undefined') {
    window.consentService = consentService;
}

    // ============================================================================
    // services/remote-service.js
    // ============================================================================

/**
 * Remote Service - PeerJS remote control system
 * Handles peer-to-peer communication for remote motor control
 */

class RemoteService {
    constructor() {
        this.peer = null;
        this.connections = new Map();
        this.remoteUsers = new Set();
        
        // State
        this.isHost = false;
        this.isRemote = false;
        this.isControlledByRemote = false;
        this.hostId = null;
        this.lastRemoteCommand = null;
        
        // PeerJS configuration
        this.peerConfig = {
            host: '34.38.33.102',
            port: 9000,
            path: '/',
            secure: false,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        };
        
        // Event callbacks
        this.onHostReady = null;
        this.onRemoteConnected = null;
        this.onRemoteDisconnected = null;
        this.onRemoteCommand = null;
        this.onConnectionStatusChange = null;
    }

    /**
     * Initialize as host (device owner)
     */
    initializeAsHost() {
        if (this.peer) {
            this.peer.destroy();
        }

        // Generate unique 6-character host ID
        const hostId = this.generateShortId();
        
        this.peer = new Peer(hostId, this.peerConfig);

        this.peer.on('open', (id) => {
            this.isHost = true;
            this.hostId = id;
            console.log('Host initialized with ID:', id);
            
            if (this.onHostReady) {
                this.onHostReady(id);
            }
        });

        this.peer.on('connection', (conn) => {
            console.log('Remote user connected:', conn.peer);
            this.connections.set(conn.peer, conn);
            this.remoteUsers.add(conn.peer);
            this.isControlledByRemote = true;

            conn.on('data', (data) => {
                this.handleRemoteCommand(data, conn.peer);
            });

            conn.on('close', () => {
                console.log('Remote user disconnected:', conn.peer);
                this.connections.delete(conn.peer);
                this.remoteUsers.delete(conn.peer);
                
                if (this.remoteUsers.size === 0) {
                    this.isControlledByRemote = false;
                }
                
                if (this.onRemoteDisconnected) {
                    this.onRemoteDisconnected(conn.peer);
                }
            });

            if (this.onRemoteConnected) {
                this.onRemoteConnected(conn.peer);
            }
        });

        this.peer.on('error', (error) => {
            console.error('Host peer error:', error);
        });

        return hostId;
    }

    /**
     * Connect as remote user to control a host
     */
    connectAsRemote(hostId) {
        this.peer = new Peer(this.peerConfig);

        this.peer.on('open', (id) => {
            console.log(`Remote peer initialized with ID: ${id}`);
            
            const conn = this.peer.connect(hostId);
            
            conn.on('open', () => {
                this.isRemote = true;
                this.hostId = hostId;
                this.connections.set(hostId, conn);
                console.log(`Connected to host: ${hostId}`);
                
                if (this.onConnectionStatusChange) {
                    this.onConnectionStatusChange(true);
                }
            });

            conn.on('error', (error) => {
                console.log(`Failed to connect to host: ${error.message}`);
                if (this.onConnectionStatusChange) {
                    this.onConnectionStatusChange(false, error.message);
                }
            });

            conn.on('close', () => {
                console.log('Disconnected from host');
                this.isRemote = false;
                this.hostId = null;
                this.connections.delete(hostId);
                this.onConnectionDrop()
                if (this.onConnectionStatusChange) {
                    this.onConnectionStatusChange(false);
                }
            });
        });

        this.peer.on('error', (error) => {
            console.error('Remote peer error:', error);
            if (this.onConnectionStatusChange) {
                this.onConnectionStatusChange(false, error.message);
            }
        });
    }

    /**
     * Send control command to host (when acting as remote)
     */
    sendControlCommand(mode, value, additionalData = {}) {
        if (!this.isRemote || !this.hostId) {
            console.warn('[REMOTE] Not connected as remote user');
            return false;
        }

        // Validate motor commands
        if (mode === 'motor') {
            const pwm = Math.max(0, Math.min(255, Math.round(value)));
            if (pwm !== value) {
                console.log(`[REMOTE] Motor PWM value adjusted: ${value} → ${pwm}`);
                value = pwm;
            }
        }

        const command = {
            type: 'control_command',
            mode: mode,
            value: value,
            timestamp: Date.now(),
            ...additionalData
        };

        const conn = this.connections.get(this.hostId);
        if (conn && conn.open) {
            try {
                conn.send(command);
                console.log(`[REMOTE] ✅ Sent control command: ${mode} = ${value}`);
                return true;
            } catch (error) {
                console.error('[REMOTE] ❌ Failed to send command:', error);
                return false;
            }
        } else {
            console.warn('[REMOTE] ❌ No active connection to host');
            return false;
        }
    }

    /**
     * Handle incoming remote command (when acting as host)
     */
    handleRemoteCommand(data, fromUserId) {
        if (!this.isHost) {
            return;
        }

        console.log(`Received remote command from ${fromUserId}: ${data.mode} = ${data.value}`);
        this.lastRemoteCommand = {
            ...data,
            fromUser: fromUserId,
            receivedAt: Date.now()
        };

        if (this.onRemoteCommand) {
            this.onRemoteCommand(data, fromUserId);
        }
    }

    /**
     * Disconnect from remote control
     */
    disconnect() {
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }

        this.isHost = false;
        this.isRemote = false;
        this.hostId = null;
        this.connections.clear();
        this.remoteUsers.clear();
        this.isControlledByRemote = false;
        this.lastRemoteCommand = null;

        console.log('Disconnected from remote control');
        
        if (this.onConnectionStatusChange) {
            this.onConnectionStatusChange(false);
        }
    }

    /**
     * Get current connection status
     */
    getStatus() {
        return {
            isHost: this.isHost,
            isRemote: this.isRemote,
            isControlledByRemote: this.isControlledByRemote,
            hostId: this.hostId,
            connectedUsers: Array.from(this.remoteUsers),
            lastRemoteCommand: this.lastRemoteCommand
        };
    }

    /**
     * Get list of connected remote users (when host)
     */
    getConnectedUsers() {
        return Array.from(this.remoteUsers);
    }

    /**
     * Check if currently controlled by remote
     */
    isUnderRemoteControl() {
        return this.isControlledByRemote;
    }

    /**
     * Set event callbacks
     */
    setEventCallbacks(callbacks) {
        this.onHostReady = callbacks.onHostReady || null;
        this.onRemoteConnected = callbacks.onRemoteConnected || null;
        this.onRemoteDisconnected = callbacks.onRemoteDisconnected || null;
        this.onRemoteCommand = callbacks.onRemoteCommand || null;
        this.onConnectionDrop = callbacks.onConnectionDrop|| null;
    }

    /**
     * Update PeerJS configuration
     */
    updatePeerConfig(newConfig) {
        this.peerConfig = { ...this.peerConfig, ...newConfig };
    }

    /**
     * Send heartbeat to maintain connection
     */
    sendHeartbeat() {
        if (this.isRemote && this.hostId) {
            this.sendControlCommand('heartbeat', Date.now());
        }
    }

    /**
     * Start heartbeat interval
     */
    startHeartbeat(intervalMs = 30000) {
        this.stopHeartbeat(); // Clear any existing interval
        
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, intervalMs);
    }

    /**
     * Stop heartbeat interval
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Generate a short 6-character unique ID for peer connections
     * @returns {string} 6-character alphanumeric ID
     */
    generateShortId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Validate if an ID is in the correct format
     * @param {string} id - ID to validate
     * @returns {boolean} True if valid
     */
    isValidId(id) {
        if (!id || typeof id !== 'string') return false;
        if (id.length !== 6) return false;
        return /^[A-Z0-9]+$/.test(id);
    }
}

// Create singleton instance
const remoteService = new RemoteService();

// Export both class and instance
// Global access
if (typeof window !== 'undefined') {
    window.remoteService = remoteService;
    

}

    // ============================================================================
    // services/motor-pattern-library.js
    // ============================================================================

/**
 * Motor Pattern Library Service - Pattern storage and management
 * Handles pattern storage, validation, and retrieval (playback handled by pattern-control.js)
 */

class MotorPatternLibrary {
    constructor() {
        // Pattern library
        this.patterns = { ...MOTOR_PATTERN_LIBRARY };
        this.categories = { ...PATTERN_CATEGORIES };
    }

    /**
     * Get all available patterns
     */
    getAllPatterns() {
        return Object.values(this.patterns);
    }

    /**
     * Get patterns by category
     */
    getPatternsByCategory(category) {
        return Object.values(this.patterns).filter(pattern => pattern.category === category);
    }

    /**
     * Get pattern by ID
     */
    getPattern(id) {
        return this.patterns[id] || null;
    }

    /**
     * Add custom pattern to library
     */
    addPattern(pattern) {
        const validation = PatternUtils.validatePattern(pattern);
        if (!validation.valid) {
            throw new Error(`Invalid pattern: ${validation.errors.join(', ')}`);
        }

        this.patterns[pattern.id] = { ...pattern };
        console.log(`[Pattern Library] Added custom pattern: ${pattern.name}`);
        return true;
    }

    /**
     * Remove pattern from library
     */
    removePattern(id) {
        if (this.patterns[id]) {
            delete this.patterns[id];
            console.log(`[Pattern Library] Removed pattern: ${id}`);
            return true;
        }
        return false;
    }

    /**
     * Get pattern library statistics
     */
    getLibraryStats() {
        const patterns = Object.values(this.patterns);
        const categories = {};

        patterns.forEach(pattern => {
            if (!categories[pattern.category]) {
                categories[pattern.category] = 0;
            }
            categories[pattern.category]++;
        });

        return {
            totalPatterns: patterns.length,
            categories: categories
        };
    }
}

// Create singleton instance
const motorPatternLibrary = new MotorPatternLibrary();

// Export both class and instance
// Global access
if (typeof window !== 'undefined') {
    window.motorPatternLibrary = motorPatternLibrary;
}

    // ============================================================================
    // modes/ai-voice-control.js
    // ============================================================================

/**
 * AI Voice Control Mode
 * Natural conversation with motor control via voice commands
 * Based on working test-real-api.html implementation
 */

class AIVoiceControl {
    constructor(config = {}) {
        this.config = {
            // Response timeout
            responseTimeout: 3000,
            
            // Motor control optimization
            pwmUpdateThreshold: 5, // Only update if PWM changes by 5+
            motorResponseDelay: 100, // 100ms delay for motor commands
            
            ...config
        };

        // Core components (use shared instances if provided, fallback to creating new ones)
        this.processor = config.processor || 
                        (typeof StreamingProcessor !== 'undefined' ? new StreamingProcessor() : null);
        this.apiService = config.apiService || 
                         (typeof ApiService !== 'undefined' ? new ApiService() : null);
        
        if (!this.processor) {
            throw new Error('StreamingProcessor not available');
        }
        if (!this.apiService) {
            throw new Error('ApiService not available');
        }
        
        this.motorController = config.motorController || null;
        
        // State management
        this.state = {
            isActive: false,
            isListening: false,
            isProcessing: false,
            conversationActive: false,
            currentPwm: 0, // Motor starts stopped
            lastInteractionTime: 0,
            lastResponse: null,
            lastError: null,
            totalApiCalls: 0,
            totalProcessingTime: 0
        };
        
        // Setup callbacks
        this.setupCallbacks();
    }

    /**
     * Setup callbacks for processor and API service
     */
    setupCallbacks() {
        // Processor callbacks
        this.processor.setCallbacks({
            onSpeechReady: (speechPacket) => {
                this.handleSpeechReady(speechPacket);
            },
            onVoiceStateChange: (voiceState) => {
                this.handleVoiceStateChange(voiceState);
            },
            onConversationUpdate: (active) => {
                this.handleConversationUpdate(active);
            }
        });

        // API service callbacks
        this.apiService.setCallbacks({
            onResponse: (response) => {
                this.handleApiResponse(response);
            },
            onError: (error) => {
                this.handleApiError(error);
            },
            onProcessingStateChange: (processing) => {
                this.state.isProcessing = processing;
            }
        });
    }

    /**
     * Start AI voice control
     */
    async start() {
        try {
            console.log("[AI Voice] Starting natural conversation mode");
            
            this.state.isActive = true;
            this.state.lastInteractionTime = Date.now();
            this.state.totalApiCalls = 0;
            
            // Initialize motor to stopped state (PWM 0)
            if (this.motorController) {
                await this.updateMotorPWM(0);
                console.log("[AI Voice] Motor initialized to stopped state (PWM 0)");
            }
            
            // Start audio processing
            await this.startAudioProcessing();
            
            // Activate conversation mode
            this.handleConversationUpdate(true);
            
            console.log("🎤 Natural conversation started - speak naturally!");
            
            return true;
            
        } catch (error) {
            console.error("Failed to start AI voice control:", error);
            return false;
        }
    }

    /**
     * Stop voice control
     */
    async stop() {
        console.log("[AI Voice] Stopping conversation mode");
        
        this.state.isActive = false;
        this.state.isListening = false;
        this.state.conversationActive = false;
        
        // Stop audio processing
        await this.stopAudioProcessing();
        await this.motorController.write(0);
        
        console.log("🔇 Voice control stopped");
    }

    /**
     * Start audio processing using Capacitor VoiceRecorder
     */
    async startAudioProcessing() {
        try {
            console.log("[Audio] Starting audio processing");
            
            // Check if Capacitor is available
            if (!window.Capacitor?.Plugins?.VoiceRecorder) {
                throw new Error('Capacitor VoiceRecorder plugin not available');
            }

            // Request permission
            const permission = await window.Capacitor.Plugins.VoiceRecorder.requestAudioRecordingPermission();
            if (!permission.value) {
                throw new Error('Audio recording permission denied');
            }

            // Remove any existing listeners
            await window.Capacitor.Plugins.VoiceRecorder.removeAllListeners();
            
            // Add streaming listener for real-time audio chunks
            window.Capacitor.Plugins.VoiceRecorder.addListener('audioChunk', (data) => {
                this.processAudioChunk(data.chunk);
            });

            // Start audio streaming
            await window.Capacitor.Plugins.VoiceRecorder.startStreaming();
            
            console.log("[Audio] Capacitor audio streaming started");
            return true;
            
        } catch (error) {
            console.error("[Audio] Failed to start audio processing:", error);
            throw error;
        }
    }

    /**
     * Stop audio processing
     */
    async stopAudioProcessing() {
        try {
            console.log("[Audio] Stopping audio processing");
            
            // Check if Capacitor is available
            if (window.Capacitor?.Plugins?.VoiceRecorder) {
                // Stop streaming
                await window.Capacitor.Plugins.VoiceRecorder.stopStreaming();
                
                // Remove listeners
                await window.Capacitor.Plugins.VoiceRecorder.removeAllListeners();
            }
            
            console.log("[Audio] Audio processing stopped");
            
        } catch (error) {
            console.error("[Audio] Error stopping audio processing:", error);
        }
    }

    /**
     * Process incoming audio chunk from Capacitor VoiceRecorder
     */
    processAudioChunk(base64Chunk) {
        // Only check if active (removed isListening check to fix chicken-and-egg problem)
        if (!this.state.isActive) {
            return;
        }

        try {
            // Process audio chunk through processor
            const result = this.processor.processAudioChunk(base64Chunk);
            
            if (result) {
                // Update state with voice activity
                this.state.lastInteractionTime = Date.now();
                
                // Log voice activity for debugging
                
                // Update listening state based on voice activity
                if (result.isVoiceActive !== this.state.isListening) {
                    this.state.isListening = result.isVoiceActive;
                    console.log(`[VAD] Listening state changed: ${this.state.isListening}`);
                }
                
            } else {
                console.log(`[AUDIO CHUNK] No result from processor`);
            }
            
        } catch (error) {
            console.error("[Audio] Error processing audio chunk:", error);
        }
    }

    /**
     * Handle speech ready for API processing
     */
    async handleSpeechReady(speechPacket) {
        try {
            console.log(`[Speech] Processing speech packet: ${speechPacket.audioData.length} samples`);
            
            this.state.isProcessing = true;
            this.state.totalApiCalls++;
            
            const startTime = Date.now();
            
            console.log(`[Speech Processing] Processing command`);
            
            const response = await this.apiService.processSpeechSegment(speechPacket);
            
            const processingTime = Date.now() - startTime;
            this.state.totalProcessingTime += processingTime;
            
            // ===== DETAILED API RESPONSE LOGGING =====
            console.log(`[API RESPONSE] Full response:`, response);
            console.log(`[API RESPONSE] Transcription: "${response?.transcription || 'N/A'}"`);
            console.log(`[API RESPONSE] Assistant Response: "${response?.response || 'N/A'}"`);
            console.log(`[API RESPONSE] New PWM Value: ${response?.newPwmValue || 'N/A'}`);
            console.log(`[API RESPONSE] Processing Time: ${processingTime}ms`);
            
            if (response && response.newPwmValue !== undefined) {
                // Update motor with new PWM value
                console.log(`[MOTOR] Sending PWM ${response.newPwmValue} to motor controller`);
                const motorSuccess = await this.updateMotorPWM(response.newPwmValue);
                console.log(`[MOTOR] Motor update ${motorSuccess ? 'successful' : 'failed'}`);
                
                // Store the last response
                this.state.lastResponse = response;
                
                console.log(`[PROCESSING COMPLETE] Speech processed successfully`);
            } else {
                console.warn(`[API WARNING] No PWM value in response or response is null`);
            }
            
            // ===== RESET STATE FOR NEXT INTERACTION =====
            this.state.lastInteractionTime = Date.now();
            console.log(`[CONVERSATION] Updated interaction time, ready for next command`);
            
            // CRITICAL FIX: Reset processor state to ensure it can detect next speech
            console.log(`[RESET] Resetting processor state for next interaction`);
            this.processor.isVoiceActive = false;
            this.processor.isListening = false;
            this.processor.consecutiveVoiceFrames = 0;
            this.processor.consecutiveSilenceFrames = 0;
            
            // Ensure conversation stays active for next command
            this.handleConversationUpdate(true);
            
        } catch (error) {
            console.error("Speech processing failed:", error);
            this.handleApiError(error);
        } finally {
            this.state.isProcessing = false;
        }
    }

    /**
     * Handle voice state changes
     */
    handleVoiceStateChange(voiceState) {
        this.state.isListening = voiceState.isActive;
        this.state.lastInteractionTime = Date.now();
        
        if (voiceState.isActive) {
            console.log(`[VOICE STATE] Voice started - listening for speech`);
        } else if (voiceState.duration) {
            const durationMs = voiceState.duration;
            console.log(`[VOICE STATE] Voice ended - speech captured (${(durationMs/1000).toFixed(1)}s)`);
            
            // After speech ends, ensure we're ready for next interaction
            console.log(`[VOICE STATE] Preparing for next voice interaction`);
        }
    }

    /**
     * Handle conversation state updates
     */
    handleConversationUpdate(active) {
        console.log(`[CONVERSATION] State change: ${this.state.conversationActive} → ${active}`);
        this.state.conversationActive = active;
        
        if (active) {
            console.log(`[CONVERSATION] ✅ Activating conversation - ready for next command`);
            this.processor.setConversationActive(true);
            
            // CRITICAL FIX: Reset all processing flags and ensure clean state
            this.state.isProcessing = false;
            this.state.isListening = false;
            
            // Ensure processor is in clean state for next interaction
            if (this.processor) {
                this.processor.isVoiceActive = false;
                this.processor.isListening = false;
                console.log(`[CONVERSATION] Processor state reset for next interaction`);
            }
            
        } else {
            console.log(`[CONVERSATION] ⏸️ Pausing conversation`);
        }
    }

    /**
     * Handle API responses
     */
    handleApiResponse(response) {
        this.state.lastResponse = response;
        this.state.totalApiCalls++;
        
        // Update PWM if changed significantly
        if (response.newPwmValue !== undefined) {
            const pwmDiff = Math.abs(response.newPwmValue - this.state.currentPwm);
            if (pwmDiff >= this.config.pwmUpdateThreshold) {
                this.updateMotorPWM(response.newPwmValue);
            }
        }
        
        // Log response
        if (response.response) {
            console.log(`🤖 ${response.response}`);
        }
    }

    /**
     * Handle API errors
     */
    handleApiError(error) {
        this.state.lastError = error;
        console.error("API Error:", error);
    }

    /**
     * Update motor PWM with optimization
     */
    async updateMotorPWM(newPwm) {
        console.log(`[MOTOR UPDATE] Requested PWM: ${newPwm}, Current PWM: ${this.state.currentPwm}`);
        
        // Only update if change is significant (reduces motor wear)
        const pwmDifference = Math.abs(newPwm - this.state.currentPwm);
        console.log(`[MOTOR UPDATE] PWM difference: ${pwmDifference}, Threshold: ${this.config.pwmUpdateThreshold}`);
        
        if (pwmDifference >= this.config.pwmUpdateThreshold) {
            const oldPwm = this.state.currentPwm;
            this.state.currentPwm = newPwm;
            
            console.log(`[MOTOR UPDATE] PWM changed from ${oldPwm} to ${newPwm}`);
            
            // Send to motor controller if available
            if (this.motorController) {
                console.log(`[MOTOR UPDATE] Motor controller connected, sending PWM command...`);
                try {
                    await this.motorController.write(newPwm);
                    console.log(`[MOTOR UPDATE] ✅ PWM ${newPwm} sent to motor successfully`);
                    
                    // Trigger callbacks
                    if (this.config.onPwmUpdate) {
                        this.config.onPwmUpdate(newPwm);
                    }
                    
                    return true;
                } catch (error) {
                    console.error(`[MOTOR UPDATE] ❌ Failed to send PWM to motor:`, error);
                    return false;
                }
            } else {
                console.warn(`[MOTOR UPDATE] ⚠️ Motor controller not available (connected: ${this.motorController?.isConnected}, exists: ${!!this.motorController})`);
                return false;
            }
        } else {
            console.log(`[MOTOR UPDATE] ⏭️ PWM change too small (${pwmDifference}), skipping update`);
            return true; // Not an error, just skipped
        }
    }



    /**
     * Get efficiency statistics
     */
    getEfficiencyStats() {
        const processorStats = this.processor.getState();
        const apiStats = this.apiService.getStats();
        
        return {
            processor: processorStats,
            api: apiStats,
            overall: {
                totalInteractions: this.state.totalApiCalls,
                averageResponseTime: this.state.totalApiCalls > 0 
                    ? (this.state.totalProcessingTime / this.state.totalApiCalls).toFixed(0) + 'ms'
                    : '0ms'
            }
        };
    }

    /**
     * Get current state
     */
    getState() {
        return {
            ...this.state,
            processor: this.processor.getState(),
            api: this.apiService.getState(),
            efficiency: this.getEfficiencyStats()
        };
    }

    /**
     * Reset state
     */
    reset() {
        this.state.isActive = false;
        this.state.isListening = false;
        this.state.isProcessing = false;
        this.state.conversationActive = false;
        this.state.currentPwm = 0;
        this.state.lastInteractionTime = 0;
        this.state.lastResponse = null;
        this.state.lastError = null;
        this.state.totalApiCalls = 0;
        this.state.totalProcessingTime = 0;
        
        this.processor.reset();
        this.apiService.reset();
        
        console.log("[AI Voice] State reset");
    }
}



    // ============================================================================
    // modes/ambient-control.js
    // ============================================================================

/**
 * Ambient Control Mode
 * Handles ambient sound-based motor control
 */

class AmbientControl {
    constructor(sdk) {
        this.sdk = sdk;
        this.isActive = false;
        this.pwmInterval = null;
        
        // Audio processing state
        this.maxEnergy = 0.075; // Default max energy threshold
        this.audioBuffer = null;
        this.lastRMS = 0;
        this.lastPwmValue = 0;
        
        // Initialize audio buffer (1 second at 16kHz)
        this.initializeAudioBuffer();
    }

    async start() {
        if (this.isActive) {
            console.warn('Ambient Control already active');
            return false;
        }

        try {
            // Request audio recording permission
            const permission = await window.Capacitor.Plugins.VoiceRecorder.requestAudioRecordingPermission();
            if (!permission.value) {
                throw new Error('Audio recording permission denied');
            }

            // Remove any existing listeners
            await window.Capacitor.Plugins.VoiceRecorder.removeAllListeners();
            
            // Add streaming listener for real-time audio chunks
            window.Capacitor.Plugins.VoiceRecorder.addListener('audioChunk', (data) => {
                this.processAmbientAudio(data.chunk);
            });

            // Start audio streaming (not recording)
            await window.Capacitor.Plugins.VoiceRecorder.startStreaming();
            
            this.isActive = true;
            this.startPwmWriting();
            
            console.log('Ambient Control started with streaming');
            return true;
        } catch (error) {
            console.error('Failed to start Ambient Control:', error);
            return false;
        }
    }

    async stop() {
        if (!this.isActive) {
            return;
        }

        try {
            // Remove listeners and stop streaming
            await window.Capacitor.Plugins.VoiceRecorder.removeAllListeners();
            await window.Capacitor.Plugins.VoiceRecorder.stopStreaming();
            
            this.stopPwmWriting();
            this.isActive = false;
            
            // Set motor to 0 when stopping
            await this.sdk.motor.write(0);
            
            console.log('Ambient Control stopped');
        } catch (error) {
            console.error('Error stopping Ambient Control:', error);
        }
    }



    async processAmbientAudio(base64Chunk) {
        try {
            // Process audio chunk locally (no sdk.audio dependency)
            this.processAudioChunk(base64Chunk);
        } catch (error) {
            console.error('Ambient processing error:', error);
        }
    }

    startPwmWriting() {
        // Write PWM every 100ms based on accumulated audio data (matches stream.js)
        this.pwmInterval = setInterval(async () => {
            try {
                const pwmValue = this.calculateAmbientPWM();
                
                if (pwmValue > 0) {
                    await this.sdk.motor.write(pwmValue);
                    this.lastPwmValue = pwmValue;
                    
                    // Trigger event for UI updates
                    this.onAmbientUpdate({
                        energy: this.lastRMS,
                        pwmValue: pwmValue
                    });
                }
            } catch (error) {
                console.error('PWM writing error:', error);
            }
        }, 100); // 100ms interval matches stream.js
    }

    stopPwmWriting() {
        if (this.pwmInterval) {
            clearInterval(this.pwmInterval);
            this.pwmInterval = null;
        }
    }

    onAmbientUpdate(result) {
        // Override this method to handle ambient updates in UI
        if (typeof window !== 'undefined' && window.onAmbientUpdate) {
            window.onAmbientUpdate(result);
        }
    }

    setMaxEnergy(energy) {
        this.maxEnergy = energy;
    }

    getMaxEnergy() {
        return this.maxEnergy;
    }

    isRunning() {
        return this.isActive;
    }

    // ===== MISSING FUNCTIONS IMPLEMENTATION =====

    /**
     * Initialize audio buffer for ambient processing
     */
    initializeAudioBuffer() {
        try {
            // Get RingBuffer class - use global if available (for bundled version)
            const RingBufferClass = (typeof RingBuffer !== 'undefined') ? RingBuffer :
                                    (typeof window !== 'undefined' && window.DULAAN_COMPONENTS && window.DULAAN_COMPONENTS.RingBuffer) ? window.DULAAN_COMPONENTS.RingBuffer :
                                    null;
            
            if (RingBufferClass) {
                // Create buffer for 1 second of audio at 16kHz
                this.audioBuffer = new RingBufferClass(16000);
            } else {
                console.warn('RingBuffer not available for ambient control');
            }
        } catch (error) {
            console.error('Failed to initialize audio buffer:', error);
        }
    }

    /**
     * Process audio chunk for ambient control
     */
    processAudioChunk(base64Chunk) {
        try {
            // Convert base64 to audio data
            const audioData = this.base64ToFloat32Array(base64Chunk);
            
            if (audioData && audioData.length > 0) {
                // Add to buffer
                if (this.audioBuffer) {
                    this.audioBuffer.push(audioData);
                }
                
                // Calculate RMS energy
                this.lastRMS = this.calculateRMS(audioData);
            }
        } catch (error) {
            console.error('Error processing audio chunk:', error);
        }
    }

    /**
     * Calculate ambient PWM value based on current audio energy
     */
    calculateAmbientPWM() {
        try {
            if (this.lastRMS > 0) {
                // Use energyToPWM function from audio-utils
                return this.energyToPWM(this.lastRMS, this.maxEnergy, 255);
            }
            return 0;
        } catch (error) {
            console.error('Error calculating ambient PWM:', error);
            return 0;
        }
    }

    /**
     * Get current audio state
     */
    getAudioState() {
        return {
            lastRMS: this.lastRMS,
            maxEnergy: this.maxEnergy,
            bufferSize: this.audioBuffer ? this.audioBuffer.count : 0,
            lastPwmValue: this.lastPwmValue,
            isActive: this.isActive
        };
    }

    // ===== AUDIO UTILITY FUNCTIONS =====

    /**
     * Convert base64 to Float32Array (local implementation)
     */
    base64ToFloat32Array(base64) {
        try {
            // Use global function if available
            if (typeof base64ToFloat32Array !== 'undefined') {
                return base64ToFloat32Array(base64);
            }
            
            // Fallback implementation
            const pureBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
            const binary = atob(pureBase64);
            const bytes = new Uint8Array(binary.length);
            
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            const view = new DataView(bytes.buffer);
            const floats = new Float32Array(bytes.length / 4);
            
            for (let i = 0; i < floats.length; i++) {
                floats[i] = view.getFloat32(i * 4, true);
            }
            
            return floats;
        } catch (e) {
            console.error("Base64 to Float32Array conversion failed:", e);
            return new Float32Array(0);
        }
    }

    /**
     * Calculate RMS energy (local implementation)
     */
    calculateRMS(audioData) {
        try {
            // Use global function if available
            if (typeof calculateRMS !== 'undefined') {
                return calculateRMS(audioData);
            }
            
            // Fallback implementation
            if (!audioData || audioData.length === 0) return 0;
            
            let sum = 0;
            for (let i = 0; i < audioData.length; i++) {
                sum += audioData[i] * audioData[i];
            }
            
            return Math.sqrt(sum / audioData.length);
        } catch (error) {
            console.error('Error calculating RMS:', error);
            return 0;
        }
    }

    /**
     * Convert energy to PWM value (local implementation)
     */
    energyToPWM(energy, maxEnergy = 0.075, maxPWM = 255) {
        try {
            // Use global function if available
            if (typeof energyToPWM !== 'undefined') {
                return energyToPWM(energy, maxEnergy, maxPWM);
            }
            
            // Fallback implementation
            if (energy <= 0) return 0;
            
            const normalizedEnergy = Math.min(energy / maxEnergy, 1.0);
            const pwmValue = Math.round(normalizedEnergy * maxPWM);
            
            return Math.max(0, Math.min(maxPWM, pwmValue));
        } catch (error) {
            console.error('Error converting energy to PWM:', error);
            return 0;
        }
    }
}



    // ============================================================================
    // modes/touch-control.js
    // ============================================================================

/**
 * Touch Control Mode
 * Handles manual touch/slider-based motor control (matches stream.js pattern)
 */

// Initialize global touchValue for external access (matches stream.js)
if (typeof window !== 'undefined') {
    window.touchValue = 0;
}

class TouchControl {
    constructor(sdk) {
        this.sdk = sdk;
        this.isActive = false;
        this.currentValue = 0;
        this.updateCallback = null;
        this.pwmInterval = null;
    }

    async start() {
        if (this.isActive) {
            console.warn('Touch Control already active');
            return false;
        }

        this.isActive = true;
        this.startPwmWriting();
        console.log('Touch Control started');
        return true;
    }

    async stop() {
        if (!this.isActive) {
            return;
        }

        this.stopPwmWriting();
        this.isActive = false;
        
        // Set motor to 0 when stopping
        await this.sdk.motor.write(0);
        this.currentValue = 0;
        
        console.log('Touch Control stopped');
    }

    setValue(value) {
        // Only store value - no instant PWM writing (matches stream.js)
        this.currentValue = Math.max(0, Math.min(255, Math.round(value)));
        
        // Update global touchValue for external access (matches stream.js)
        if (typeof window !== 'undefined') {
            window.touchValue = Math.round((this.currentValue / 255) * 100);
        }
        
        console.log(`Touch Control: Value set to ${this.currentValue} (${window.touchValue}%)`);
        return true;
    }

    setPercentage(percentage) {
        // Store percentage value - no instant PWM writing (matches stream.js)
        const clampedPercentage = Math.max(0, Math.min(100, Math.round(percentage)));
        this.currentValue = Math.round((clampedPercentage / 100) * 255);
        
        // Update global touchValue for external access (matches stream.js)
        if (typeof window !== 'undefined') {
            window.touchValue = clampedPercentage;
        }
        
        console.log(`Touch Control: Percentage set to ${clampedPercentage}% (PWM: ${this.currentValue})`);
        return true;
    }

    startPwmWriting() {
        // Write PWM every 100ms based on current touch value (matches stream.js)
        this.pwmInterval = setInterval(async () => {
            try {
                // Read from global touchValue like stream.js
                const touchValue = (typeof window !== 'undefined' && window.touchValue) || 0;
                const pwmValue = Math.round((touchValue / 100) * 255);
                
                await this.sdk.motor.write(pwmValue);
                this.currentValue = pwmValue;
                
                // Trigger update callback
                if (this.updateCallback) {
                    this.updateCallback(pwmValue);
                }
            } catch (error) {
                console.error('Touch PWM writing error:', error);
            }
        }, 100); // 100ms interval matches stream.js
    }

    stopPwmWriting() {
        if(window && window.touchValue) {
            window.touchValue = 0
        }
        if (this.pwmInterval) {
            clearInterval(this.pwmInterval);
            this.pwmInterval = null;
        }
    }

    getValue() {
        return this.currentValue;
    }

    getPercentage() {
        return Math.round((this.currentValue / 255) * 100);
    }

    setUpdateCallback(callback) {
        this.updateCallback = callback;
    }

    isRunning() {
        return this.isActive;
    }
}



    // ============================================================================
    // modes/pattern-control.js
    // ============================================================================

/**
 * Pattern Control Mode
 * Handles motor pattern playback and control
 */

class PatternControl {
    constructor(sdk) {
        this.sdk = sdk;
        this.isActive = false;
        this.patternLibrary = motorPatternLibrary;
        
        // PWM interval control (like ambient and touch modes)
        this.pwmInterval = null;
        this.currentPwmValue = 0;
        
        // Pattern state
        this.currentPattern = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.startTime = 0;
        this.pausedTime = 0;
        this.totalPausedDuration = 0;
        this.currentLoop = 0;
        this.maxLoops = -1;
        this.playbackSpeed = 1.0;
        
        // Current pattern ID for compatibility
        this.currentPatternId = null;
        
        // Event callbacks
        this.onPatternStart = null;
        this.onPatternEnd = null;
        this.onPatternLoop = null;
        this.onFrameUpdate = null;
        this.onPlaybackStateChange = null;
    }

    /**
     * Start pattern control mode
     */
    async start() {
        if (this.isActive) {
            console.warn('Pattern Control already active');
            return false;
        }

        this.isActive = true;
        this.currentPwmValue = 0;
        
        // Start PWM writing interval (like ambient and touch modes)
        this.startPwmWriting();
        
        console.log('Pattern Control started');
        return true;
    }

    /**
     * Stop pattern control mode
     */
    async stop() {
        if (!this.isActive) {
            return;
        }

        // Stop any playing pattern
        this.stopPattern();
        
        // Stop PWM writing interval
        this.stopPwmWriting();
        
        // Stop pattern update interval
        if (this.patternUpdateInterval) {
            clearInterval(this.patternUpdateInterval);
            this.patternUpdateInterval = null;
        }
        
        this.isActive = false;
        this.currentPatternId = null;
        
        console.log('Pattern Control stopped');
    }

    /**
     * Start PWM writing interval (like ambient and touch modes)
     */
    startPwmWriting() {
        // Write PWM every 100ms based on current pattern state
        this.pwmInterval = setInterval(async () => {
            try {
                await this.sdk.motor.write(this.currentPwmValue);
            } catch (error) {
                console.error('Pattern PWM writing error:', error);
            }
        }, 100); // 100ms interval matches ambient and touch modes
    }

    /**
     * Stop PWM writing interval
     */
    stopPwmWriting() {
        if (this.pwmInterval) {
            clearInterval(this.pwmInterval);
            this.pwmInterval = null;
        }
        this.currentPwmValue = 0;
    }

    /**
     * Update current PWM value based on pattern playback
     */
    updatePatternPwm() {
        if (!this.isPlaying || this.isPaused || !this.currentPattern) {
            this.currentPwmValue = 0;
            return;
        }

        const now = Date.now();
        const elapsed = (now - this.startTime - this.totalPausedDuration) * this.playbackSpeed;
        const patternDuration = this.currentPattern.duration;

        // Check if we've completed the current loop
        if (elapsed >= patternDuration) {
            this.handleLoopCompletion();
            return;
        }

        // Calculate current PWM value
        this.currentPwmValue = this.calculateCurrentPWM(elapsed);

        // Trigger frame update callback
        if (this.onFrameUpdate) {
            this.onFrameUpdate({
                elapsed: elapsed,
                progress: elapsed / patternDuration,
                pwm: this.currentPwmValue,
                loop: this.currentLoop
            });
        }
    }

    /**
     * Play a pattern by ID
     */
    async playPattern(patternId, options = {}) {
        if (!this.isActive) {
            throw new Error('Pattern Control mode not active');
        }

        const pattern = this.patternLibrary.getPattern(patternId);
        if (!pattern) {
            throw new Error(`Pattern not found: ${patternId}`);
        }

        // Stop current pattern if playing
        if (this.isPlaying) {
            this.stopPattern();
        }

        // Set up new pattern
        this.currentPattern = { ...pattern };
        this.currentPatternId = patternId;
        this.maxLoops = options.loops !== undefined ? options.loops : (pattern.loop ? -1 : 1);
        this.playbackSpeed = options.speed || 1.0;

        // Handle special patterns (like random_walk)
        if (pattern.id === 'random_walk') {
            this.currentPattern.frames = this.generateRandomPattern(pattern.duration);
        }

        // Initialize playback state
        this.isPlaying = true;
        this.isPaused = false;
        this.currentLoop = 0;
        this.startTime = Date.now();
        this.totalPausedDuration = 0;

        // Start pattern update loop
        this.startPatternUpdate();

        console.log(`[Pattern Control] Playing pattern: ${pattern.name} (loops: ${this.maxLoops === -1 ? 'infinite' : this.maxLoops})`);

        // Trigger callbacks
        if (this.onPatternStart) {
            this.onPatternStart(pattern);
        }

        if (this.onPlaybackStateChange) {
            this.onPlaybackStateChange({ isPlaying: true, isPaused: false, pattern: pattern });
        }

        return true;
    }

    /**
     * Stop current pattern
     */
    stopPattern() {
        if (!this.isPlaying) {
            return false;
        }

        this.isPlaying = false;
        this.isPaused = false;
        this.currentPwmValue = 0; // Stop motor immediately

        // Stop pattern update interval
        if (this.patternUpdateInterval) {
            clearInterval(this.patternUpdateInterval);
            this.patternUpdateInterval = null;
        }

        const stoppedPattern = this.currentPattern;
        this.currentPattern = null;
        this.currentPatternId = null;

        console.log(`[Pattern Control] Stopped pattern playback`);

        // Trigger callbacks
        if (this.onPatternEnd) {
            this.onPatternEnd(stoppedPattern);
        }

        if (this.onPlaybackStateChange) {
            this.onPlaybackStateChange({ isPlaying: false, isPaused: false, pattern: null });
        }

        return true;
    }

    /**
     * Pause current pattern
     */
    pausePattern() {
        if (!this.isPlaying || this.isPaused) {
            return false;
        }

        this.isPaused = true;
        this.pausedTime = Date.now();
        this.currentPwmValue = 0; // Stop motor when paused

        console.log(`[Pattern Control] Paused pattern playback`);

        if (this.onPlaybackStateChange) {
            this.onPlaybackStateChange({ isPlaying: true, isPaused: true, pattern: this.currentPattern });
        }

        return true;
    }

    /**
     * Resume current pattern
     */
    resumePattern() {
        if (!this.isPlaying || !this.isPaused) {
            return false;
        }

        this.isPaused = false;
        this.totalPausedDuration += Date.now() - this.pausedTime;

        console.log(`[Pattern Control] Resumed pattern playback`);

        if (this.onPlaybackStateChange) {
            this.onPlaybackStateChange({ isPlaying: true, isPaused: false, pattern: this.currentPattern });
        }

        return true;
    }

    /**
     * Set playback speed
     */
    setPlaybackSpeed(speed) {
        this.playbackSpeed = Math.max(0.1, Math.min(5.0, speed));
        console.log(`[Pattern Control] Playback speed set to ${this.playbackSpeed}x`);
        return this.playbackSpeed;
    }

    /**
     * Start pattern update loop
     */
    startPatternUpdate() {
        // Update pattern PWM every 50ms for smooth playback
        this.patternUpdateInterval = setInterval(() => {
            this.updatePatternPwm();
        }, 50);
    }

    /**
     * Calculate current PWM value based on elapsed time
     */
    calculateCurrentPWM(elapsed) {
        const frames = this.currentPattern.frames;
        if (frames.length === 0) {
            return 0;
        }

        // Find the current frame position
        let currentFrame = null;
        let nextFrame = null;

        for (let i = 0; i < frames.length; i++) {
            if (frames[i].time <= elapsed) {
                currentFrame = frames[i];
                nextFrame = frames[i + 1] || null;
            } else {
                break;
            }
        }

        if (!currentFrame) {
            return frames[0].pwm;
        }

        // If no next frame, return current frame PWM
        if (!nextFrame) {
            return currentFrame.pwm;
        }

        // Interpolate between current and next frame
        const timeDiff = nextFrame.time - currentFrame.time;
        const pwmDiff = nextFrame.pwm - currentFrame.pwm;
        const timeProgress = (elapsed - currentFrame.time) / timeDiff;

        return Math.round(currentFrame.pwm + (pwmDiff * timeProgress));
    }

    /**
     * Handle loop completion
     */
    handleLoopCompletion() {
        this.currentLoop++;

        // Check if we should continue looping
        if (this.maxLoops === -1 || this.currentLoop < this.maxLoops) {
            // Continue to next loop
            this.startTime = Date.now();
            this.totalPausedDuration = 0;

            // Regenerate random pattern if needed
            if (this.currentPattern.id === 'random_walk') {
                this.currentPattern.frames = this.generateRandomPattern(this.currentPattern.duration);
            }

            console.log(`[Pattern Control] Starting loop ${this.currentLoop + 1}`);

            if (this.onPatternLoop) {
                this.onPatternLoop(this.currentPattern, this.currentLoop);
            }
        } else {
            // Pattern completed
            console.log(`[Pattern Control] Pattern completed after ${this.currentLoop} loops`);
            this.stopPattern();
        }
    }

    /**
     * Generate random pattern for random_walk
     */
    generateRandomPattern(duration = 5000, frameCount = 10) {
        const frames = [];
        const timeStep = duration / (frameCount - 1);
        
        for (let i = 0; i < frameCount; i++) {
            frames.push({
                time: Math.round(i * timeStep),
                pwm: Math.round(Math.random() * 255)
            });
        }
        
        return frames;
    }

    /**
     * Get all available patterns
     */
    getAllPatterns() {
        return this.patternLibrary.getAllPatterns();
    }

    /**
     * Get patterns by category
     */
    getPatternsByCategory(category) {
        return this.patternLibrary.getPatternsByCategory(category);
    }

    /**
     * Get pattern by ID
     */
    getPattern(patternId) {
        return this.patternLibrary.getPattern(patternId);
    }

    /**
     * Add custom pattern
     */
    addCustomPattern(pattern) {
        return this.patternLibrary.addPattern(pattern);
    }

    /**
     * Remove pattern
     */
    removePattern(patternId) {
        return this.patternLibrary.removePattern(patternId);
    }

    /**
     * Get current playback status
     */
    getPlaybackStatus() {
        if (!this.isPlaying) {
            return {
                isPlaying: false,
                isPaused: false,
                pattern: null,
                progress: 0,
                loop: 0,
                elapsed: 0
            };
        }

        const elapsed = this.isPaused ? 
            (this.pausedTime - this.startTime - this.totalPausedDuration) * this.playbackSpeed :
            (Date.now() - this.startTime - this.totalPausedDuration) * this.playbackSpeed;

        return {
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            pattern: this.currentPattern,
            progress: this.currentPattern ? elapsed / this.currentPattern.duration : 0,
            loop: this.currentLoop,
            elapsed: elapsed,
            speed: this.playbackSpeed,
            maxLoops: this.maxLoops,
            currentPwm: this.currentPwmValue
        };
    }

    /**
     * Get pattern library statistics
     */
    getLibraryStats() {
        return this.patternLibrary.getLibraryStats();
    }

    /**
     * Check if pattern control is running
     */
    isRunning() {
        return this.isActive;
    }

    /**
     * Check if a pattern is currently playing
     */
    isPatternPlaying() {
        return this.isPlaying && !this.isPaused;
    }

    /**
     * Get current pattern ID
     */
    getCurrentPatternId() {
        return this.currentPatternId;
    }

    /**
     * Set event callbacks
     */
    setCallbacks(callbacks) {
        this.onPatternStart = callbacks.onPatternStart || null;
        this.onPatternEnd = callbacks.onPatternEnd || null;
        this.onPatternLoop = callbacks.onPatternLoop || null;
        this.onFrameUpdate = callbacks.onFrameUpdate || null;
        this.onPlaybackStateChange = callbacks.onPlaybackStateChange || null;
    }





    /**
     * Pattern queue functionality
     */
    async playPatternSequence(patternIds, options = {}) {
        if (!Array.isArray(patternIds) || patternIds.length === 0) {
            throw new Error('Pattern sequence must be a non-empty array');
        }

        const sequenceOptions = {
            loops: 1, // Each pattern plays once by default
            ...options
        };

        console.log(`[Pattern Control] Starting pattern sequence: ${patternIds.join(' -> ')}`);

        for (let i = 0; i < patternIds.length; i++) {
            const patternId = patternIds[i];
            
            if (!this.isActive) {
                console.log('[Pattern Control] Sequence stopped - mode inactive');
                break;
            }

            console.log(`[Pattern Control] Sequence step ${i + 1}/${patternIds.length}: ${patternId}`);
            
            await this.playPattern(patternId, sequenceOptions);
            
            // Wait for pattern to complete
            await new Promise((resolve) => {
                const checkCompletion = () => {
                    if (!this.isPlaying()) {
                        resolve();
                    } else {
                        setTimeout(checkCompletion, 100);
                    }
                };
                checkCompletion();
            });
        }

        console.log('[Pattern Control] Pattern sequence completed');
    }
}



    // ============================================================================
    // dulaan-sdk.js
    // ============================================================================

/**
 * Dulaan SDK - Unified API for motor control system
 * Main entry point that provides a clean, organized interface to all functionality
 */

// Import all modules
// Import control modes
// Import core components
class DulaanSDK {
    constructor() {
        // Core components - use global instances when available (for bundled version)
        this.motor = (typeof motorController !== 'undefined') ? motorController : 
                     (typeof window !== 'undefined' && window.motorController) ? window.motorController : 
                     new MotorController();
        
        // Core instances with safety checks
        
        try {
            this.api = new ApiService(); // Create instance of API service
        } catch (error) {
            console.error('Failed to create ApiService:', error);
            this.api = null;
        }
        
        this.consent = (typeof consentService !== 'undefined') ? consentService :
                       (typeof window !== 'undefined' && window.consentService) ? window.consentService :
                       new ConsentService();
        
        this.remote = (typeof remoteService !== 'undefined') ? remoteService :
                      (typeof window !== 'undefined' && window.remoteService) ? window.remoteService :
                      new RemoteService();
        

        
        // Control modes - with safe instantiation
        this.modes = {};
        this.userConsent = {
            age_confirm : false,
            ble_confirm : true,
            privacy_confirm : false,
            audio_confirm : true,
            terms_confirm : false
        }
        
        try {
            this.modes.ai = new AIVoiceControl({
                apiService: this.api,
                motorController: this.motor
            }); // Primary AI voice control mode
        } catch (error) {
            console.warn('Failed to create AIVoiceControl:', error);
            this.modes.ai = null;
        }
        
        try {
            this.modes.ambient = new AmbientControl(this);
        } catch (error) {
            console.warn('Failed to create AmbientControl:', error);
            this.modes.ambient = null;
        }
        
        try {
            this.modes.touch = new TouchControl(this);
        } catch (error) {
            console.warn('Failed to create TouchControl:', error);
            this.modes.touch = null;
        }
        
        try {
            this.modes.pattern = new PatternControl(this);
        } catch (error) {
            console.warn('Failed to create PatternControl:', error);
            this.modes.pattern = null;
        }
        
        // Direct access to core components
        this.core = {
            apiService: ApiService,
            voiceControl: AIVoiceControl,
            patternControl: PatternControl
        };
        
        // State
        this.currentMode = null;
        this.isInitialized = false;
        
        // Configuration
        this.config = {
            motor: {
                autoConnect: false,
                deviceAddress: null
            },
            audio: {
                sampleRate: 16000,
                maxEnergy: 0.075
            },
            api: {
                geminiApiKey: null // Add API key configuration
            },
            remote: {
                autoHeartbeat: true,
                heartbeatInterval: 30000
            }
        };
    }

    /**
     * Initialize the SDK
     */
    async initialize(config = {}) {
        try {
            // Merge configuration
            this.config = { ...this.config, ...config };
            
            // Initialize motor controller
            await this.motor.initialize();
            
            // Inject remote service into motor controller for remote control integration
            this.motor.setRemoteService(this.remote);
            
            // Auto-connect to motor if configured
            if (this.config.motor.autoConnect && this.config.motor.deviceAddress) {
                await this.motor.connect(this.config.motor.deviceAddress);
            }
            
            // Audio configuration is handled by individual modes
            
            // Set up remote service callbacks
            this.remote.setEventCallbacks({
                onRemoteCommand: (data, userId) => this.handleRemoteCommand(data, userId),
                onHostReady: (hostId) => this.onHostReady(hostId),
                onRemoteConnected: (userId) => this.onRemoteConnected(userId),
                onRemoteDisconnected: (userId) => this.onRemoteDisconnected(userId),
                onConnectionDrop: () => this.onConnectionDrop()
            });
            
            this.isInitialized = true;
            console.log('Dulaan SDK initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize Dulaan SDK:', error);
            return false;
        }
    }

    /**
     * Motor Control API
     */
    async scan(timeout) {
        return await this.motor.scan(timeout);
    }

    async stopScan() {
        return await this.motor.stopScan();
    }

    async scanAndConnect(timeout) {
        return await this.motor.scanAndConnect(timeout);
    }

    async connect(deviceAddress) {
        return await this.motor.connect(deviceAddress);
    }

    async disconnectMotor() {
        return await this.motor.disconnect();
    }

    async disconnect() {
        // Disconnect both motor and remote for convenience
        await this.disconnectMotor();
        this.disconnectRemote();
    }

    async setPower(pwmValue) {
        return await this.motor.write(pwmValue);
    }

    getPower() {
        return this.motor.getCurrentPwm();
    }

    isConnected() {
        return this.motor.isMotorConnected();
    }

    getDeviceAddress() {
        return this.motor.getDeviceAddress();
    }

    getScanResults() {
        return this.motor.getScanResults();
    }

    isScanning() {
        return this.motor.isScanningActive();
    }

    /**
     * Control Modes API
     */
    async startMode(mode) {
        if (!this.modes[mode]) {
            throw new Error(`Unknown mode: ${mode}`);
        }
        
        await this.stopMode();
        this.currentMode = mode;
        return await this.modes[mode].start();
    }

    async stopMode() {
        if (this.currentMode) {
            await this.modes[this.currentMode].stop();
            this.currentMode = null;
        }
        this.motor.write(0)
    }

    getCurrentMode() {
        return this.currentMode;
    }

    getCurrentMode() {
        return this.currentMode;
    }

    /**
     * Remote Control API
     */
    generateId() {
        return this.remote.generateShortId();
    }

    async startHost() {
        const id = await this.remote.initializeAsHost();
        return id;
    }

    async connectToHost(hostId) {
        return await this.remote.connectAsRemote(hostId);
    }

    async sendCommand(mode, value, data = {}) {
        return this.remote.sendControlCommand(mode, value, data);
    }

    disconnectRemote() {
        this.remote.disconnect();
    }

    getStatus() {
        return this.remote.getStatus();
    }

    /**
     * User Management API
     */
    async getDeviceId() {
        return await this.consent.getDeviceId();
    }

    async setConsent(consentData) {
        return await this.consent.collectUserConsent(consentData);
    }

    async clearConsent() {
        return await this.consent.revokeConsent();
    }

    getConsent() {
        return this.consent.getConsentSummary();
    }

    hasConsent(type = 'dataProcessing') {
        return this.consent.hasConsent(type);
    }

    /**
     * Audio API - Delegated to active mode
     */
    setAudioSensitivity(energy) {
        this.config.audio.maxEnergy = energy;
        
        // Update active mode if it supports audio sensitivity
        if (this.currentMode && this.modes[this.currentMode]) {
            const mode = this.modes[this.currentMode];
            if (mode.setMaxEnergy) {
                mode.setMaxEnergy(energy);
            }
        }
    }

    getAudioSensitivity() {
        return this.config.audio.maxEnergy;
    }

    getAudioState() {
        // Get audio state from active mode
        if (this.currentMode && this.modes[this.currentMode]) {
            const mode = this.modes[this.currentMode];
            if (mode.getAudioState) {
                return mode.getAudioState();
            }
        }
        return {};
    }

    /**
     * Configuration API
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        // Apply configuration changes
        if (newConfig.audio?.maxEnergy) {
            this.setAudioSensitivity(newConfig.audio.maxEnergy);
        }
        
        if (newConfig.api?.geminiApiKey) {
            this.api.setApiKey(newConfig.api.geminiApiKey);
        }
        
        if (newConfig.remote) {
            this.remote.updatePeerConfig(newConfig.remote);
        }
    }

    /**
     * Set Gemini API key for AI voice processing
     */
    setApiKey(apiKey) {
        this.config.api.geminiApiKey = apiKey;
        this.api.setApiKey(apiKey);
    }

    getConfig() {
        return { ...this.config };
    }

    /**
     * Event Handlers
     */
    remoteCommandUI(userId) {
        console.log(userId + " send command")
    }

    handleRemoteCommand(data, userId) {
        if (data.type === 'control_command') {
            this.remoteCommandUI(userId)
            console.log(`[SDK] Received remote command from ${userId}: ${data.mode} = ${data.value}`);
            
            // Handle different command types
            switch (data.mode) {
                case 'motor':
                    // Direct motor PWM command
                    if (typeof data.value === 'number' && data.value >= 0 && data.value <= 255) {
                        this.setPower(data.value);
                        console.log(`[SDK] ✅ Motor PWM set to ${data.value} via remote command`);
                    } else {
                        console.warn(`[SDK] ❌ Invalid motor PWM value: ${data.value}`);
                    }
                    break;
                    
                case 'heartbeat':
                    // Heartbeat to maintain connection
                    console.log(`[SDK] 💓 Heartbeat from ${userId}`);
                    break;
                    
                default:
                    // Legacy support - treat as direct PWM value
                    if (typeof data.value === 'number' && data.value >= 0 && data.value <= 255) {
                        this.setPower(data.value);
                        console.log(`[SDK] ✅ Legacy PWM command: ${data.value}`);
                    } else {
                        console.warn(`[SDK] ❌ Unknown command mode: ${data.mode}`);
                    }
                    break;
            }
        }
    }

    onHostReady(hostId) {
        console.log('Host ready with ID:', hostId);
    }

    onRemoteConnected(userId) {
        console.log('Remote user connected:', userId);
    }

    onRemoteDisconnected(userId) {
        console.log('Remote user disconnected:', userId);
    }

    onConnectionDrop() {
        console.log('Remote connection drop');
    }


    /**
     * Utility Methods
     */
    async testConnectivity() {
        return await this.api.testConnectivity();
    }

    getSDKInfo() {
        return {
            version: '2.0.0',
            initialized: this.isInitialized,
            currentMode: this.currentMode,
            motorConnected: this.motor.isMotorConnected(),
            remoteStatus: this.remote.getStatus(),
            motorRemoteStatus: this.motor.getRemoteStatus(),
            consentStatus: this.consent.getConsentSummary()
        };
    }

    /**
     * Get comprehensive remote control status
     */
    getRemoteControlStatus() {
        const remoteStatus = this.remote.getStatus();
        const motorStatus = this.motor.getRemoteStatus();
        
        return {
            ...remoteStatus,
            motor: motorStatus,
            isRemoteControlActive: remoteStatus.isRemote || remoteStatus.isControlledByRemote
        };
    }

    /**
     * Pattern Control API
     */
    async playPattern(patternId, options = {}) {
        if (!this.modes.pattern) {
            throw new Error('Pattern control mode not available');
        }
        
        // Start pattern mode if not active
        if (!this.modes.pattern.isRunning()) {
            await this.startMode('pattern');
        }
        
        return await this.modes.pattern.playPattern(patternId, options);
    }

    async stopPattern() {
        if (this.modes.pattern) {
            return await this.modes.pattern.stopPattern();
        }
        return false;
    }

    pausePattern() {
        if (this.modes.pattern) {
            return this.modes.pattern.pausePattern();
        }
        return false;
    }

    resumePattern() {
        if (this.modes.pattern) {
            return this.modes.pattern.resumePattern();
        }
        return false;
    }

    setPatternSpeed(speed) {
        if (this.modes.pattern) {
            return this.modes.pattern.setPlaybackSpeed(speed);
        }
        return false;
    }

    getAllPatterns() {
        if (this.modes.pattern) {
            return this.modes.pattern.getAllPatterns();
        }
        return [];
    }

    getPatternsByCategory(category) {
        if (this.modes.pattern) {
            return this.modes.pattern.getPatternsByCategory(category);
        }
        return [];
    }

    getPattern(patternId) {
        if (this.modes.pattern) {
            return this.modes.pattern.getPattern(patternId);
        }
        return null;
    }

    addCustomPattern(pattern) {
        if (this.modes.pattern) {
            return this.modes.pattern.addCustomPattern(pattern);
        }
        return false;
    }

    getPatternStatus() {
        if (this.modes.pattern) {
            return this.modes.pattern.getPlaybackStatus();
        }
        return { isPlaying: false, isPaused: false, pattern: null };
    }

    getPatternLibraryStats() {
        if (this.modes.pattern) {
            return this.modes.pattern.getLibraryStats();
        }
        return { totalPatterns: 0, categories: {}, isPlaying: false };
    }

    async playPatternSequence(patternIds, options = {}) {
        if (!this.modes.pattern) {
            throw new Error('Pattern control mode not available');
        }
        
        // Start pattern mode if not active
        if (!this.modes.pattern.isRunning()) {
            await this.startMode('pattern');
        }
        
        return await this.modes.pattern.playPatternSequence(patternIds, options);
    }




}

// Export class for bundling
// Note: Global instance creation is handled by the build script

    // ============================================================================
    // Bundle Initialization
    // ============================================================================

    // Create global instance with error handling and delayed initialization
    let dulaan = null;
    
    // Use setTimeout to ensure all classes are fully defined
    setTimeout(() => {
        try {
            console.log('🔍 Checking available classes before DulaanSDK creation:', {
                DulaanSDK: typeof DulaanSDK,
                MotorController: typeof MotorController,
                StreamingProcessor: typeof StreamingProcessor,
                ApiService: typeof ApiService,
                ConsentService: typeof ConsentService,
                RemoteService: typeof RemoteService,
                RingBuffer: typeof RingBuffer
            });
            
            dulaan = new DulaanSDK();
            console.log('✅ DulaanSDK instance created successfully');
            
            // Update global reference
            window.dulaan = dulaan;
            
            // Initialize automatically
            dulaan.initialize().catch(error => {
                console.error('❌ DulaanSDK initialization failed:', error);
            });
        } catch (error) {
            console.error('❌ Failed to create DulaanSDK instance:', error);
            console.error('Error details:', error.stack);
        }
    }, 100); // 100ms delay to ensure all classes are defined

    // Export to global scope
    window.dulaan = dulaan;
    window.DulaanSDK = DulaanSDK;

    // Export individual components for advanced usage
    window.DULAAN_COMPONENTS = {
        MotorController: typeof MotorController !== 'undefined' ? MotorController : null,
        StreamingProcessor: typeof StreamingProcessor !== 'undefined' ? StreamingProcessor : null,
        ApiService: typeof ApiService !== 'undefined' ? ApiService : null,
        ConsentService: typeof ConsentService !== 'undefined' ? ConsentService : null,
        RemoteService: typeof RemoteService !== 'undefined' ? RemoteService : null,

        AIVoiceControl: typeof AIVoiceControl !== 'undefined' ? AIVoiceControl : null,
        AmbientControl: typeof AmbientControl !== 'undefined' ? AmbientControl : null,
        TouchControl: typeof TouchControl !== 'undefined' ? TouchControl : null,
        PatternControl: typeof PatternControl !== 'undefined' ? PatternControl : null,
        MotorPatternLibrary: typeof MotorPatternLibrary !== 'undefined' ? MotorPatternLibrary : null,
        RingBuffer: typeof RingBuffer !== 'undefined' ? RingBuffer : null,
        UTILS: typeof UTILS !== 'undefined' ? UTILS : null
    };

    console.log('🚀 Dulaan Browser Bundle loaded successfully');
    console.log('📦 Available components:', Object.keys(window.DULAAN_COMPONENTS));
    console.log('🧪 Mock mode enabled - BLE and VoiceRecorder are simulated');

})(window);
