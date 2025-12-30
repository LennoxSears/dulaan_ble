/**
 * Ambient Control Mode
 * Handles ambient sound-based motor control
 */

import { RingBuffer, base64ToFloat32Array, calculateRMS, energyToPWM } from '../utils/audio-utils.js';

export class AmbientControl {
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
                
                // Always write PWM value (even 0) to keep BLE connection active like touch mode
                await this.sdk.motor.write(pwmValue);
                this.lastPwmValue = pwmValue;
                
                // Trigger event for UI updates
                this.onAmbientUpdate({
                    energy: this.lastRMS,
                    pwmValue: pwmValue
                });
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

export { AmbientControl };

