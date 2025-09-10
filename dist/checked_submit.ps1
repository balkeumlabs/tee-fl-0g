// // dist/checked_submit.ps1
// // Usage: .\dist\checked_submit.ps1 -UpdatePath <client_update.json> -Attestation <att.json> -Allowlist <allow.json>
// // Runs attestation_check.js and only then calls submit_update_checked_raw.js (or your existing submit).
param(
  [Parameter(Mandatory=$true)][string]$UpdatePath,
  [Parameter(Mandatory=$true)][string]$Attestation,
  [Parameter(Mandatory=$true)][string]$Allowlist
)
# // 1) Validate files exist
if (!(Test-Path $UpdatePath)) { Write-Error "UpdatePath not found: $UpdatePath"; exit 100 }
if (!(Test-Path $Attestation)) { Write-Error "Attestation not found: $Attestation"; exit 101 }
if (!(Test-Path $Allowlist)) { Write-Error "Allowlist not found: $Allowlist"; exit 102 }

# // 2) Run attestation check
node .\scripts\attestation_check.js --attestation $Attestation --allowlist $Allowlist | Out-Host
if ($LASTEXITCODE -ne 0) { Write-Error "Attestation check failed"; exit 103 }

# // 3) Submit using your existing script (replace args as your script expects)
# // Example assumes: node .\scripts\submit_update_checked_raw.js --file <UpdatePath>
node .\scripts\submit_update_checked_raw.js --file $UpdatePath
if ($LASTEXITCODE -ne 0) { Write-Error "Submit failed"; exit 104 }

# // 4) Done
Write-Host "[checked_submit] OK"
