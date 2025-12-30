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