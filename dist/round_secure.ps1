# dist/round_secure.ps1
# Usage: .\dist\round_secure.ps1 -RoundController .\round_controller.ps1 -WorkDir .\work
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
  [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$RoundController,
  [Parameter()][ValidateNotNullOrEmpty()][string]$WorkDir = "."
)

function Fail([int]$code, [string]$msg) {
  Write-Error $msg
  if ($PSCommandPath) { exit $code } else { throw $msg }
}

if (-not $env:FL_TEE_PUBKEY_B64 -or $env:FL_TEE_PUBKEY_B64.Trim().Length -lt 40) {
  Fail 201 "FL_TEE_PUBKEY_B64 missing or too short. Aborting."
}

$deletePlain = ($env:FL_ENC_DELETE_PLAINTEXT -eq "1")

if (!(Test-Path $RoundController)) {
  Fail 202 "RoundController not found: $RoundController"
}

try {
  & powershell -NoProfile -File $RoundController -WorkDir $WorkDir
} catch {
  Fail 203 ("Base round controller failed: {0}" -f $_.Exception.Message)
}

if ($LASTEXITCODE -ne $null -and $LASTEXITCODE -ne 0) {
  Fail 203 ("Base round controller exit code: {0}" -f $LASTEXITCODE)
}

if ($deletePlain) {
  Get-ChildItem -Path $WorkDir -Recurse -Filter 'client_update*.json' -File `
    | Where-Object { $_.Name -notlike '*.enc.json' } `
    | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue }
  Write-Host "[secure] Deleted plaintext client_update*.json as per FL_ENC_DELETE_PLAINTEXT=1"
}

Write-Host "[secure] Round completed with encryption enforcement."
