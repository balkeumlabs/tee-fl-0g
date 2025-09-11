// line: install pre-commit hook that runs guard + attestation
param()
$hook = @"
#!/bin/sh
set -e
if command -v pwsh >/dev/null 2>&1; then PS=pwsh; else PS=powershell; fi
"$PS" -NoProfile -ExecutionPolicy Bypass -File scripts/guard_plaintext.ps1
test -f ./scripts/attestation_enforce.js && node ./scripts/attestation_enforce.js --attestation ./attestation_example.json --allowlist ./attestation_allowlist.json || true
exit 0
"@
$hooks = ".git/hooks"
if (!(Test-Path $hooks)) { New-Item -ItemType Directory $hooks | Out-Null }
$path = Join-Path $hooks "pre-commit"
$hook | Set-Content -Encoding ASCII $path
(Get-Content $path) -join "`n" | Set-Content -NoNewline -Encoding ASCII $path
Write-Host "Installed pre-commit hook → $path"
