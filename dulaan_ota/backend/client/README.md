# Dulaan Client SDK

🎤 **Voice-Controlled Motor System with AI Integration**

Complete client SDK for Dulaan motor control with voice commands, ambient audio processing, and remote control capabilities.

## 🚀 Quick Start

### For Hybrid Apps (Capacitor)
```javascript
// Load the bundle
<script src="dulaan-browser-bundled.js"></script>

// Initialize and start voice control
setTimeout(async () => {
    try {
        // Connect to motor via BLE
        await window.dulaan.motor.scan();
        await window.dulaan.motor.connect();
        
        // Start AI voice control
        await window.dulaan.modes.ai.start();
        
        console.log('🎤 Ready for voice commands!');
    } catch (error) {
        console.error('Setup failed:', error);
    }
}, 1000);
```

### For Web Applications
```html
<script src="dulaan-browser-bundled.js"></script>
<script>
    // SDK auto-initializes
    window.dulaan.modes.ai.start().then(() => {
        console.log('Voice control ready!');
    });
</script>
```

## 🏗️ Architecture

### Production Files
- **`dulaan-browser-bundled.js`** - 📦 Complete production bundle (125KB)
- **`dulaan-sdk.js`** - 🎯 Main SDK entry point
- **`build.js`** - 🔨 Bundle generation script

### Core Modules
```
client/
├── core/
│   ├── motor-controller.js           # BLE motor communication
│   └── optimized-streaming-processor.js  # VAD & audio processing
├── services/
│   ├── optimized-api-service.js      # Gemini AI integration
│   ├── consent-service.js            # Privacy management
│   └── remote-service.js             # Remote control
├── modes/
│   ├── optimized-ai-voice-control.js # Primary voice control
│   ├── ambient-control.js            # Ambient audio → PWM
│   └── touch-control.js              # Manual control
└── utils/
    ├── constants.js                  # Configuration
    └── audio-utils.js                # Audio utilities
```
## ✨ Key Features

### 🎤 Voice Control
- **Direct Audio Processing**: Audio → Gemini 2.0 → PWM commands
- **Voice Activity Detection**: Smart buffering with pre/post-speech context
- **Multi-language Support**: Automatic language detection
- **Real-time Processing**: Sub-second response times

### 🔧 Motor Control
- **BLE Communication**: Direct Bluetooth Low Energy to motor device
- **PWM Range**: 0-255 motor control values
- **Device Discovery**: Auto-scan for "XKL-Q086-BT" devices
- **Safety Limits**: Validated PWM ranges with error handling

### 📱 Capacitor Integration
- **VoiceRecorder Plugin**: Real-time audio streaming
- **Bluetooth LE**: Motor device communication
- **Cross-platform**: Web, iOS, Android support
- **Hybrid App Ready**: Complete Capacitor plugin integration

### 🎛️ Control Modes

1. **AI Voice Control** - Primary mode
   - Natural voice commands → PWM control
   - Conversation history management
   - Intent detection for motor vs. chat

2. **Ambient Control** - Environmental audio
   - Real-time ambient audio → PWM control
   - Configurable energy thresholds
   - Continuous audio processing

3. **Touch Control** - Manual control
   - Direct PWM value control
   - Slider/touch interface support

## 🔧 Development

### Build System
```bash
# Generate production bundle
node build.js

# The bundle includes all optimized components:
# - OptimizedStreamingProcessor (VAD)
# - OptimizedApiService (Gemini integration)  
# - OptimizedAIVoiceControl (Primary mode)
# - MotorController (BLE communication)
# - All utilities and constants
```

### Integration Examples

#### Hybrid App (Capacitor)
```html
<!-- PeerJS for remote control -->
<script src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"></script>

<!-- Dulaan SDK (auto-initializes) -->
<script src="dulaan-browser.js"></script>
```

### 2. Development Integration

