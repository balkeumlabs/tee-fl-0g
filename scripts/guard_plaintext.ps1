# // Parameters: -Fix moves plaintext into .quarantine, -IncludeTemp scans .tmp as well
param(
    [switch]$Fix,
    [switch]$IncludeTemp
)

# // Require TEE public key for submit paths
if (-not $env:FL_TEE_PUBKEY_B64 -or $env:FL_TEE_PUBKEY_B64.Trim() -eq "") {
    Write-Error "FL_TEE_PUBKEY_B64 is required for submit paths. Set it in .env or the session."
    exit 10
}

# // Discover candidate client update JSON files, excluding *.enc.json
$all = Get-ChildItem -Path . -Recurse -Filter 'client_update*.json' -File -ErrorAction SilentlyContinue |
       Where-Object { $_.Name -notlike '*.enc.json' }

# // Ignore .tmp unless explicitly included; always ignore .quarantine
$all = $all | Where-Object {
    $p = $_.FullName
    $okTemp = $true
    if (-not $IncludeTemp) { $okTemp = ($p -notmatch '\\\.tmp\\') }
    $okTemp -and ($p -notmatch '\\\.quarantine\\')
}

# // Keep those that do NOT contain a "ciphertext" field
$plaintext = @()
foreach ($f in $all) {
    $isCipher = Select-String -Path $f.FullName -Pattern '"ciphertext"\s*:' -SimpleMatch -Quiet
    if (-not $isCipher) { $plaintext += $f }
}

# // If plaintext present, either quarantine (-Fix or FL_ENC_DELETE_PLAINTEXT=1) or fail
if ($plaintext.Count -gt 0) {
    $list = $plaintext | ForEach-Object { $_.FullName } | Sort-Object
    if ($Fix -or $env:FL_ENC_DELETE_PLAINTEXT -eq '1') {
        $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
        $root  = (Resolve-Path .).Path
        $qdir  = Join-Path $root ".quarantine\$stamp"
        New-Item -ItemType Directory -Force -Path $qdir | Out-Null
        foreach ($p in $plaintext) {
            Move-Item -LiteralPath $p.FullName -Destination (Join-Path $qdir $p.Name) -Force
        }
        Write-Host "[guard_plaintext] Quarantined $($plaintext.Count) plaintext files to $qdir"
        exit 0
    } else {
        Write-Error ("Plaintext client updates detected:`n" + ($list -join "`n"))
        exit 11
    }
}

# // No plaintext found
Write-Host "[guard_plaintext] OK: encryption enforced; no plaintext leaks found."
exit 0
