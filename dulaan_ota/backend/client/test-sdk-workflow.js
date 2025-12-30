/**
 * SDK Workflow Test - Verify mocks work with real SDK workflows
 * Tests the complete user journey with mock implementations
 */

class SDKWorkflowTest {
    constructor() {
        this.results = [];
        this.sdk = null;
        this.testStartTime = Date.now();
    }

    log(message, type = 'info') {
        const timestamp = Date.now() - this.testStartTime;
        console.log(`[${timestamp}ms] ${message}`);
        
        if (typeof document !== 'undefined') {
            const logDiv = document.getElementById('workflow-log');
            if (logDiv) {
                logDiv.innerHTML += `<div class="${type}">[${timestamp}ms] ${message}</div>`;
                logDiv.scrollTop = logDiv.scrollHeight;
            }
        }
    }

    addResult(test, success, details = '') {
        this.results.push({ test, success, details, timestamp: Date.now() });
        this.log(`${success ? '✅' : '❌'} ${test}: ${details}`, success ? 'success' : 'error');
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Test 1: Complete BLE Workflow
     */
    async testBLEWorkflow() {
        this.log('🔵 Starting BLE Workflow Test...');
        
        try {
            // Initialize motor controller
            const initResult = await this.sdk.motor.initialize();
            if (!initResult) {
                throw new Error('Motor initialization failed');
            }
            this.addResult('BLE Initialize', true, 'Motor controller initialized');

            // Scan for devices
            let deviceFound = false;
            this.sdk.motor.onScanResult = (device) => {
                deviceFound = true;
                this.log(`Found device: ${device.name} (${device.deviceId})`);
            };

            await this.sdk.motor.scan(3000);
            if (!deviceFound) {
                throw new Error('No devices found during scan');
            }
            this.addResult('BLE Scan', true, 'Mock devices discovered');

            // Connect to device
            await this.sdk.motor.connect('MOCK_DEVICE_001');
            if (!this.sdk.motor.isConnected) {
                throw new Error('Device connection failed');
            }
            this.addResult('BLE Connect', true, 'Connected to mock device');

            // Test motor control
            await this.sdk.motor.write(100);
            await this.delay(500);
            await this.sdk.motor.write(200);
            await this.delay(500);
            await this.sdk.motor.write(0);
            this.addResult('Motor Control', true, 'PWM values written successfully');

            // Disconnect
            await this.sdk.motor.disconnect();
            if (this.sdk.motor.isConnected) {
                throw new Error('Device disconnection failed');
            }
            this.addResult('BLE Disconnect', true, 'Device disconnected cleanly');

            this.log('✅ BLE Workflow completed successfully');
            return true;

        } catch (error) {
            this.addResult('BLE Workflow', false, error.message);
            this.log(`❌ BLE Workflow failed: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Test 2: Voice Recorder Workflow
     */
    async testVoiceWorkflow() {
        this.log('🎤 Starting Voice Recorder Workflow Test...');
        
        try {
            const voice = window.Capacitor?.Plugins?.VoiceRecorder;
            if (!voice) {
                throw new Error('VoiceRecorder mock not available');
            }

            // Request permission
            const permission = await voice.requestAudioRecordingPermission();
            if (!permission.value) {
                throw new Error('Audio permission denied');
            }
            this.addResult('Voice Permission', true, 'Audio permission granted');

            // Set up listener
            let chunkCount = 0;
            let totalDataSize = 0;
            
            voice.addListener('audioChunk', (data) => {
                chunkCount++;
                totalDataSize += data.chunk.length;
                if (chunkCount % 10 === 0) {
                    this.log(`Received ${chunkCount} audio chunks (${totalDataSize} bytes total)`);
                }
            });

            // Start streaming
            await voice.startStreaming();
            this.addResult('Voice Start', true, 'Audio streaming started');

            // Let it run for a few seconds
            await this.delay(3000);

            // Stop streaming
            await voice.stopStreaming();
            await voice.removeAllListeners();
            this.addResult('Voice Stop', true, `Received ${chunkCount} audio chunks`);

            if (chunkCount === 0) {
                throw new Error('No audio chunks received');
            }

            this.log('✅ Voice Recorder Workflow completed successfully');
            return true;

        } catch (error) {
            this.addResult('Voice Workflow', false, error.message);
            this.log(`❌ Voice Recorder Workflow failed: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Test 3: Ambient Control Mode Workflow
     */
    async testAmbientModeWorkflow() {
        this.log('🌊 Starting Ambient Control Mode Workflow Test...');
        
        try {
            if (!this.sdk.modes.ambient) {
                throw new Error('Ambient mode not available in SDK');
            }

            // Ensure motor is connected
            if (!this.sdk.motor.isConnected) {
                await this.sdk.motor.initialize();
                await this.sdk.motor.connect('MOCK_DEVICE_001');
            }

            // Start ambient mode
            const startResult = await this.sdk.modes.ambient.start();
            if (!startResult) {
                throw new Error('Failed to start ambient mode');
            }
            this.addResult('Ambient Start', true, 'Ambient control mode started');

            // Let it run and process audio
            let updateCount = 0;
            this.sdk.modes.ambient.onAmbientUpdate = (data) => {
                updateCount++;
                if (updateCount % 5 === 0) {
                    this.log(`Ambient update ${updateCount}: energy=${data.energy.toFixed(4)}, pwm=${data.pwmValue}`);
                }
            };

            await this.delay(5000);

            // Stop ambient mode
            await this.sdk.modes.ambient.stop();
            this.addResult('Ambient Stop', true, `Processed ${updateCount} ambient updates`);

            if (updateCount === 0) {
                this.log('⚠️ Warning: No ambient updates received', 'warning');
            }

            this.log('✅ Ambient Control Mode Workflow completed successfully');
            return true;

        } catch (error) {
            this.addResult('Ambient Mode Workflow', false, error.message);
            this.log(`❌ Ambient Mode Workflow failed: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Test 4: AI Voice Control Mode Workflow
     */
    async testAIVoiceModeWorkflow() {
        this.log('🤖 Starting AI Voice Control Mode Workflow Test...');
        
        try {
            if (!this.sdk.modes.aiVoice) {
                throw new Error('AI Voice mode not available in SDK');
            }

            // Ensure motor is connected
            if (!this.sdk.motor.isConnected) {
                await this.sdk.motor.initialize();
                await this.sdk.motor.connect('MOCK_DEVICE_001');
            }

            // Start AI voice mode
            const startResult = await this.sdk.modes.aiVoice.start();
            if (!startResult) {
                throw new Error('Failed to start AI voice mode');
            }
            this.addResult('AI Voice Start', true, 'AI voice control mode started');

            // Let it run and process audio
            let processingCount = 0;
            const originalOnProcessing = this.sdk.modes.aiVoice.onProcessingStateChange;
            this.sdk.modes.aiVoice.onProcessingStateChange = (isProcessing) => {
                if (isProcessing) {
                    processingCount++;
                    this.log(`AI processing event ${processingCount}`);
                }
                if (originalOnProcessing) originalOnProcessing(isProcessing);
            };

            await this.delay(5000);

            // Stop AI voice mode
            await this.sdk.modes.aiVoice.stop();
            this.addResult('AI Voice Stop', true, `Detected ${processingCount} processing events`);

            this.log('✅ AI Voice Control Mode Workflow completed successfully');
            return true;

        } catch (error) {
            this.addResult('AI Voice Mode Workflow', false, error.message);
            this.log(`❌ AI Voice Mode Workflow failed: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Test 5: Mode Transitions
     */
    async testModeTransitions() {
        this.log('🔄 Starting Mode Transition Test...');
        
        try {
            // Ensure motor is connected
            if (!this.sdk.motor.isConnected) {
                await this.sdk.motor.initialize();
                await this.sdk.motor.connect('MOCK_DEVICE_001');
            }

            // Test transition: None -> Ambient -> AI Voice -> Touch -> None
            const transitions = [
                { mode: 'ambient', name: 'Ambient Control' },
                { mode: 'aiVoice', name: 'AI Voice Control' },
                { mode: 'touch', name: 'Touch Control' }
            ];

            for (const transition of transitions) {
                if (!this.sdk.modes[transition.mode]) {
                    this.log(`⚠️ ${transition.name} mode not available, skipping`, 'warning');
                    continue;
                }

                // Start mode
                const startResult = await this.sdk.modes[transition.mode].start();
                if (!startResult) {
                    throw new Error(`Failed to start ${transition.name}`);
                }
                this.log(`Started ${transition.name}`);

                await this.delay(1000);

                // Stop mode
                await this.sdk.modes[transition.mode].stop();
                this.log(`Stopped ${transition.name}`);

                await this.delay(500);
            }

            this.addResult('Mode Transitions', true, 'All mode transitions completed successfully');
            this.log('✅ Mode Transition Test completed successfully');
            return true;

        } catch (error) {
            this.addResult('Mode Transitions', false, error.message);
            this.log(`❌ Mode Transition Test failed: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Test 6: Error Handling and Recovery
     */
    async testErrorHandling() {
        this.log('⚠️ Starting Error Handling Test...');
        
        try {
            const voice = window.Capacitor?.Plugins?.VoiceRecorder;
            const ble = window.BleClient;

            // Test BLE error simulation
            if (ble && ble.setErrorSimulation) {
                ble.setErrorSimulation('connect', true);
                
                try {
                    await this.sdk.motor.connect('MOCK_DEVICE_001');
                    this.addResult('BLE Error Simulation', false, 'Expected error not thrown');
                } catch (error) {
                    this.addResult('BLE Error Simulation', true, 'BLE error correctly simulated');
                }
                
                ble.setErrorSimulation('connect', false);
            }

            // Test Voice error simulation
            if (voice && voice.setErrorSimulation) {
                voice.setErrorSimulation('start', true);
                
                try {
                    await voice.startStreaming();
                    this.addResult('Voice Error Simulation', false, 'Expected error not thrown');
                } catch (error) {
                    this.addResult('Voice Error Simulation', true, 'Voice error correctly simulated');
                }
                
                voice.setErrorSimulation('start', false);
            }

            this.log('✅ Error Handling Test completed successfully');
            return true;

        } catch (error) {
            this.addResult('Error Handling', false, error.message);
            this.log(`❌ Error Handling Test failed: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Run all workflow tests
     */
    async runAllTests() {
        this.log('🚀 Starting Complete SDK Workflow Test Suite...');
        this.results = [];

        try {
            // Initialize SDK
            if (typeof window !== 'undefined' && window.DulaanSDK) {
                this.sdk = new window.DulaanSDK();
                this.addResult('SDK Creation', true, 'SDK instance created successfully');
            } else {
                throw new Error('DulaanSDK not available');
            }

            // Run all tests
            const tests = [
                () => this.testBLEWorkflow(),
                () => this.testVoiceWorkflow(),
                () => this.testAmbientModeWorkflow(),
                () => this.testAIVoiceModeWorkflow(),
                () => this.testModeTransitions(),
                () => this.testErrorHandling()
            ];

            for (const test of tests) {
                await test();
                await this.delay(1000); // Brief pause between tests
            }

            // Summary
            const passed = this.results.filter(r => r.success).length;
            const total = this.results.length;
            
            this.log(`🏁 Test Suite Complete: ${passed}/${total} tests passed`);
            
            if (passed === total) {
                this.log('🎉 All tests passed! Mock implementations are fully compatible with SDK workflows.', 'success');
            } else {
                this.log(`⚠️ ${total - passed} tests failed. Review results for details.`, 'warning');
            }

            return { passed, total, results: this.results };

        } catch (error) {
            this.addResult('Test Suite', false, error.message);
            this.log(`❌ Test Suite failed: ${error.message}`, 'error');
            return { passed: 0, total: 1, results: this.results };
        }
    }

    /**
     * Get test results summary
     */
    getResults() {
        return {
            passed: this.results.filter(r => r.success).length,
            total: this.results.length,
            results: this.results
        };
    }
}

// Export for use in browser or Node.js
if (typeof window !== 'undefined') {
    window.SDKWorkflowTest = SDKWorkflowTest;
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = SDKWorkflowTest;
}