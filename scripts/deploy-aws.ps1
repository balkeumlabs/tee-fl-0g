# AWS EC2 Deployment Script (PowerShell)
# 
# This script helps deploy the TEE-FL-0G dashboard to AWS EC2
# Run this on the EC2 instance after initial setup (via SSH)

param(
    [switch]$SkipTest
)

Write-Host "🚀 Starting AWS deployment..." -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Are you in the project root?" -ForegroundColor Red
    exit 1
}

# Check Node.js version
$nodeVersion = (node --version) -replace 'v', '' -split '\.' | Select-Object -First 1
if ([int]$nodeVersion -lt 18) {
    Write-Host "❌ Error: Node.js 18+ required. Current version: $(node --version)" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Node.js version: $(node --version)" -ForegroundColor Green

# Install/update dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
npm ci

# Create logs directory
Write-Host "📁 Creating logs directory..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "logs" | Out-Null

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  Warning: .env file not found" -ForegroundColor Yellow
    Write-Host "   Please create .env from config/mainnet.env.template"
    Write-Host "   Required variables: RPC_ENDPOINT, PRIVATE_KEY, PORT, HOST"
    $continue = Read-Host "   Continue anyway? (y/n)"
    if ($continue -ne 'y' -and $continue -ne 'Y') {
        exit 1
    }
}

# Test server startup (if not skipped)
if (-not $SkipTest) {
    Write-Host "🧪 Testing server startup..." -ForegroundColor Cyan
    $serverProcess = Start-Process -FilePath "node" -ArgumentList "server/index.js" -PassThru -NoNewWindow
    Start-Sleep -Seconds 2
    
    if (-not $serverProcess.HasExited) {
        Write-Host "✅ Server started successfully" -ForegroundColor Green
        Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
    } else {
        Write-Host "❌ Server failed to start. Check server/index.js" -ForegroundColor Red
        exit 1
    }
}

# PM2 deployment
Write-Host "🔄 Deploying with PM2..." -ForegroundColor Cyan

# Stop existing process if running
pm2 stop tee-fl-0g-api 2>$null
pm2 delete tee-fl-0g-api 2>$null

# Start new process
pm2 start ecosystem.config.cjs

# Save PM2 configuration
pm2 save

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 PM2 Status:" -ForegroundColor Cyan
pm2 list
Write-Host ""
Write-Host "📝 View logs: pm2 logs tee-fl-0g-api" -ForegroundColor Yellow
Write-Host "🔄 Restart: pm2 restart tee-fl-0g-api" -ForegroundColor Yellow
Write-Host "🛑 Stop: pm2 stop tee-fl-0g-api" -ForegroundColor Yellow
Write-Host ""
Write-Host "🌐 Test: curl http://localhost:3000/api/health" -ForegroundColor Yellow

