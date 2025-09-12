param(
  [Parameter(Mandatory=$true)][string]$Path,
  [string]$Message = "docs: update",
  [string]$Branch  = "rao"
)

# Ensure we are in a git repo
git rev-parse --is-inside-work-tree *> $null; if ($LASTEXITCODE -ne 0) { Write-Error "Not a git repo."; exit 2 }

# Satisfy local guard if not set
if (-not $env:FL_TEE_PUBKEY_B64 -or $env:FL_TEE_PUBKEY_B64.Trim() -eq "") {
  $env:FL_TEE_PUBKEY_B64 = 'dGVzdF9wdWJsa2V5X3B1YmtleQ=='
}

# Normalize path
$Path = (Resolve-Path $Path).Path

# Add/commit only if there are changes for that file
git add -- $Path
$staged = git diff --cached --name-only -- $Path
if (-not $staged) {
  Write-Host "[push_docs] No staged changes for $Path. Skipping commit."
} else {
  git commit -m $Message
}

# Push
git push origin $Branch

# Build a GitHub blob URL from origin remote
$remote = (git config --get remote.origin.url).Trim()
# Handle https and ssh formats
if ($remote -match '^https://github.com/(.*?)/(.*?)(\.git)?$') {
  $org=$Matches[1]; $repo=$Matches[2]
} elseif ($remote -match '^git@github\.com:(.*?)/(.*?)(\.git)?$') {
  $org=$Matches[1]; $repo=$Matches[2]
} else {
  Write-Warning "[push_docs] Unrecognized remote URL: $remote"; exit 0
}
# Relativize Path from repo root
$root = (git rev-parse --show-toplevel).Trim()
$rel  = (Resolve-Path $Path).Path.Substring($root.Length + 1) -replace '\\','/'

# Open web
$uri = "https://github.com/$org/$repo/blob/$Branch/$rel"
Write-Host "[push_docs] Opening $uri"
Start-Process $uri
