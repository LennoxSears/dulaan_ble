/**
 * Streaming Audio Processor
 * Voice Activity Detection and audio processing for Capacitor audio chunks
 * Based on working test-real-api.html implementation
 */

import { RingBuffer } from '../utils/audio-utils.js';

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

export { StreamingProcessor };