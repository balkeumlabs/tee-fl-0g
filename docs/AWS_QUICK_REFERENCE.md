# AWS EC2 Quick Reference

Quick commands and tips for managing the TEE-FL-0G dashboard on AWS EC2.

## SSH Connection

```bash
# Connect to EC2
ssh -i your-key.pem ubuntu@YOUR_PUBLIC_IP

# Or with SSH config
ssh tee-fl-0g-aws
```

## Application Management

### PM2 Commands

```bash
# View status
pm2 list

# View logs
pm2 logs tee-fl-0g-api
pm2 logs tee-fl-0g-api --lines 100  # Last 100 lines

# Restart
pm2 restart tee-fl-0g-api

# Stop
pm2 stop tee-fl-0g-api

# Delete
pm2 delete tee-fl-0g-api

# Monitor
pm2 monit
```

### Deployment

```bash
cd ~/apps/tee-fl-0g

# Pull latest code
git pull origin main

# Install dependencies
npm ci

# Deploy
./scripts/deploy-aws.sh
# or
bash scripts/deploy-aws.sh
```

### Manual Server Start/Stop

```bash
# Start manually (for testing)
node server/index.js

# Start with PM2
pm2 start ecosystem.config.cjs

# Stop
pm2 stop tee-fl-0g-api
```

## Nginx Management

```bash
# Check status
sudo systemctl status nginx

# Restart
sudo systemctl restart nginx

# Reload configuration
sudo nginx -t  # Test config
sudo systemctl reload nginx

# View logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Testing

```bash
# Health check
curl http://localhost:3000/api/health

# Deployment info
curl http://localhost:3000/api/deployment

# Epoch data
curl http://localhost:3000/api/epoch/1

# Network health
curl http://localhost:3000/api/network/health
```

## Troubleshooting

### Server Not Responding

```bash
# Check if process is running
pm2 list

# Check logs
pm2 logs tee-fl-0g-api

# Check port
sudo netstat -tulpn | grep 3000

# Check if Node.js is working
node --version
```

### Nginx 502 Bad Gateway

```bash
# Check backend is running
pm2 list

# Check backend logs
pm2 logs tee-fl-0g-api

# Test backend directly
curl http://localhost:3000/api/health

# Check Nginx error log
sudo tail -f /var/log/nginx/error.log
```

### Can't Access from Browser

```bash
# Check security group
# - HTTP (80) should allow 0.0.0.0/0
# - HTTPS (443) should allow 0.0.0.0/0

# Check if Nginx is running
sudo systemctl status nginx

# Check if port 80 is listening
sudo netstat -tulpn | grep :80
```

### Permission Issues

```bash
# Fix file permissions
sudo chown -R ubuntu:ubuntu ~/apps/tee-fl-0g

# Fix logs directory
chmod 755 logs/
```

## Environment Variables

```bash
# Edit .env file
nano ~/apps/tee-fl-0g/.env

# Required variables:
# RPC_ENDPOINT=https://evmrpc.0g.ai
# PRIVATE_KEY=0x...
# PORT=3000
# HOST=0.0.0.0
# NODE_ENV=production
```

## File Locations

```
~/apps/tee-fl-0g/          # Application root
  ├── server/               # Backend API
  ├── frontend/             # Frontend files
  ├── .env                  # Environment variables
  ├── ecosystem.config.cjs  # PM2 config
  └── logs/                 # Application logs

/etc/nginx/sites-available/tee-fl-0g  # Nginx config (Ubuntu)
/etc/nginx/conf.d/tee-fl-0g.conf      # Nginx config (Amazon Linux)
/var/log/nginx/                       # Nginx logs
```

## Monitoring

```bash
# System resources
htop
# or
top

# Disk usage
df -h

# Memory usage
free -h

# Network connections
netstat -an | grep :3000
```

## Backup

```bash
# Backup .env
cp ~/apps/tee-fl-0g/.env ~/apps/tee-fl-0g/.env.backup

# Backup data directory
tar -czf ~/data-backup-$(date +%Y%m%d).tar.gz ~/apps/tee-fl-0g/frontend/data/
```

## Updates

```bash
cd ~/apps/tee-fl-0g

# Pull latest
git pull origin main

# Install new dependencies
npm ci

# Restart
pm2 restart tee-fl-0g-api
```

## Security

```bash
# Update system
sudo apt update && sudo apt upgrade -y  # Ubuntu
sudo yum update -y                        # Amazon Linux

# Check firewall
sudo ufw status

# Check open ports
sudo netstat -tulpn
```

---

**Last Updated:** 2025-01-XX UTC

