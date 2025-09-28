# // run_round_no_tx.ps1 — encrypt -> submit -> score -> aggregate (NO_TX=1; no chain)
param(
  [string]$JobId = "0x0",    # // mocked job id
  [int]$Epoch = 1            # // mocked epoch
)

# // Fail fast on any error
$ErrorActionPreference = "Stop"

# // Confirm repo root
if (-not (Test-Path .\package.json)) { throw "Run from repo root (tee-fl-0g)." }

Write-Host "// run_round_no_tx.ps1: begin"

# // Build if crypto tools are missing
if (-not (Test-Path .\dist\crypto\encrypt_update.js)) {
  Write-Host "// building project..."
  npm ci        | Out-Host
  npx hardhat compile --config .\hardhat.galileo.js | Out-Host
}

# // Force NO_TX to prevent any on-chain writes
$env:NO_TX = "1"

# // Guard pubkey for security preambles (use .env if present, else deterministic demo key)
if (-not $env:FL_TEE_PUBKEY_B64) {
  $env:FL_TEE_PUBKEY_B64 = (Select-String -Path .\.env -Pattern '^FL_TEE_PUBKEY_B64=' -ErrorAction SilentlyContinue).Line -replace '^FL_TEE_PUBKEY_B64=',''
  if (-not $env:FL_TEE_PUBKEY_B64) { $env:FL_TEE_PUBKEY_B64 = '3p7bfXt9wbTTW2HC7OQ1Nz+DQ8hbeGdNrfx+FG+IK08=' }
}

# // Ensure sample attestation exists
$attPath = ".\attestation_sample.json"
if (-not (Test-Path $attPath)) {
  Write-Host "// writing demo attestation_sample.json"
  [ordered]@{
    ok          = $true
    measurement = 'SIM-TEE-DEMO-1'
    enclave_id  = 'SIM-TEE'
    nonce       = 'demo'
  } | ConvertTo-Json -Depth 3 | Set-Content -Encoding UTF8 -Path $attPath
}

# // Workspace under .tmp with timestamp
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$work = ".\.tmp\round-$ts"
New-Item -ItemType Directory -Force -Path $work | Out-Null

# // Create a tiny update and encrypt it
'{"r":1,"weights":[0.1,0.2]}' | Set-Content -Encoding UTF8 (Join-Path $work 'u.json')
node .\dist\crypto\encrypt_update.js --in (Join-Path $work 'u.json') --out (Join-Path $work 'u.enc.json') | Out-Host

# // Submit -> short-circuits after preambles
node .\scripts\submit_update_raw.js $JobId $Epoch dummycid (Join-Path $work 'u.enc.json') --attestation $attPath

# // Score -> short-circuits after preambles
node .\scripts\compute_scores_and_post_root_raw.js --attestation $attPath

# // Aggregate/Publish -> short-circuits after preambles
node .\scripts\aggregate_and_publish_raw.js $JobId $Epoch (Join-Path $work 'agg.json') dummyGlobalCid (Join-Path $work 'u.enc.json')

Write-Host "// round complete (NO_TX=1). See $work for artifacts."
