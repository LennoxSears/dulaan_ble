# Dulaan PeerJS Server

A WebRTC signaling server for peer-to-peer communication using the official PeerJS Docker image, deployed on Google Cloud Instance.

## Overview

This deployment uses the official PeerJS Docker image for WebRTC peer-to-peer connections. Benefits:

- **Zero Maintenance**: Uses the official `peerjs/peerjs-server` Docker image
- **Battle Tested**: Maintained by the PeerJS team
- **Simple Deployment**: Single Docker command deployment
- **Cost Effective**: Runs on Google Cloud Instance (e2-micro free tier)

## Architecture

```
Client A ←→ PeerJS Server ←→ Client B
    ↓                           ↓
    └─── Direct P2P Connection ──┘
```

The server only handles signaling; actual data flows directly between peers.

## Quick Deployment

### Prerequisites

- Google Cloud SDK installed and authenticated
- Project with billing enabled

### Deploy to Google Cloud Instance

1. **Create instance and deploy:**
   ```bash
   # Create VM instance
   gcloud compute instances create dulaan-peerjs-server \
       --zone=europe-west1-b \
       --machine-type=e2-micro \
       --tags=peerjs-server \
       --image-family=cos-stable \
       --image-project=cos-cloud

   # Create firewall rule
   gcloud compute firewall-rules create allow-peerjs-server \
       --allow tcp:9000 \
       --target-tags peerjs-server

   # SSH and run Docker container
   gcloud compute ssh dulaan-peerjs-server --zone=europe-west1-b
   sudo docker run -p 9000:9000 -d --name peerjs-server --restart unless-stopped peerjs/peerjs-server
   ```

2. **Get external IP:**
   ```bash
   gcloud compute instances describe dulaan-peerjs-server \
       --zone=europe-west1-b \
       --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
   ```

3. **Test deployment:**
   ```bash
   curl http://EXTERNAL_IP:9000/
   ```

See `DEPLOY_INSTANCE.md` for detailed instructions.

## Client Usage

### JavaScript/Web Client

```javascript
// Connect to the PeerJS server
const peer = new Peer('unique-peer-id', {
  host: 'YOUR_INSTANCE_EXTERNAL_IP',
  port: 9000,
  path: '/',
  secure: false  // Set to true if using HTTPS
});

// Handle connection events
peer.on('open', (id) => {
  console.log('Connected with ID:', id);
});

peer.on('connection', (conn) => {
  console.log('Incoming connection from:', conn.peer);
  
  conn.on('data', (data) => {
    console.log('Received data:', data);
  });
});

// Connect to another peer
const conn = peer.connect('target-peer-id');
conn.on('open', () => {
  conn.send('Hello from peer!');
});
```

### React/Vue/Angular Integration

```javascript
import Peer from 'peerjs';

class PeerService {
  constructor() {
    this.peer = new Peer({
      host: 'YOUR_INSTANCE_EXTERNAL_IP',
      port: 9000,
      path: '/',
      secure: false,  // Set to true if using HTTPS
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });
  }

  connect(targetPeerId) {
    return this.peer.connect(targetPeerId);
  }

  onConnection(callback) {
    this.peer.on('connection', callback);
  }
}

export default PeerService;
```

## API Endpoints

### Server Information
- **GET** `/` - Server status and information
- **GET** `/_ah/health` - Health check for App Engine

### PeerJS Endpoints
- **POST** `/peerjs/id` - Generate new peer ID
- **GET** `/peerjs/peers` - List active peers (if discovery enabled)
- **WebSocket** `/peerjs/peerjs` - WebSocket endpoint for signaling

## Security Considerations

1. **Authentication**: Configure `PEERJS_KEY` for API access control
2. **CORS**: Properly configured for your domain origins
3. **Peer Discovery**: Disabled by default to prevent peer enumeration
4. **Rate Limiting**: App Engine provides built-in DDoS protection
5. **HTTPS**: Always use secure connections in production

## Monitoring and Logging

### App Engine Logs
```bash
# View recent logs
gcloud app logs tail --service=peerjs-server

# View logs from specific time
gcloud app logs read --service=peerjs-server --since=1h
```

### Metrics
- **Connection Count**: Monitor active peer connections
- **CPU/Memory Usage**: Track resource utilization
- **Error Rate**: Monitor failed connection attempts
- **Latency**: WebSocket connection establishment time

## Troubleshooting

### Common Issues

1. **Connection Failures**
   - Check CORS configuration
   - Verify HTTPS/WSS usage in production
   - Ensure firewall allows WebSocket connections

2. **High Latency**
   - Consider deploying to multiple regions
   - Optimize App Engine instance class
   - Check network connectivity

3. **Scaling Issues**
   - Adjust `max_instances` in app.yaml
   - Monitor CPU/memory usage
   - Consider session affinity settings

### Debug Mode

Enable debug logging in development:
```javascript
// In server.js
const peerServer = ExpressPeerServer(server, {
  debug: true,  // Enable debug logging
  // ... other options
});
```

## Cost Optimization

- **Instance Class**: Start with F2, scale up if needed
- **Min Instances**: Keep 1 instance for availability
- **Auto Scaling**: Configure based on actual usage patterns
- **Regional Deployment**: Deploy close to your users

## Support

For issues related to:
- **PeerJS**: [PeerJS Documentation](https://peerjs.com/docs/)
- **Google App Engine**: [App Engine Documentation](https://cloud.google.com/appengine/docs)
- **WebRTC**: [WebRTC Documentation](https://webrtc.org/getting-started/)

## License

MIT License - see LICENSE file for details.