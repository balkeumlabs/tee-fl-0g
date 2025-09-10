# dist/checked_submit.ps1
param(
  [Parameter(Mandatory=$true)][string]$UpdatePath,
  [Parameter(Mandatory=$true)][string]$Attestation,
  [Parameter(Mandatory=$true)][string]$Allowlist
)
Set-StrictMode -Version Latest; $ErrorActionPreference="Stop"
if (!(Test-Path $UpdatePath)) { Write-Error "UpdatePath not found: $UpdatePath"; exit 100 }
if (!(Test-Path $Attestation)) { Write-Error "Attestation not found: $Attestation"; exit 101 }
if (!(Test-Path $Allowlist)) { Write-Error "Allowlist not found: $Allowlist"; exit 102 }
node .\scripts\attestation_check.js --attestation $Attestation --allowlist $Allowlist | Out-Host
if ($LASTEXITCODE -ne 0) { Write-Error "Attestation check failed"; exit 103 }
# Call your existing submit script (adjust args if different)
node .\scripts\submit_update_checked_raw.js --file $UpdatePath
if ($LASTEXITCODE -ne 0) { Write-Error "Submit failed"; exit 104 }
Write-Host "[checked_submit] OK"
