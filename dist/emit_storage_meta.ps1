# dist/emit_storage_meta.ps1
param(
  [Parameter(Mandatory=$true)][string]$File,    # file to describe
  [Parameter(Mandatory=$true)][int]$EpochId,    # epoch id
  [string]$OutFile                              # optional explicit output
)

# Resolve and validate input
try { $resolved = (Resolve-Path -Path $File -ErrorAction Stop).Path }
catch { Write-Error "File not found: $File"; exit 2 }

# Compute fields
$name = Split-Path -Leaf $resolved
$size = (Get-Item -LiteralPath $resolved).Length
$sha  = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolved).Hash.ToLower()
$timestamp = (Get-Date -AsUTC -Format s) + 'Z'

# Decide output path
if ([string]::IsNullOrWhiteSpace($OutFile)) {
  $base = [IO.Path]::GetFileNameWithoutExtension($name)
  $OutFile = Join-Path -Path (Get-Location) -ChildPath ("{0}_{1:yyyyMMdd_HHmmss}_storage_meta.json" -f $base,(Get-Date))
}
$OutFile = [IO.Path]::GetFullPath($OutFile)
$dir = Split-Path -Parent $OutFile
if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

# Write JSON
@"
{
  "name": "$name",
  "sha256": "$sha",
  "size": $size,
  "cid": null,
  "epochId": $EpochId,
  "source": "aggregate_with_config",
  "path": "$resolved",
  "timestamp": "$timestamp"
}
"@ | Set-Content -Encoding UTF8 -LiteralPath $OutFile

# Echo absolute path for callers
Write-Output $OutFile
exit 0
