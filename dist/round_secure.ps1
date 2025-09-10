# dist/round_secure.ps1
# Usage: .\dist\round_secure.ps1 -RoundController .\round_controller.ps1 -WorkDir .\work
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
  [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$RoundController,
  [Parameter()][string]$WorkDir = "."
)

function Fail([int]$code, [string]$msg) {
  Write-Error $msg
  exit $code
}

if (-not $env:FL_TEE_PUBKEY_B64 -or $env:FL_TEE_PUBKEY_B64.Trim().Length -lt 40) {
  Fail 201 "FL_TEE_PUBKEY_B64 missing or too short. Aborting."
}

if ([string]::IsNullOrWhiteSpace($WorkDir)) { $WorkDir = "." }    # tolerate empty -WorkDir values

# Resolve to absolute paths to avoid relative confusion
$rcPath  = (Resolve-Path -LiteralPath $RoundController).Path
$workAbs = (Resolve-Path -LiteralPath $WorkDir).Path

if (!(Test-Path $rcPath)) { Fail 202 "RoundController not found: $rcPath" }

# Run the base controller in a child process so exit code propagates
powershell -NoProfile -ExecutionPolicy Bypass -File $rcPath -WorkDir $workAbs
if ($LASTEXITCODE -ne 0) { Fail 203 ("Base round controller exit code: {0}" -f $LASTEXITCODE) }

# Scrub plaintext if policy says so
$deletePlain = ($env:FL_ENC_DELETE_PLAINTEXT -eq "1")
if ($deletePlain) {
  Get-ChildItem -Path $workAbs -Recurse -Filter 'client_update*.json' -File `
    | Where-Object { $_.Name -notlike '*.enc.json' } `
    | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue }
  Write-Host "[secure] Deleted plaintext client_update*.json as per FL_ENC_DELETE_PLAINTEXT=1"
}

Write-Host "[secure] Round completed with encryption enforcement."