For modular development:
```javascript
// In your ES6 modules
import { DulaanSDK } from './dulaan-sdk.js';
import { MotorController } from './core/motor-controller.js';

const sdk = new DulaanSDK();
```

### 3. Basic Usage

```javascript
// SDK is automatically initialized when script loads
// Generate a 6-character ID for remote control
const id = window.dulaan.generateId(); // Returns: "A1B2C3"
console.log('Share this ID:', id);

// High-level remote control (recommended)
const hostId = await window.remoteControl.startAsHost();
await window.remoteControl.connectToHost('A1B2C3');
await window.remoteControl.sendCommand('manual', 128);

// Or use SDK methods
window.dulaan.startRemoteControl(id);
window.dulaan.connectToRemote('A1B2C3');

// Initialize Bluetooth connection
await window.dulaan.connect();
```

### 3. Control Modes

#### Local Control
```javascript
// AI Voice Control
await window.startStreaming();
await window.stopStreaming();

// Ambient Sound Control
await window.startAbi();
await window.stopAbi();

// Touch Control
window.touchValue = 50; // 0-100%
await window.startTouch();
await window.stopTouch();
```

#### Remote Control
```javascript
// Same functions with 'remote' prefix
await window.remoteStartStreaming();
await window.remoteStartAbi();
await window.remoteStartTouch();

// Manual remote command
window.sendRemoteCommand('touch', 128); // PWM 0-255
```

## API Configuration

### Cloud Functions Endpoints

Update the API endpoints in `dulaan-browser.js`:

```javascript
// Production endpoints
const SPEECH_TO_TEXT_API = 'https://europe-west1-dulaan-backend.cloudfunctions.net/speechToText';
const SPEECH_TO_TEXT_LLM_API = 'https://europe-west1-dulaan-backend.cloudfunctions.net/speechToTextWithLLM';

// PeerJS Server
const PEERJS_SERVER = {
    host: 'dulaan-backend.ew.r.appspot.com',
    port: 443,
    path: '/peerjs',
    secure: true
};
```

### API Keys

Configure your API keys:
```javascript
// In dulaan-browser.js - speechToTextWithLLM function
const GEMINI_API_KEY = 'your-gemini-api-key-here';
```

## Remote Control Architecture

### Connection Flow
```
1. User A (Host): Starts host mode → Gets unique ID
2. User B (Remote): Connects using Host ID
3. User B: Uses control modes → Commands sent via PeerJS
4. User A: Receives commands → Controls motor
5. User A: Loses local control while remote users connected
```

### Message Protocol
```javascript
{
  type: 'control_command',
  mode: 'ai|ambient|touch|manual',
  value: 0-255, // PWM value
  userId: 'remote-user-id',
  timestamp: Date.now(),
  // Additional mode-specific data
  transcript?: 'voice command text',
  touchValue?: 50, // percentage
  energy?: 0.05 // audio energy
}
```

## UI Integration Examples

### Host Mode UI
```javascript
// Start as host
const hostId = window.startRemoteHost();

// Display host ID to user
document.getElementById('hostId').textContent = hostId;

// Show connected users
window.updateRemoteUsers = () => {
    const users = window.getRemoteControlStatus().connectedUsers;
    document.getElementById('userCount').textContent = users.length;
};
```

### Remote Mode UI
```javascript
// Connect to host
const hostId = prompt('Enter Host ID:');
window.connectToRemoteHost(hostId);

// Update connection status
window.updateRemoteConnectionStatus = (connected, error) => {
    const status = connected ? 'Connected' : `Disconnected: ${error || ''}`;
    document.getElementById('status').textContent = status;
};
```

### Control Mode UI
```javascript
// AI Control
document.getElementById('aiBtn').onclick = async () => {
    if (window.remoteControl.isRemote) {
        await window.remoteStartStreaming();
    } else {
        await window.startStreaming();
    }
};

// Touch Control
document.getElementById('touchSlider').oninput = (e) => {
    window.touchValue = parseInt(e.target.value);
    // Control will be sent automatically via syncInterval
};
```

