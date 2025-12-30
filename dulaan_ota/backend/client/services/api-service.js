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

export { ApiService };