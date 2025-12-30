/**
 * AI Voice Control Mode
 * Natural conversation with motor control via voice commands
 * Based on working test-real-api.html implementation
 */

import { StreamingProcessor } from '../core/streaming-processor.js';
import { ApiService } from '../services/api-service.js';

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
        
        // PWM interval for consistent BLE connection (like ambient and touch modes)
        this.pwmInterval = null;
        
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
            
            // Start PWM writing interval to keep BLE connection active
            this.startPwmWriting();
            
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
        
        // Stop PWM writing interval
        this.stopPwmWriting();
        
        // Stop audio processing
        await this.stopAudioProcessing();
        await this.motorController.write(0);
        
        console.log("🔇 Voice control stopped");
    }

    /**
     * Start PWM writing interval to keep BLE connection active
     */
    startPwmWriting() {
        // Write PWM every 4 seconds to keep BLE connection alive (prevents idle after 5-30 sec)
        this.pwmInterval = setInterval(async () => {
            try {
                if (this.motorController) {
                    await this.motorController.write(this.state.currentPwm);
                    console.log(`[PWM KEEP-ALIVE] BLE keep-alive write: PWM ${this.state.currentPwm}`);
                    
                    // Trigger callback for UI updates
                    if (this.config.onPwmUpdate) {
                        this.config.onPwmUpdate(this.state.currentPwm);
                    }
                }
            } catch (error) {
                console.error('[PWM KEEP-ALIVE] Error:', error);
            }
        }, 4000); // 4 seconds - keeps BLE active without CPU contention
    }

    /**
     * Stop PWM writing interval
     */
    stopPwmWriting() {
        if (this.pwmInterval) {
            clearInterval(this.pwmInterval);
            this.pwmInterval = null;
        }
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
            const t0 = Date.now();
            console.log(`[Speech] Processing speech packet: ${speechPacket.audioData.length} samples`);
            
            this.state.isProcessing = true;
            this.state.totalApiCalls++;
            
            const startTime = Date.now();
            
            console.log(`[Speech Processing] Processing command`);
            
            const t1 = Date.now();
            const response = await this.apiService.processSpeechSegment(speechPacket);
            const t2 = Date.now();
            
            const processingTime = Date.now() - startTime;
            this.state.totalProcessingTime += processingTime;
            
            console.log(`[TIMING] API call took: ${t2 - t1}ms`);
            
            // ===== DETAILED API RESPONSE LOGGING =====
            console.log(`[API RESPONSE] Full response:`, response);
            console.log(`[API RESPONSE] Transcription: "${response?.transcription || 'N/A'}"`);
            console.log(`[API RESPONSE] Assistant Response: "${response?.response || 'N/A'}"`);
            console.log(`[API RESPONSE] New PWM Value: ${response?.newPwmValue ?? 'N/A'}`);
            console.log(`[API RESPONSE] Processing Time: ${processingTime}ms`);
            
            if (response && response.newPwmValue !== undefined) {
                // Update motor with new PWM value
                const t3 = Date.now();
                console.log(`[MOTOR] Sending PWM ${response.newPwmValue} to motor controller`);
                const motorSuccess = await this.updateMotorPWM(response.newPwmValue);
                const t4 = Date.now();
                console.log(`[MOTOR] Motor update ${motorSuccess ? 'successful' : 'failed'}`);
                console.log(`[TIMING] updateMotorPWM took: ${t4 - t3}ms`);
                
                // Store the last response
                this.state.lastResponse = response;
                
                console.log(`[PROCESSING COMPLETE] Speech processed successfully`);
                console.log(`[TIMING] Total handleSpeechReady: ${Date.now() - t0}ms`);
            } else {
                console.warn(`[API WARNING] No PWM value in response or response is null`);
            }
            
            // ===== RESET STATE FOR NEXT INTERACTION =====
            const t5 = Date.now();
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
            const t6 = Date.now();
            console.log(`[TIMING] Reset operations took: ${t6 - t5}ms`);
            
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
        
        // Note: PWM update is handled in handleSpeechReady() to avoid duplicate writes
        
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
     * Update motor PWM state and write immediately to BLE
     */
    async updateMotorPWM(newPwm) {
        const writeStart = Date.now();
        console.log(`[MOTOR UPDATE] API response: PWM ${this.state.currentPwm} → ${newPwm}`);
        
        const oldPwm = this.state.currentPwm;
        this.state.currentPwm = newPwm;
        
        // Write immediately to BLE for responsive motor control
        if (this.motorController) {
            try {
                await this.motorController.write(newPwm);
                const writeTime = Date.now() - writeStart;
                console.log(`[MOTOR UPDATE] ✅ Immediate write: ${oldPwm} → ${newPwm} (${writeTime}ms)`);
            } catch (error) {
                console.error(`[MOTOR UPDATE] ❌ Failed to write PWM:`, error);
                return false;
            }
        }
        
        return true;
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

export { AIVoiceControl };