## Error Handling

### API Errors
```javascript
try {
    const result = await window.dulaan.speechToTextWithLLM(audioData, pwm, msgHis);
    // Handle success
} catch (error) {
    console.error('API Error:', error);
    // Fallback to previous PWM value or safe state
    window.dulaan.write(0);
}
```

### Connection Errors
```javascript
// PeerJS connection error handling
window.remoteControl.peer.on('error', (error) => {
    console.error('PeerJS Error:', error);
    // Show user-friendly error message
    showErrorMessage('Connection failed. Please try again.');
});
```

### Bluetooth Errors
```javascript
// Bluetooth disconnection handling
let onDisconnect = (deviceId) => {
    clearInterval(window.controlInterval);
    clearInterval(window.syncInterval);
    window.connectFlag = false;
    
    // Stop all control modes
    window.stopStreaming();
    window.stopAbi();
    window.stopTouch();
    
    console.log(`Device ${deviceId} disconnected`);
};
```

## Testing

### Local Testing
1. Open `remote-control-demo.html` in two browser tabs
2. Start one as host, copy the ID
3. Connect the other as remote using the ID
4. Test all control modes

### Device Testing
1. Deploy to your hybrid app
2. Test Bluetooth connectivity
3. Test each control mode locally
4. Test remote control between devices
5. Test multi-user scenarios

## Performance Considerations

### Audio Processing
- **Buffer Management**: Ring buffers prevent memory leaks
- **Silence Detection**: Reduces unnecessary API calls
- **Chunk Processing**: Optimized for real-time performance

### Network Optimization
- **PeerJS**: Direct peer-to-peer connections reduce latency
- **Message Throttling**: Control commands are rate-limited
- **Automatic Reconnection**: Handles network interruptions

### Battery Optimization
- **Interval Management**: Proper cleanup of timers
- **Audio Streaming**: Stops when not needed
- **Bluetooth**: Efficient write operations

## Security Considerations

### API Security
- **HTTPS**: All API calls use secure connections
- **API Keys**: Store securely, consider environment variables
- **Input Validation**: All inputs validated before processing

### Remote Control Security
- **Unique IDs**: Host IDs are cryptographically random
- **Peer Discovery**: Disabled by default on PeerJS server
- **Connection Limits**: Consider implementing rate limiting

### Device Security
- **Bluetooth**: Secure pairing and communication
- **Local Control**: Host retains ability to disconnect
- **Emergency Stop**: Always available regardless of remote state

## Troubleshooting

### Common Issues

1. **"Cannot find module 'peerjs'"**
   - Ensure PeerJS script is loaded before your code
   - Check network connectivity to CDN

2. **"Speech recognition failed"**
   - Check microphone permissions
   - Verify API endpoints are accessible
   - Check API key configuration

3. **"Remote connection failed"**
   - Verify PeerJS server is running
   - Check firewall settings
   - Ensure both users have internet connectivity

4. **"Bluetooth connection lost"**
   - Check device proximity
   - Verify device is powered on
   - Restart Bluetooth if necessary

### Debug Mode

Enable debug logging:
```javascript
// In dulaan-browser.js
window.DEBUG_MODE = true;

// Enhanced logging
const log = (message, data = null) => {
    if (window.DEBUG_MODE) {
        console.log(`[Dulaan] ${message}`, data);
    }
};
```

## Migration from Old Version

### API Changes
1. Replace Deepgram calls with `window.dulaan.speechToText()`
2. Replace direct Gemini calls with `window.dulaan.speechToTextWithLLM()`
3. Update error handling for new API responses

### Remote Control Addition
1. Add PeerJS dependency
2. Initialize remote control system
3. Update control mode functions to support remote operation
4. Add UI for host/remote mode switching

### Configuration Updates
1. Update API endpoints to Cloud Functions
2. Configure PeerJS server settings
3. Update API keys and security settings

This integration provides a clean, modern API for motor control functionality.