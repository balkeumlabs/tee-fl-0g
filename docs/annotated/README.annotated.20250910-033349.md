// # Balkeum Labs — TEE-FL on 0G (Galileo)
// // Privacy-preserving federated learning PoC with on-chain anchoring, access gating, and per-epoch model publishing.

// <!-- Shields -->
// ![build](https://img.shields.io/badge/build-passing-brightgreen)
// ![tests](https://img.shields.io/badge/tests-smoke-green)
// ![coverage](https://img.shields.io/badge/coverage-n%2Fa-lightgrey)
// ![license](https://img.shields.io/badge/license-MIT-blue)
// ![version](https://img.shields.io/badge/version-0.2.0--poc-informational)

// ## Visual Overview
// ```mermaid
// flowchart TD
//   A[Client devices] -->|encrypt+upload (planned)| B[0G Storage]
//   B -->|CID + SHA-256 on-chain| C(EpochManager)
//   subgraph Access
//     D[AccessRegistry] --> C
//   end
//   C -->|events| E[Scoring (TEE planned)]
//   E -->|scoresRoot| C
//   C -->|aggregate FedAvg| F[Global Model]
//   F -->|publishModel (CID+hash)| C
// ```
// ```text
// ASCII fallback:
// Clients ->(encrypt)-> 0G Storage -> CID & SHA256 -> EpochManager
// AccessRegistry gates submissions
// Scoring -> scoresRoot on-chain
// FedAvg aggregation -> Global Model -> publishModel()
// ```

// ## Table of Contents
// - [Quick Start](#quick-start)
// - [Features and Non-goals](#features-and-non-goals)
// - [Architecture](#architecture)
// - [Usage](#usage)
// - [Configuration](#configuration)
// - [Development](#development)
// - [Security & Privacy](#security--privacy)
// - [Deployment](#deployment)
// - [Observability](#observability)
// - [Roadmap](#roadmap)
// - [Contributing](#contributing)
// - [Versioning & Changelog](#versioning--changelog)
// - [License](#license)
// - [FAQ & Troubleshooting](#faq--troubleshooting)

// ## Quick Start
// ### Prerequisites
// - Windows 10/11 with PowerShell 7+
// - Node v20 LTS and npm v10+
// - Git, Visual Studio (for editing via devenv) or VS Code (optional)

// ### Install
// ```powershell
// # // Ensure branch and env
// git fetch --all
// git switch rao
// Get-ChildItem .\.env
// # // Expect: a .env containing PRIVATE_KEY and RPC_ENDPOINT
// ```
// ```powershell
// # // Reproducible install and compile
// npm ci
// npx hardhat compile --config .\hardhat.galileo.js
// # // Expect: successful compile, solc versions shown
// ```

// ### Verify network & signer
// ```powershell
// node .\scripts\check_balance_raw.js
// # // Expect: chainId 16601 and non-zero balance
// ```

// ### Run an end-to-end demo round (Epoch 4)
// ```powershell
// pwsh -ExecutionPolicy Bypass -File .\round_controller.ps1 -EpochId 4 -AutoClients 2
// # // Flow: startEpoch -> grantAccess -> 2 submits -> scoresRoot -> aggregate+publish -> published=true
// ```

// ## Features and Non-goals
// **Features**
// - Epoch lifecycle with on-chain anchoring (scoresRoot, globalModelCid, globalModelHash)
// - Access gating via AccessRegistry pre-checks
// - FedAvg aggregation over submitted client updates
// - One-button PowerShell round runner
// **Non-goals (current PoC)**
// - Real TEE compute (simulated for now)
// - Marketplace wiring and per-inference receipts (planned)
// - Production-grade scoring; current scoring is dummy

