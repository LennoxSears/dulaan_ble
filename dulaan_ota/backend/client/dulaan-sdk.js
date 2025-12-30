/**
 * Dulaan SDK - Unified API for motor control system
 * Main entry point that provides a clean, organized interface to all functionality
 */

// Import all modules
import { motorController } from './core/motor-controller.js';
import { consentService } from './services/consent-service.js';
import { remoteService } from './services/remote-service.js';


// Import control modes
import { AIVoiceControl } from './modes/ai-voice-control.js';
import { AmbientControl } from './modes/ambient-control.js';
import { TouchControl } from './modes/touch-control.js';
import { PatternControl } from './modes/pattern-control.js';

// Import core components
import { ApiService } from './services/api-service.js';
import { OTAController } from './core/ota-controller.js';

class DulaanSDK {
    constructor() {
        // Core components - use global instances when available (for bundled version)
        this.motor = (typeof motorController !== 'undefined') ? motorController : 
                     (typeof window !== 'undefined' && window.motorController) ? window.motorController : 
                     new MotorController();
        
        // OTA controller
        this.ota = (typeof window !== 'undefined' && window.otaController) ? window.otaController :
                   new OTAController();
        
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
export { DulaanSDK };

// Note: Global instance creation is handled by the build script