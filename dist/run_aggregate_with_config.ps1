# // dist/run_aggregate_with_config.ps1
# // Purpose: Run the hardened aggregator using fl_aggregate.config.json (forcePath + onMismatch).
param(
  # // Input directory containing plaintext client_update*.json
  [Parameter(Mandatory=$true)][string]$InDir,
  # // Output directory for normalized_inputs.json and aggregated_model.json
  [Parameter(Mandatory=$true)][string]$OutDir
)

# // Load config
$cfgPath = Join-Path $PSScriptRoot '..\fl_aggregate.config.json'
if (!(Test-Path $cfgPath)) { throw "Config not found: $cfgPath" }
$cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
if (-not $cfg.forcePath) { throw "Config missing 'forcePath'." }
if (-not $cfg.onMismatch) { $cfg.onMismatch = 'pad' }

# // Run the aggregator with forced path
node "$PSScriptRoot\local_normalize_and_aggregate.js" --in-dir $InDir --out-dir $OutDir --on-mismatch $cfg.onMismatch --force-path $cfg.forcePath
if ($LASTEXITCODE -ne 0) { throw "Aggregator exited with code $LASTEXITCODE" }

# // Summary to console
$agg = Join-Path $OutDir 'aggregated_model.json'
if (Test-Path $agg) {
  $j = Get-Content $agg -Raw | ConvertFrom-Json
  "{0} -> weightsLen={1} count={2}" -f $agg, ($j.weights.Length), ($j.count)
} else {
  throw "aggregated_model.json not produced."
}
