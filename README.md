# tee-fl-0g — Federated Learning on 0G (Galileo) with Access-Gated Updates, On-Chain Anchoring, and FedAvg
![Build](https://img.shields.io/badge/build-passing-brightgreen)
![Tests](https://img.shields.io/badge/tests-smoke--round-lightgrey)
![Coverage](https://img.shields.io/badge/coverage-n%2Fa-inactive)
![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-0.2.0--poc-important)
![Docs](https://img.shields.io/badge/docs-Combined%20README-informational)
**Quick links:** [Install](#quick-start) | [Usage](#usage) | [Architecture](#visual-overview) | [Deep-Dive](#engineering-deep-dive) | [Roadmap](#roadmap-and-milestones)
## Summary
This repo demonstrates a working federated-learning pipeline on the 0G Galileo testnet: providers submit access-gated updates, we score and aggregate with FedAvg, anchor model hashes and metadata on-chain, and publish one model per epoch. Current state: end-to-end demo works with simulated storage CIDs; next steps are real 0G Storage CIDs, client-side encryption, and attestation metadata.
## Visual Overview
```powershell
flowchart LR
    A[Client datasets (encrypted)] -->|Upload to 0G Storage (CID)| B[Storage]
    subgraph Chain[0G Galileo (EVM)]
      C[AccessRegistry] --- D[EpochManager]
    end
    E[Provider (TEE sim)] -->|Train locally| F[Update JSON + meta]
    F -->|Access check via AccessRegistry| C
    F -->|Submit update event| D
    D -->|Score + Merkle root| D
    D -->|Aggregate (FedAvg)| G[Global model]
    G -->|SHA-256 + CID| D
    H[Orchestrator (round_controller.ps1)] --> C
    H --> D

Client -> 0G Storage (CID)
Provider(TEE-sim): train -> update JSON (+hashes, cid?)
AccessRegistry.isProviderApproved(...) gate
EpochManager: submit -> score(root) -> FedAvg -> publishModel (one-time)
On-chain: scoresRoot, globalModelHash, globalModelCid
Orchestrator: startEpoch -> grant -> submit N -> score -> aggregate+publish -> verify
```
## Table of Contents
- [Quick Start](#quick-start)
- [Features and Non-Goals](#features-and-non-goals)
- [Usage](#usage)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Observability](#observability)
- [Engineering Deep-Dive](#engineering-deep-dive)
  - [System Model and Assumptions](#system-model-and-assumptions)
  - [Threat Model](#threat-model)
  - [Cryptography and Key Management](#cryptography-and-key-management)
  - [TEE Design and Attestation](#tee-design-and-attestation)
  - [Protocols and Algorithms](#protocols-and-algorithms)
  - [On-Chain Integration (0g/EVM)](#on-chain-integration-0gevem)
  - [Performance and Benchmarks](#performance-and-benchmarks)
  - [Reliability and Failure Modes](#reliability-and-failure-modes)
  - [Security and Privacy Validation](#security-and-privacy-validation)
  - [Reproducibility](#reproducibility)
  - [Artifacts and Evidence](#artifacts-and-evidence)
- [Engineering & Project Ops](#engineering--project-ops)
  - [Development](#development)
  - [Roadmap and Milestones](#roadmap-and-milestones)
  - [FAQ and Troubleshooting](#faq-and-troubleshooting)
  - [Contributing and Code of Conduct](#contributing-and-code-of-conduct)
  - [Versioning and Changelog Policy](#versioning-and-changelog-policy)
  - [License and Notices](#license-and-notices)
  - [Acknowledgements](#acknowledgements)
- [Handoff & Quality Gates](#handoff--quality-gates)
- [Self-Check and Validators](#self-check-and-validators)
## Quick Start
**Prerequisites**
- Windows 10/11 with PowerShell 7, Node.js 18+, npm 9+, Git
- Funded key on 0G Galileo testnet (chainId 16601)
- Visual Studio (preferred for editing) or VS Code (optional)
```powershell
# // Ensure you are inside the repo folder
Set-Location 'C:\Users\raoah\flai-0g-test\tee-fl-0g'
# // Why: Set working directory to the project root
# // Verify expected files exist
Get-ChildItem . -Force | Select-Object Name
# // Why: Sanity check repo contents
# // Install dependencies deterministically
npm ci
# // Why: Clean install per package-lock; avoids drift
# // Compile contracts using Galileo config
npx hardhat compile --config .\hardhat.galileo.js
# // Why: Validates Solidity sources compile with pinned solc versions
```
**Verify**
Expected: successful compile output with no errors; artifacts under `artifacts/`.
**Configure env/secrets**
```powershell
# // Create .env if missing (never commit)
if (!(Test-Path .\.env)) { @"
PRIVATE_KEY=REPLACE_WITH_GALILEO_FUNDED_KEY   # secret
RPC_ENDPOINT=https://evmrpc-testnet.0g.ai     # config
"@ | Set-Content -NoNewline .\.env -Encoding UTF8 }
# // Why: Idempotently create .env with placeholders (no real secrets)
# // Confirm .env exists and is git-ignored
Get-ChildItem .\.env; git check-ignore .\.env
# // Why: Ensure secret file present and ignored by Git
```
Expected: `.env` listed; `git check-ignore` prints `.env`.
**Run**
```powershell
# // Sanity: show signer address, chainId, balance
node .\scripts\check_balance_raw.js
# // Why: Confirm correct account and funded balance on Galileo
# // Execute a full round with 2 synthetic clients on Epoch 4
pwsh .\round_controller.ps1 -EpochId 4 -AutoClients 2
# // Why: One-button path: startEpoch -> grantAccess -> N submissions -> score -> aggregate+publish -> verify
```
**Verify**
Expected: final log shows `published=true`, plus `globalModelHash` and `globalModelCid` (currently simulated CID).
## Features and Non-Goals
**Features**
- Access gating via `AccessRegistry.isProviderApproved` (checked before submit)
- Epoch lifecycle: start → submit updates → dummy scoring → Merkle root → FedAvg → publish once
- On-chain anchoring: `scoresRoot`, `globalModelHash`, `globalModelCid` per epoch
- Orchestrator: `round_controller.ps1` automates end-to-end demo
**Non-Goals (current phase)**
- Real 0G Storage writes (CIDs are simulated; wiring next)
- Live TEE attestation verification (placeholders next)
- Marketplace pay-per-inference flow (mapping next)
## Usage
**Common scripts**
- `deploy_access_raw.js` — deploy AccessRegistry
- `deploy_epoch_raw.js` — deploy EpochManager
- `start_epoch_once_raw.js` — idempotent epoch creation
- `grant_access_raw.js`, `is_approved_raw.js` — permit flow
- `submit_update_checked_raw.js` — gated update submission (preferred)
- `compute_scores_and_post_root_raw.js` — dummy scores → Merkle root on-chain
- `aggregate_and_publish_raw.js` — FedAvg aggregation → SHA-256 → publishModel
- `read_update_raw.js`, `read_epoch_meta_raw.js` — inspection tools
```powershell
# // Run a complete automated round on a new epoch
pwsh .\round_controller.ps1 -EpochId 5 -AutoClients 2
# // Why: Demonstrates repeatable end-to-end flow on another epoch id
```
## Configuration
**.env keys**
| Name          | Purpose                              | Type     | Default                          | Secret |
|---------------|--------------------------------------|----------|----------------------------------|--------|
| PRIVATE_KEY   | EVM signer for deploy/tx             | hex key  | none                             | Yes    |
| RPC_ENDPOINT  | 0G Galileo RPC endpoint              | URL      | https://evmrpc-testnet.0g.ai     | No     |
**.env.example**
```ini
# // Example template; copy to .env and fill real values safely
PRIVATE_KEY=YOUR_PRIVATE_KEY_HEX   # never commit
RPC_ENDPOINT=https://evmrpc-testnet.0g.ai
```
## Deployment
**Environments**
- 0G Galileo testnet (chainId 16601)
**CI/CD (planned)**
- GitHub Actions: `npm ci` → compile with `hardhat.galileo.js` → optional mocked smoke round
- Badges wired to repository once pipeline lands
**Rollback**
- `publishModel` is one-time per epoch; if wrong, open a new epoch and republish
- Use Git tags before contract changes; keep historical `.addresses.json`
## Observability
**Logs & metrics (current)**
- Script stdout includes step markers for start/submit/score/publish
- `read_epoch_meta_raw.js` provides epoch state snapshot
## Engineering Deep-Dive
### System Model and Assumptions
- Actors: Data owner, Provider (TEE or TEE-sim), Aggregator, Chain (0G Galileo), Storage (0G)
- Trust: Only TEEs may decrypt client data; aggregator TEE publishes global model
- One publish per epoch enforced to ensure immutability of final model
### Threat Model
- Assets: Encrypted updates, model weights, keys, attestation proofs
- Adversaries: Malicious providers, curious storage nodes, on-chain observers
- Mitigations: Client-side encryption (planned), attestation checks (planned), hash anchoring on-chain
### Cryptography and Key Management
- Planned: X25519 for ECDH key exchange; AES-GCM for update encryption; per-epoch nonces; SHA-256 for integrity
- Keys stored in `.env` only for dev; production uses secure vault/KMS
### TEE Design and Attestation
- Target: Intel SGX/TDX or AMD SEV-SNP (to be finalized)
- Evidence: Quote/measurement bound to update; verified before scoring
- Sealing: Provider keeps sealed state for reproducibility
### Protocols and Algorithms
- Aggregation: FedAvg across JSON updates (deterministic sorting; numeric stability rules)
- Scoring: Dummy placeholder now; will verify attestation and reject non-compliant updates
### On-Chain Integration (0g/EVM)
- Network: 0G Galileo (chainId 16601)
- Deployer: `0x9Ed57870379e28E32cb627bE365745dc184950dF`
- Contracts:
  - AccessRegistry: `0xE3bffF639B4522Fa3D1E72973f9BEc040504c21e`
  - EpochManager:  `0x9341619f6B889A12bbb90BbE366405ce363Ab779`
- Anchors: `scoresRoot`, `globalModelHash`, `globalModelCid`
### Performance and Benchmarks
- Baseline: Logistic regression on small dataset; demo shows epoch publish in seconds
- Next: Capture timings for N=5..50 providers; track gas costs per submit/publish
### Reliability and Failure Modes
- Idempotent: `start_epoch_once_raw.js` to avoid duplicates
- Failure: If publish fails mid-flight, rerun aggregation; if already published, open new epoch
### Security and Privacy Validation
- Current: Hash anchoring and access gate checks
- Next: Encryption-at-rest, attestation verification, and storage integrity checks
### Reproducibility
- Use `npm ci` and pinned solc versions
- Artifact hashes logged at publish; keep commit SHA with epoch id
### Artifacts and Evidence
- Local: `client_update_*.json`, `aggregated_model_*.json`
- On-chain (examples):
  - Epoch 1: `scoresRoot=0x3606…bb157`, `globalModelCid=cid://simulated/global-1757444721`, `hash=0x5e47…38fc`, published
  - Epoch 2: `scoresRoot=0x391a…94fb`, `weights≈[0.01,-0.01,0.025]`, `globalModelCid=cid://simulated/global-1757446457`, `hash=0x2031…7278e`, published
## Engineering & Project Ops
### Development
- Repo layout: `contracts/`, `scripts/`, `round_controller.ps1`, `hardhat.galileo.js`
- Style: Minimal plugins; dotenv for secrets; PowerShell-first automation
- Editing: Prefer Visual Studio (`devenv /Edit`); VS Code optional
### Roadmap and Milestones
1. Real 0G Storage CIDs wired into submit/publish paths
2. Client-side encryption; TEE-only decrypt
3. Attestation metadata and verification in scoring
4. CI smoke on GitHub Actions with badges
5. Contract extensions for attestation + inference receipts
6. Map final model to 0G Service Marketplace
### FAQ and Troubleshooting
- Q: Why is `publishModel` reverting?
  A: It’s one-time per epoch; start a new epoch.
- Q: `isProviderApproved` returns false?
  A: Use `grant_access_raw.js` for the dataset/model pair before submit.
- Q: I see simulated CIDs only.
  A: Storage wiring pending; see Roadmap item 1.
### Contributing and Code of Conduct
- Use PRs with clear descriptions and test evidence
- Follow respectful communication and security-first principles
### Versioning and Changelog Policy
- Semver-ish tags for PoC milestones
- Changelog entries per PR once CI is active
### License and Notices
- MIT License. See `LICENSE` file.
### Acknowledgements
- 0G Labs (Galileo), Balkeum Labs team (Eli, Umar, Rao), open-source tooling
## Handoff & Quality Gates
- Repo: `balkeumlabs/tee-fl-0g` on branch `rao`
- .env: `PRIVATE_KEY` (secret), `RPC_ENDPOINT=https://evmrpc-testnet.0g.ai`
- Deployer: `0x9Ed57870379e28E32cb627bE365745dc184950dF`
- Addresses: AccessRegistry `0xE3bf…c21e`, EpochManager `0x9341…b779`
- Verification baseline:
  - `npm ci` → `npx hardhat compile --config .\hardhat.galileo.js`
  - `node .\scripts\check_balance_raw.js`
  - `pwsh .\round_controller.ps1 -EpochId 4 -AutoClients 2`
## Self-Check and Validators
```powershell
# // Validate README has key headings and code fences
$readme = Get-Content -Raw .\README.md
# // Check for required headings
$must = @('# Quick Start','# Engineering Deep-Dive','```mermaid','```powershell','On-Chain Integration (0g/EVM)')
# // Ensure all required tokens exist
$missing = $must | Where-Object { $readme -notlike "*$_*" }
# // Print result or missing items
if ($missing) { "Missing: $($missing -join ', ')" } else { "README baseline checks passed." }
# // Why: Quick sanity validator for documentation completeness
```


## Appendix: Technical Report (archived)

# Technical Report — TEE-FL on 0G (Galileo)
// Scope: system model, threat model, crypto plan, protocol flows, and evidence from Epochs 1–2.

## System Model & Assumptions
- Parties: data owners (clients), aggregator, verifiers, chain observers.
- Network: 0G Galileo testnet (chainId 16601).
- Contracts: AccessRegistry (permit gating), EpochManager (epochs, roots, publishModel).
- Assumptions: TEEs provide code identity via measurement and produce attestations; storage provides content addressing via CID.

## Threat Model & Trust Boundaries
- Adversaries: curious clients, malicious aggregators, eavesdroppers.
- Goals: prevent plaintext exposure outside TEEs; ensure only approved TEEs contribute; anchor integrity on-chain.
- Boundaries: client device ↔ storage (encrypted), storage ↔ TEE (decrypt inside TEE), TEE ↔ chain (public).

## Cryptography & Key Management (planned integration)
- Key exchange: X25519 (static client pubkey, ephemeral TEE key), derive shared secret.
- Encryption: AES-256-GCM with explicit nonce per object; header includes scheme, salt, aad.
- Key storage: TEE-sealed keys; client keys in OS keystore.
- Hashing: SHA-256 for artifact integrity; stored on-chain with CID.

## Protocols
### Update Submission
1) Client encrypts update -> upload to 0G Storage -> obtain CID.
2) Client computes SHA-256 -> call AccessRegistry.isProviderApproved() off-chain.
3) If approved, submit on-chain update with CID + hash.
### Scoring
- TEE pulls authorized CIDs, verifies attestation allowlist, runs scoring, posts scoresRoot.
### Aggregation
- TEE FedAvg over qualified updates; compute globalModelHash; publishModel(CID, hash) once per epoch.

## On-chain Integration Details
- Network: 16601; RPC https://evmrpc-testnet.0g.ai.
- Deployed (galileo):
  - AccessRegistry = 0xE3bffF639B4522Fa3D1E72973f9BEc040504c21e
  - EpochManager   = 0x9341619f6B889A12bbb90BbE366405ce363Ab779
- Invariants: publishModel callable once per epoch id.

## Evidence — Epochs 1–2 (PoC)
- Epoch 1:
  - scoresRoot: 0x3606b407a32ff354665b0466c0a66f1d23b53e11e24646a437a5c086bf0bb157
  - globalModelCid: cid://simulated/global-1757444721
  - globalModelHash: 0x5e47909ae238ac0486826478017e6f5ee1da68c6e8f528249bc858d2bce838fc
  - published: true
- Epoch 2:
  - scoresRoot: 0x391a54342f48a1229d7f87afbbce4593538f0ad05274ae0befc3477ee4c194fb
  - FedAvg weights ≈ [0.01, -0.01, 0.025]
  - globalModelCid: cid://simulated/global-1757446457
  - globalModelHash: 0x2031283ac53a2e8b1c6438b20913bee3b5099e056acb3fd60ea7ae106aed278e
  - published: true

## Reliability & Failure Modes
- publishModel is single-shot per epoch; mitigation: start new epoch for corrections.
- RPC instability: retry with exponential backoff.
- Storage unavailability: keep local cache and verify CID-posted contents.

## Reproducibility
```powershell
git switch rao
npm ci
npx hardhat compile --config .\hardhat.galileo.js
node .\scripts\check_balance_raw.js
pwsh -ExecutionPolicy Bypass -File .\round_controller.ps1 -EpochId 4 -AutoClients 2
```
// Expect: scoresRoot nonzero; global model published for target epoch.

## Open Issues & Next Steps
1) Real 0G Storage upload tool + CID plumbing.
2) Client-side encryption & TEE-only decryption.
3) Attestation CID + measurement verification before scoring.
4) CI smoke on PRs to rao.
5) Contract extensions for attestation metadata & receipts.
6) Marketplace mapping for pay-per-inference.

