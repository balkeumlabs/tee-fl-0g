#!/bin/bash
# AWS EC2 Deployment Script
# 
# This script helps deploy the TEE-FL-0G dashboard to AWS EC2
# Run this on the EC2 instance after initial setup

set -e

echo "🚀 Starting AWS deployment..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Are you in the project root?"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js 18+ required. Current version: $(node --version)"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Install/update dependencies
echo "📦 Installing dependencies..."
npm ci

# Create logs directory
echo "📁 Creating logs directory..."
mkdir -p logs

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found"
    echo "   Please create .env from config/mainnet.env.template"
    echo "   Required variables: RPC_ENDPOINT, PRIVATE_KEY, PORT, HOST"
    read -p "   Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Test server startup
echo "🧪 Testing server startup..."
timeout 5 node server/index.js > /dev/null 2>&1 &
SERVER_PID=$!
sleep 2

if ps -p $SERVER_PID > /dev/null; then
    echo "✅ Server started successfully"
    kill $SERVER_PID 2>/dev/null || true
else
    echo "❌ Server failed to start. Check server/index.js"
    exit 1
fi

# PM2 deployment
echo "🔄 Deploying with PM2..."

# Stop existing process if running
pm2 stop tee-fl-0g-api 2>/dev/null || true
pm2 delete tee-fl-0g-api 2>/dev/null || true

# Start new process
pm2 start ecosystem.config.cjs

# Save PM2 configuration
pm2 save

echo "✅ Deployment complete!"
echo ""
echo "📊 PM2 Status:"
pm2 list
echo ""
echo "📝 View logs: pm2 logs tee-fl-0g-api"
echo "🔄 Restart: pm2 restart tee-fl-0g-api"
echo "🛑 Stop: pm2 stop tee-fl-0g-api"
echo ""
echo "🌐 Test: curl http://localhost:3000/api/health"

