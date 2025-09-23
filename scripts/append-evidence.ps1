param(
 [int]$epoch,
 [string]$event,
 [string]$scoresRoot,
 [string]$globalModelHash,
 [string]$globalModelCid
)
$rec = [ordered]@{
  epoch           = $epoch
  event           = $event
  scoresRoot      = $scoresRoot
  globalModelHash = $globalModelHash
  globalModelCid  = $globalModelCid
  commit          = (git rev-parse HEAD).Trim()
  timestampUtc    = (Get-Date).ToUniversalTime().ToString("s") + "Z"
} | ConvertTo-Json -Compress
Add-Content -Encoding UTF8 .\evidence.jsonl $rec
