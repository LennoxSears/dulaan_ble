# Deploy PeerJS Server to Google Cloud Instance

## Prerequisites
- Google Cloud SDK installed and authenticated
- Project with billing enabled

## Step 1: Create a Google Cloud Instance

```bash
# Set your project ID
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# Create a VM instance with Container-Optimized OS
gcloud compute instances create dulaan-peerjs-server \
    --zone=europe-west1-b \
    --machine-type=e2-micro \
    --network-interface=network-tier=PREMIUM,subnet=default \
    --maintenance-policy=MIGRATE \
    --provisioning-model=STANDARD \
    --service-account=default \
    --scopes=https://www.googleapis.com/auth/cloud-platform \
    --tags=http-server,https-server,peerjs-server \
    --create-disk=auto-delete=yes,boot=yes,device-name=dulaan-peerjs-server,image=projects/cos-cloud/global/images/family/cos-stable,mode=rw,size=10,type=pd-balanced \
    --no-shielded-secure-boot \
    --shielded-vtpm \
    --shielded-integrity-monitoring \
    --labels=environment=production,service=peerjs \
    --reservation-affinity=any
```

## Step 2: Configure Firewall Rules

```bash
# Create firewall rule for PeerJS server
gcloud compute firewall-rules create allow-peerjs-server \
    --allow tcp:9000 \
    --source-ranges 0.0.0.0/0 \
    --target-tags peerjs-server \
    --description "Allow PeerJS server on port 9000"
```

## Step 3: Deploy Official PeerJS Server

```bash
# SSH into the instance
gcloud compute ssh dulaan-peerjs-server --zone=europe-west1-b

# On the instance, run the official PeerJS Docker container
sudo docker run -p 9000:9000 -d --name peerjs-server --restart unless-stopped peerjs/peerjs-server

# Check if container is running
sudo docker ps

# Check logs
sudo docker logs peerjs-server
```

## Step 4: Get the External IP

```bash
# Get the external IP of your instance
gcloud compute instances describe dulaan-peerjs-server \
    --zone=europe-west1-b \
    --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

## Step 5: Test the Deployment

```bash
# Test the server (replace EXTERNAL_IP with your instance's IP)
curl http://EXTERNAL_IP:9000/
```

## Step 6: Update Client Configuration

Update your client code to use the new server:

```javascript
window.remoteControl.peer = new Peer(hostId, {
    host: 'EXTERNAL_IP',  // Your instance's external IP
    port: 9000,
    path: '/',
    secure: false  // Use true if you set up HTTPS
});
```

## Optional: Set up HTTPS with Let's Encrypt

```bash
# SSH into the instance
gcloud compute ssh dulaan-peerjs-server --zone=europe-west1-b

# Install nginx for SSL termination
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx

# Get SSL certificate (you'll need a domain name)
sudo certbot --nginx -d your-domain.com

# Configure nginx to proxy to PeerJS server
sudo tee /etc/nginx/sites-available/peerjs > /dev/null <<EOF
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:9000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/peerjs /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Monitoring and Maintenance

```bash
# Check container status
gcloud compute ssh dulaan-peerjs-server --zone=europe-west1-b
sudo docker ps
sudo docker logs peerjs-server

# Update the container
sudo docker pull peerjs/peerjs-server
sudo docker stop peerjs-server
sudo docker rm peerjs-server
sudo docker run -p 9000:9000 -d --name peerjs-server --restart unless-stopped peerjs/peerjs-server

# Monitor instance
gcloud compute instances list
gcloud logging read "resource.type=gce_instance AND resource.labels.instance_id=INSTANCE_ID"
```

## Cost Optimization

- Use `e2-micro` instance (free tier eligible)
- Set up automatic shutdown during off-hours
- Use preemptible instances for development

## Security Considerations

- Restrict firewall rules to specific IP ranges if possible
- Use HTTPS in production
- Regularly update the Docker image
- Monitor access logs