/**
 * Pattern Control Mode
 * Handles motor pattern playback and control
 */

import { motorPatternLibrary } from '../services/motor-pattern-library.js';

export class PatternControl {
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

