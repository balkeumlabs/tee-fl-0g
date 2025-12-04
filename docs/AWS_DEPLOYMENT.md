# AWS EC2 Deployment Guide

This guide covers deploying the TEE-FL-0G dashboard to AWS EC2. The deployment uses an all-in-one server architecture where both the backend API and frontend are hosted on a single EC2 instance.

## Prerequisites

- AWS account with IAM user access
- AWS CLI configured (optional, but helpful)
- SSH key pair for EC2 access
- Basic knowledge of Linux/Ubuntu commands

## Step 1: Create EC2 Instance

### 1.1 Launch Instance

1. Log in to AWS Console
2. Navigate to **EC2** → **Instances** → **Launch Instance**

### 1.2 Instance Configuration

**Name:** `tee-fl-0g-dashboard`

**Application and OS Images:**
- **Amazon Linux 2023** or **Ubuntu 22.04 LTS** (recommended: Ubuntu)

**Instance Type:**
- **t3.small** (2 vCPU, 2 GB RAM) - minimum
- **t3.medium** (2 vCPU, 4 GB RAM) - recommended for production

**Key Pair:**
- Create new key pair or select existing
- Download `.pem` file and store securely
- **Important:** You'll need this for SSH access

**Network Settings:**
- **VPC:** Default VPC (or create new)
- **Subnet:** Any subnet (in default VPC, all subnets are public by default)
  - **Tip:** Look for "Auto-assign public IPv4 address: Enable" in subnet details
  - If using default VPC (e.g., 172.31.0.0/16), any subnet will work
- **Auto-assign Public IP:** Enable
- **Security Group:** Create new security group with these rules:
  - **SSH (22):** Your IP only (for security)
  - **HTTP (80):** 0.0.0.0/0 (allows web access)
  - **HTTPS (443):** 0.0.0.0/0 (if using SSL)

**Storage:**
- **8 GB** minimum (gp3 SSD)
- Can increase if needed

**Advanced Details (optional):**
- Add user data script for automatic setup (see below)

### 1.3 Launch Instance

Click **Launch Instance** and wait for instance to be running.

**Note the following:**
- **Public IPv4 address** (e.g., `54.123.45.67`)
- **Instance ID** (e.g., `i-0123456789abcdef0`)

---

## Step 2: Configure Security Group

1. Go to **EC2** → **Security Groups**
2. Select your security group
3. **Inbound Rules:**
   - **Type:** SSH, **Port:** 22, **Source:** Your IP/32
   - **Type:** HTTP, **Port:** 80, **Source:** 0.0.0.0/0
   - **Type:** HTTPS, **Port:** 443, **Source:** 0.0.0.0/0 (if using SSL)
4. **Outbound Rules:** Allow all (default)

---

## Step 3: Connect to EC2 Instance

### 3.1 Windows (PowerShell)

```powershell
# Navigate to directory with .pem file
cd C:\path\to\your\key

# Set permissions (if needed)
icacls your-key.pem /inheritance:r

# Connect via SSH
ssh -i your-key.pem ubuntu@YOUR_PUBLIC_IP
# or for Amazon Linux:
ssh -i your-key.pem ec2-user@YOUR_PUBLIC_IP
```

### 3.2 Linux/Mac

```bash
# Set permissions
chmod 400 your-key.pem

# Connect
ssh -i your-key.pem ubuntu@YOUR_PUBLIC_IP
# or for Amazon Linux:
ssh -i your-key.pem ec2-user@YOUR_PUBLIC_IP
```

---

## Step 4: Initial Server Setup

### 4.1 Update System

```bash
# Ubuntu
sudo apt update && sudo apt upgrade -y

# Amazon Linux
sudo yum update -y
```

### 4.2 Install Node.js (v20+)

**Ubuntu:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Should show v20.x.x
npm --version
```

**Amazon Linux:**
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
node --version
npm --version
```

### 4.3 Install Git

```bash
# Ubuntu
sudo apt install -y git

# Amazon Linux
sudo yum install -y git
```

### 4.4 Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### 4.5 Install Nginx (Reverse Proxy)

```bash
# Ubuntu
sudo apt install -y nginx

# Amazon Linux
sudo yum install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

## Step 5: Clone Repository

```bash
# Create app directory
cd ~
mkdir -p apps
cd apps

# Clone repository
git clone https://github.com/balkeumlabs/tee-fl-0g.git
cd tee-fl-0g

# Install dependencies
npm ci
```

---

## Step 6: Configure Environment

```bash
# Copy environment template
cp config/mainnet.env.template .env

# Edit .env file
nano .env
# or
vi .env
```

**Required variables:**
```bash
# RPC Configuration
RPC_ENDPOINT=https://evmrpc.0g.ai
PRIVATE_KEY=0xYOUR_PRIVATE_KEY

# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Frontend Configuration
FRONTEND_PATH=./frontend
```

---

## Step 7: Build and Test

```bash
# Build TypeScript (if applicable)
npm run build

# Test server locally (in screen/tmux)
node server/index.js
# Should see: "Server running on http://0.0.0.0:3000"

