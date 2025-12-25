# EC2 Deployment Commands

## Initial Setup (Run once on new EC2 instance)

```bash
# Update system packages
sudo yum update -y  # For Amazon Linux 2
# OR
sudo apt update && sudo apt upgrade -y  # For Ubuntu

# Install Node.js 20.x (LTS)
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -  # For Amazon Linux 2
sudo yum install -y nodejs
# OR for Ubuntu:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Git (if not already installed)
sudo yum install -y git  # Amazon Linux 2
# OR
sudo apt install -y git  # Ubuntu

# Install PM2 globally for process management
sudo npm install -g pm2

# Install build tools (required for some npm packages)
sudo yum groupinstall -y "Development Tools"  # Amazon Linux 2
# OR
sudo apt install -y build-essential  # Ubuntu
```

## Project Setup

```bash
# Clone your repository (or upload via SCP/SFTP)
cd /home/ec2-user  # or /home/ubuntu for Ubuntu
git clone <your-repo-url> tee-fl-0g
cd tee-fl-0g

# Install dependencies
npm install

# Create .env file from template
cp config/mainnet.env.template .env

# Edit .env file with your actual values
nano .env
# OR use vi
vi .env
```

## Environment Variables (.env file)

Required variables for server:
```bash
PRIVATE_KEY=0xYOUR_MAINNET_PRIVATE_KEY_HERE
RPC_ENDPOINT=https://evmrpc.0g.ai
PORT=3000
HOST=0.0.0.0
```

## Run Server with PM2 (Recommended)

```bash
# Start server with PM2
pm2 start server/index.js --name "tee-fl-0g-server"

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system reboot
pm2 startup
# Follow the command it outputs (usually involves sudo)

# View logs
pm2 logs tee-fl-0g-server

# View status
pm2 status

# Restart server
pm2 restart tee-fl-0g-server

# Stop server
pm2 stop tee-fl-0g-server

# Delete from PM2
pm2 delete tee-fl-0g-server
```

## Alternative: Run Server Directly (Not Recommended for Production)

```bash
# Run in foreground (for testing)
npm run server

# Run in background
nohup npm run server > server.log 2>&1 &
```

## Firewall Configuration

```bash
# For Amazon Linux 2 (using firewalld or iptables)
# Allow HTTP (port 3000) - adjust port if different
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload

# OR using iptables
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
sudo service iptables save

# For Ubuntu (using ufw)
sudo ufw allow 3000/tcp
sudo ufw enable
sudo ufw status
```

## EC2 Security Group Configuration

In AWS Console:
1. Go to EC2 → Security Groups
2. Select your instance's security group
3. Add inbound rule:
   - Type: Custom TCP
   - Port: 3000 (or your PORT)
   - Source: 0.0.0.0/0 (or restrict to specific IPs)
   - Description: TEE-FL-0G Server

## Verify Deployment

```bash
# Check if server is running
curl http://localhost:3000/api/health

# Check from external (replace with your EC2 public IP)
curl http://YOUR_EC2_PUBLIC_IP:3000/api/health
```

## Monitoring and Maintenance

```bash
# View real-time logs
pm2 logs tee-fl-0g-server --lines 100

# Monitor resource usage
pm2 monit

# View server info
pm2 info tee-fl-0g-server

# Restart on file changes (development)
pm2 start server/index.js --name "tee-fl-0g-server" --watch
```

## Quick Deployment Script

Save this as `deploy.sh` and run: `chmod +x deploy.sh && ./deploy.sh`

```bash
#!/bin/bash
set -e

echo "🚀 Deploying TEE-FL-0G to EC2..."

# Install Node.js if not installed
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo yum install -y nodejs
fi

# Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp config/mainnet.env.template .env
    echo "⚠️  Please edit .env file with your actual values!"
    exit 1
fi

# Stop existing server if running
pm2 stop tee-fl-0g-server 2>/dev/null || true
pm2 delete tee-fl-0g-server 2>/dev/null || true

# Start server
echo "🚀 Starting server..."
pm2 start server/index.js --name "tee-fl-0g-server"

# Save PM2 config
pm2 save

echo "✅ Deployment complete!"
echo "📊 View logs: pm2 logs tee-fl-0g-server"
echo "📈 View status: pm2 status"
```

## Troubleshooting

```bash
# Check if port is in use
sudo netstat -tulpn | grep 3000

# Check Node.js version
node --version

# Check npm version
npm --version

# View system logs
sudo journalctl -u pm2-ec2-user -f  # Amazon Linux 2
# OR
sudo journalctl -u pm2-root -f  # Ubuntu

# Check disk space
df -h

# Check memory
free -h
```

