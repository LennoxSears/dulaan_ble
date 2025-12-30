# Dulaan Backend - Direct Audio Processing

Backend system for Dulaan motor control with direct audio-to-PWM processing via Gemini 2.0.

## Overview

Dulaan Backend provides real-time audio processing for motor control using Google's Gemini 2.0 AI model. The system processes audio directly without traditional speech-to-text conversion, enabling faster and more contextual motor control commands.

## Architecture

- **Direct Audio Processing**: Audio → Gemini 2.0 → PWM Commands
- **Real-time Control**: WebRTC-based remote control capabilities
- **Cloud Functions**: Serverless API endpoints on Firebase
- **Client SDK**: JavaScript SDK for web and mobile applications

## Project Structure

```
├── functions/           # Firebase Cloud Functions
│   ├── index.js        # Main API endpoints
│   └── package.json    # Server dependencies
├── client/             # Client SDK
│   ├── core/          # Audio processing core
│   ├── modes/         # Control modes (AI voice, ambient, touch)
│   ├── services/      # API and remote services
│   └── utils/         # Utilities and constants
├── peerjs-server/     # WebRTC signaling server
└── test-real-api.html # API testing interface
```

## API Endpoints

### Direct Audio-to-PWM Processing
- **URL**: `https://directaudiotopwm-qveg3gkwxa-ew.a.run.app`
- **Method**: POST
- **Input**: Audio data (Int16Array), current PWM, message history
- **Output**: Transcription, new PWM value, AI response

### User Data Management
- **Store User Data**: `https://storeuserdata-qveg3gkwxa-ew.a.run.app`
- **Store Consent**: `https://storeuserconsent-qveg3gkwxa-ew.a.run.app`
- **Get Consent**: `https://getuserconsent-qveg3gkwxa-ew.a.run.app`

## Key Features

### Audio Processing
- **Direct Audio Input**: Processes raw audio with Gemini 2.0
- **Smart Buffer Management**: Resets on speech start, handles overflow intelligently
- **Multi-language Support**: Automatic language detection
- **Context Awareness**: Maintains conversation history

### Motor Control
- **PWM Commands**: 0-255 range motor control
- **Intent Detection**: Distinguishes motor commands from general conversation
- **Real-time Response**: Sub-second processing times
- **Safety Limits**: Validated PWM ranges

### Client SDK
- **Multiple Control Modes**: AI voice, ambient, touch, remote
- **WebRTC Support**: Real-time remote control
- **Cross-platform**: Web, mobile, and desktop support
- **Modular Architecture**: Easy integration and customization

## Configuration

### Audio Settings
- **Sample Rate**: 16kHz
- **Format**: Int16Array (mono)
- **Buffer Size**: 1600 samples
- **Min Speech Duration**: 500ms

### AI Models
- **Audio Processing**: Gemini 2.0 Flash Experimental
- **Audio Format**: WAV (converted from Int16Array)
- **Context Window**: Last 10 conversation turns

## Development

### Prerequisites
- Node.js 22+
- Firebase CLI
- Google Cloud Project with Gemini API access

### Local Development
```bash
# Install dependencies
npm install

# Start Firebase emulators
npm run serve

# Deploy functions
npm run deploy
```

### Testing
Use `test-real-api.html` to test the direct audio processing API with real microphone input.

## Performance

- **Processing Time**: ~1-2 seconds for audio-to-PWM
- **Cold Start**: <3 seconds (optimized dependencies)
- **Memory Usage**: 1GB allocated per function instance
- **Concurrent Users**: 10 instances max per function

## Security

- **CORS Enabled**: Supports web and mobile clients
- **Input Validation**: All API inputs validated
- **Error Handling**: Graceful degradation on failures
- **Rate Limiting**: Built-in Firebase Functions limits

## License

Apache-2.0 License - see LICENSE file for details.

## Support

For technical support and documentation, see the inline code comments and API documentation in the `/client` and `/functions` directories.