// ## Architecture
// - **Network**: 0G Galileo testnet (chainId 16601)
// - **Contracts**: AccessRegistry, EpochManager
// - **Trust boundaries**: clients and aggregators move to TEE; attestation to be verified before scoring
// - **Crypto model (planned)**: client-side encryption X25519 + AES-GCM; decrypt inside TEE only
// - **On-chain**: submit updates (hash + CID), post scoresRoot, publishModel per epoch

// ## Usage
// ```powershell
// # // Start or ensure next epoch exists
// node .\scripts\start_epoch_once_raw.js
// # // Grant access for provider/dataset
// node .\scripts\grant_access_raw.js
// # // Submit two gated updates
// node .\scripts\submit_update_checked_raw.js
// node .\scripts\submit_update_checked_raw.js
// # // Dummy scoring -> on-chain merkle root
// node .\scripts\compute_scores_and_post_root_raw.js
// # // Aggregate and publish model
// node .\scripts\aggregate_and_publish_raw.js
// # // Verify epoch meta
// node .\scripts\read_epoch_meta_raw.js 0x9341619f6B889A12bbb90BbE366405ce363Ab779 4
// ```
// // Expected: nonzero scoresRoot; globalModelCid populated; published=true.

// ## Configuration
// **.env keys**
// | Key | Purpose | Type | Required | Default | Secret |
// |-----|---------|------|----------|---------|--------|
// | PRIVATE_KEY | EOA for Galileo txs | string | yes | none | yes |
// | RPC_ENDPOINT | RPC URL | string | yes | https://evmrpc-testnet.0g.ai | no |
// | OG_STORAGE_RPC | 0G storage RPC (planned) | string | no | none | no |
// | OG_STORAGE_GATEWAY | 0G gateway (planned) | string | no | none | no |
// // Safe loading: Node scripts use dotenv; keep .env in .gitignore.

// ## Development
// **Repo layout** (key items):
// - /scripts: deploy, submit, score, aggregate, read meta
// - /contracts: AccessRegistry.sol, EpochManager.sol
// - round_controller.ps1: one-button round
// **Common tasks**
// ```powershell
// npx hardhat compile --config .\hardhat.galileo.js
// npx hardhat test --config .\hardhat.galileo.js    # // if/when tests are added
// node .\scripts\check_balance_raw.js
// ```

// ## Security & Privacy
// - Secrets stay in .env; never commit keys. Prefer OS Credential Manager or a vault.
// - Client-side encryption before upload (planned) with X25519/AES-GCM.
// - Attestation: attach attestation CID + measurement, verify before scoring (planned).
// - publishModel is one-time per epoch; republishing requires a new epoch.

// ## Deployment
// - CI smoke (planned): npm ci, compile, mock round on PRs to rao.
// - Rollbacks: code via git; on-chain actions are immutable—start a new epoch to retry.

// ## Observability
// - Local logs per script; recommend uploading logs as CI artifacts.
// - Expose important tx hashes and roots in script outputs.

// ## Roadmap
// 1) Replace simulated CIDs with real 0G Storage CIDs.
// 2) Enforce client-side encryption; decrypt only in TEE.
// 3) Attestation placeholders: attach attestationCid + measurement; verify in scoring.
// 4) CI smoke workflow for PRs.
// 5) Extend contracts for attestation metadata and per-inference receipts.
// 6) Map final model to 0G Service Marketplace for pay-per-inference.

// ## Contributing
// - Use feature branches; open PRs into rao. Follow commit hygiene and include run logs when relevant.

// ## Versioning & Changelog
// - Semver for tags; CHANGELOG.md to be added when CI smoke is live.

// ## License
// - MIT

// ## FAQ & Troubleshooting
// - Q: read_epoch_meta shows zeros? A: Run submissions, scoring, and publish first; then re-read.
// - Q: Execution policy blocks scripts? A: Use `pwsh -ExecutionPolicy Bypass -File ...` for the session.
// - Q: Wrong chainId? A: Ensure RPC_ENDPOINT is https://evmrpc-testnet.0g.ai (chainId 16601).
