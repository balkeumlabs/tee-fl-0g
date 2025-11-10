# Simple local server for testing front-end
# Run this script to test the dashboard locally

Write-Host "Starting local server for TEE-FL-0G Dashboard..." -ForegroundColor Green
Write-Host ""
Write-Host "Server will be available at: http://localhost:8000" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Check if Python is available
$python = Get-Command python -ErrorAction SilentlyContinue
if ($python) {
    Write-Host "Using Python HTTP server..." -ForegroundColor Cyan
    Set-Location $PSScriptRoot
    python -m http.server 8000
} else {
    # Check if Node.js is available
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        Write-Host "Using Node.js HTTP server..." -ForegroundColor Cyan
        Set-Location $PSScriptRoot
        npx http-server -p 8000
    } else {
        Write-Host "Error: Python or Node.js is required to run a local server." -ForegroundColor Red
        Write-Host ""
        Write-Host "Alternative: Open index.html in a web browser directly" -ForegroundColor Yellow
        Write-Host "Right-click index.html -> Open with -> Choose your browser" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Or install Python: https://www.python.org/downloads/" -ForegroundColor Yellow
        Write-Host "Or install Node.js: https://nodejs.org/" -ForegroundColor Yellow
    }
}
