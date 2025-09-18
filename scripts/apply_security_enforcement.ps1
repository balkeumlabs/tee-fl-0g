param([switch]$DryRun)

$targets = @(
  ".\scripts\submit_update_raw.js",
  ".\scripts\aggregate_and_publish_raw.js"
) | Where-Object { Test-Path $_ }

$preamble = @'
// === SECURITY_ENFORCE_PREAMBLE (auto) ===
const sec = require("./security_enforce");
sec.requireEncEnv();
(async () => {
  try {
    const argv = process.argv.slice(2);
    const getArg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i+1] : null; };
    let inPath = getArg("--in") || getArg("--input") || getArg("-i");
    if (!inPath) {
      const guess = argv.find(a => /\.enc\.json$/i.test(a));
      if (guess) inPath = guess;
    }
    if (inPath) { await sec.assertEncryptedJson(inPath); }
    await sec.maybeScrubPlaintext({ fix: process.env.FL_ENC_DELETE_PLAINTEXT === "1" });
  } catch (e) {
    console.error("[enforce]", e && e.message ? e.message : e);
    process.exit(1);
  }
})();
// === /SECURITY_ENFORCE_PREAMBLE ===
'

$attn = @'
// === ATTESTATION_ENFORCE_PREAMBLE (auto) ===
const { spawnSync } = require("child_process");
(function(){
  const argv = process.argv.slice(2);
  const getArg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i+1] : null; };
  const att = getArg("--attestation");
  if (!att) { console.error("[attest] Missing --attestation <file>"); process.exit(1); }
  const path = require("path");
  const res = spawnSync(process.execPath, [path.join(__dirname,"attestation_enforce.js"),
    "--attestation", att,
    "--allowlist", (process.env.TEE_ATTEST_MEAS_ALLOWLIST || path.join(__dirname,"attestation_allowlist.json"))],
    { stdio: "inherit" });
  if (res.status !== 0) { console.error("[attest] enforcement failed"); process.exit(1); }
})();
// === /ATTESTATION_ENFORCE_PREAMBLE ===
'

function Inject-Block {
  param(
    [Parameter(Mandatory=$true)][string]$File,
    [Parameter(Mandatory=$true)][string]$MarkerPattern,
    [Parameter(Mandatory=$true)][string]$Block,
    [string]$InsertAfterPattern = ''
  )
  $raw = Get-Content $File -Raw
  if ($raw -match $MarkerPattern) { return $false }
  if ($InsertAfterPattern -and ($raw -match $InsertAfterPattern)) {
    $updated = $raw -replace $InsertAfterPattern, "`$0`r`n$Block"
  } elseif ($raw -match "['""]use strict['""];\s*") {
    $updated = $raw -replace "(['""]use strict['""];\s*)", "`$1`r`n$Block`r`n"
  } else {
    $updated = $Block + "`r`n" + $raw
  }
  if ($PSBoundParameters.ContainsKey('DryRun') -and $DryRun) {
    "`n--- DRY RUN: would modify $File ---"
    ($updated -split "`r`n")[0..([Math]::Min(25,($updated -split "`r`n").Count-1))] -join "`r`n" | Write-Output
    return $true
  } else {
    $updated | Set-Content -Encoding UTF8 $File
    return $true
  }
}

$changed = @()

foreach ($f in $targets) {
  if (Inject-Block -File $f -MarkerPattern 'SECURITY_ENFORCE_PREAMBLE' -Block $preamble) { $changed += $f }
}

$submit = ".\scripts\submit_update_raw.js"
if (Test-Path $submit) {
  if (Inject-Block -File $submit -MarkerPattern 'ATTESTATION_ENFORCE_PREAMBLE' -Block $attn -InsertAfterPattern '\/\/ === \/SECURITY_ENFORCE_PREAMBLE ===') { $changed += $submit }
}

if (-not (Test-Path '.\scripts\attestation_allowlist.json')) {
  '{"allow":["SIM-TEE-DEMO-1"]}' | Set-Content -Encoding UTF8 .\scripts\attestation_allowlist.json
  $changed += '.\scripts\attestation_allowlist.json'
}
if (-not (Test-Path '.\attestation_sample.json')) {
  '{"measurement":"SIM-TEE-DEMO-1"}' | Set-Content -Encoding UTF8 .\attestation_sample.json
  $changed += '.\attestation_sample.json'
}

$changed | ForEach-Object { "modified: $_" }