# Press Ctrl+C to stop
```

---

## Step 8: Configure Nginx Reverse Proxy

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/tee-fl-0g
# or for Amazon Linux:
sudo nano /etc/nginx/conf.d/tee-fl-0g.conf
```

**Configuration:**
```nginx
server {
    listen 80;
    server_name YOUR_PUBLIC_IP_OR_DOMAIN;

    # Frontend static files
    location / {
        root /home/ubuntu/apps/tee-fl-0g/frontend;
        try_files $uri $uri/ /index.html;
        index index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        root /home/ubuntu/apps/tee-fl-0g/frontend;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**Enable site:**
```bash
# Ubuntu
sudo ln -s /etc/nginx/sites-available/tee-fl-0g /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl reload nginx

# Amazon Linux
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 9: Start Application with PM2

```bash
cd ~/apps/tee-fl-0g

# Start server
pm2 start server/index.js --name tee-fl-0g-api

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the command it outputs (usually sudo env PATH=...)
```

**PM2 Commands:**
```bash
pm2 list              # View running processes
pm2 logs tee-fl-0g-api # View logs
pm2 restart tee-fl-0g-api # Restart
pm2 stop tee-fl-0g-api    # Stop
pm2 delete tee-fl-0g-api  # Remove
```

---

## Step 10: Verify Deployment

1. **Check server:**
   ```bash
   curl http://localhost:3000/api/health
   ```

2. **Check frontend:**
   - Open browser: `http://YOUR_PUBLIC_IP`
   - Should see dashboard

3. **Check API:**
   - `http://YOUR_PUBLIC_IP/api/health`
   - `http://YOUR_PUBLIC_IP/api/deployment`
   - `http://YOUR_PUBLIC_IP/api/epoch/1`

---

## Step 11: Setup Domain (Optional)

### 11.1 Get Domain

- Purchase domain from Route 53 or external provider
- Point DNS A record to EC2 public IP

### 11.2 SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx  # Ubuntu
# or
sudo yum install -y certbot python3-certbot-nginx  # Amazon Linux

# Get certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal (already configured)
sudo certbot renew --dry-run
```

---

## Step 12: Working with Windsurf via SSH

### 12.1 Connect Windsurf to EC2

1. Open Windsurf
2. **Remote-SSH:** Connect to Host
3. Enter: `ubuntu@YOUR_PUBLIC_IP` (or `ec2-user@...`)
4. Select SSH config file
5. Add to `~/.ssh/config`:
   ```
   Host tee-fl-0g-aws
       HostName YOUR_PUBLIC_IP
       User ubuntu
       IdentityFile ~/.ssh/your-key.pem
   ```

### 12.2 Work on Server

- Clone/pull latest code
- Make changes
- Test locally
- Commit and push to GitHub

---

## Troubleshooting

### Server Not Starting

```bash
# Check logs
pm2 logs tee-fl-0g-api

# Check if port is in use
sudo netstat -tulpn | grep 3000

# Check Node.js version
node --version
```

### Nginx 502 Bad Gateway

```bash
# Check if backend is running
pm2 list

# Check backend logs
pm2 logs tee-fl-0g-api

# Test backend directly
curl http://localhost:3000/api/health
```

### Can't Access via Browser

- Check security group inbound rules
- Verify public IP is correct
- Check if instance is running
- Verify Nginx is running: `sudo systemctl status nginx`

### Permission Denied (SSH)

```bash
# Fix key permissions
chmod 400 your-key.pem

# Check security group allows SSH from your IP
```

---

## Maintenance

### Update Application

```bash
cd ~/apps/tee-fl-0g
git pull origin main
npm ci
npm run build  # if needed
pm2 restart tee-fl-0g-api
```

### View Logs

```bash
# Application logs
pm2 logs tee-fl-0g-api

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Backup

```bash
# Backup .env file
cp .env .env.backup

# Backup data directory
tar -czf data-backup.tar.gz data/
```

---

## Cost Estimation

**t3.small (2 vCPU, 2 GB RAM):**
- ~$15-20/month (on-demand)
- ~$7-10/month (reserved 1-year)

**t3.medium (2 vCPU, 4 GB RAM):**
- ~$30-35/month (on-demand)
- ~$15-18/month (reserved 1-year)

**Data Transfer:**
- First 100 GB/month free
- $0.09/GB after

**Storage (8 GB gp3):**
- ~$0.80/month

**Total (t3.small):** ~$16-21/month

---

## Security Best Practices

1. **Keep system updated:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Use firewall (UFW):**
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

3. **Restrict SSH access:**
   - Only allow your IP in security group
   - Use SSH keys, disable password auth

4. **Regular backups:**
   - Backup `.env` file
   - Backup data directory

5. **Monitor logs:**
   - Check PM2 logs regularly
   - Monitor Nginx access/error logs

---

## Next Steps

- [ ] Set up domain and SSL
- [ ] Configure monitoring (CloudWatch)
- [ ] Set up automated backups
- [ ] Configure auto-scaling (if needed)
- [ ] Set up CI/CD for deployments

---

**Last Updated:** 2025-01-XX UTC

