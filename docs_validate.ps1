# // docs_validate.ps1 — checks required sections and diagram presence
param([string]$Readme="README.md",[string]$Report="Technical Report.md")
$errors = @()
function Has($path,$pattern){
  if (-not (Select-String -Path $path -Pattern $pattern -Quiet)) { $script:errors += "Missing: $pattern in $path" }
}
Has $Readme '^// # Balkeum Labs'
Has $Readme '^// ## Quick Start'
Has $Readme '^// ## Features and Non-goals'
Has $Readme '^// ## Architecture'
Has $Readme '^// ## Usage'
Has $Readme '^// ## Configuration'
Has $Readme '^// ## Security & Privacy'
Has $Readme '^// ## Roadmap'
Has $Readme '```mermaid'
Has $Report '^// # Technical Report'
Has $Report '^// ## System Model'
Has $Report '^// ## Threat Model'
Has $Report '^// ## Cryptography'
Has $Report '^// ## Protocols'
Has $Report '^// ## On-chain Integration'
Has $Report '^// ## Evidence'
if ($errors.Count -gt 0) { Write-Error ($errors -join "`n"); exit 1 } else { Write-Host "Docs OK" -ForegroundColor Green }
