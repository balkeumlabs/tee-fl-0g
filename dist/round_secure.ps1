# dist/round_secure.ps1
# Usage: .\dist\round_secure.ps1 -RoundController .\round_controller.ps1 -WorkDir .\work
param(
  [Parameter(Mandatory=$true)][string]$RoundController,
  [Parameter(Mandatory=$false)][string]$WorkDir = "."
)
# 0) Env checks
if (-not $env:FL_TEE_PUBKEY_B64 -or $env:FL_TEE_PUBKEY_B64.Trim().Length -lt 40) {
  Write-Error "FL_TEE_PUBKEY_B64 missing or too short. Aborting."; exit 201
}
$deletePlain = ($env:FL_ENC_DELETE_PLAINTEXT -eq "1")

# 1) Pre-flight
if (!(Test-Path $RoundController)) { Write-Error "RoundController not found: $RoundController"; exit 202 }

# 2) Run base controller
& powershell -NoProfile -File $RoundController -WorkDir $WorkDir
if ($LASTEXITCODE -ne 0) { Write-Error "Base round controller failed."; exit 203 }

# 3) Scrub plaintext if policy says so
if ($deletePlain) {
  Get-ChildItem -Path $WorkDir -Recurse -Filter 'client_update*.json' -File `
    | Where-Object { $_.Name -notlike '*.enc.json' } `
    | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue }
  Write-Host "[secure] Deleted plaintext client_update*.json as per FL_ENC_DELETE_PLAINTEXT=1"
}

# 4) Done
Write-Host "[secure] Round completed with encryption enforcement."
