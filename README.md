[![ci-no-tx](https://github.com/balkeumlabs/tee-fl-0g/actions/workflows/ci-no-tx.yml/badge.svg?branch=rao)](https://github.com/balkeumlabs/tee-fl-0g/actions/workflows/ci-no-tx.yml?query=branch%3Arao)

<!-- CI & Docs badges (rao) -->
[![ci-smoke](https://github.com/balkeumlabs/tee-fl-0g/actions/workflows/ci-smoke.yml/badge.svg?branch=rao)](https://github.com/balkeumlabs/tee-fl-0g/actions/workflows/ci-smoke.yml)
![Build](https://img.shields.io/badge/build-passing-brightgreen)
![Tests](https://img.shields.io/badge/tests-smoke--round-lightgrey)
![Coverage](https://img.shields.io/badge/coverage-n%2Fa-inactive)
![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-0.2.0--poc-important)
[![Docs](https://img.shields.io/badge/docs-progress-blue)](https://github.com/balkeumlabs/tee-fl-0g/blob/rao/docs/progress.md)

# tee-fl-0g — Federated Learning on 0G (Galileo) with Access-Gated Updates, On-Chain Anchoring, and FedAvg


> <sub>Last update: 2025-09-15 20:56:16Z UTC</sub>

**Quick links:** [Install](#quick-start) · [Usage](#usage) · [Architecture](#visual-overview) · [Deep-Dive](#engineering-deep-dive) · [Roadmap](#roadmap-and-milestones)



## Summary

This repo ships a privacy-preserving federated-learning pipeline on the 0G Galileo testnet. Providers submit encrypted, access-gated updates; our diagnostics lane verifies integrity and policy decisions; contributions are scored and aggregated with FedAvg; and we anchor epoch/model hashes on-chain, publishing one model per round and listing it in the 0G Model Service Marketplace. Next: native 0G Storage CIDs, client-side encryption loaders, and richer attestation metadata.



## Visual Overview

![Visual Overview](./docs/img/visual_overview.png)

<details>
<summary>ASCII fallback</summary>

```text
Providers (TEE-sim) ── encrypted update.json ──▶ 0G Storage [CID]
         │                                        │
         └─ diagnostics (hashes, policy) ─────────┘
                                   │
AccessRegistry (gate) ◀────────────┤
                                   └──▶ EpochManager (submit → score → anchor)
                                             │
                                             ▼
                                   FedAvg Aggregation (round result)
                                             │
                                             ▼
                                   Global Model (hash + metadata)
                                             │
                                             ▼
                                   0G Model Service Marketplace (listing)
```
</details>




## Table of Contents

- [Summary](#summary)
- [Visual Overview](#visual-overview)
- [Quick Start](#quick-start)
- [Scope (This Phase)](#scope-this-phase)
- [Usage](#usage)
  - [Key scripts](#key-scripts)
  - [Typical flow (contracts → access → round)](#typical-flow-contracts--access--round)
  - [Secure round wrapper (one-shot, guarded)](#secure-round-wrapper-one-shot-guarded)
- [Configuration](#configuration)
  - [Required](#required)
  - [Storage](#storage)
  - [Encryption (providers & wrappers)](#encryption-providers--wrappers)
  - [Attestation (policy preview / future enforcement)](#attestation-policy-preview--future-enforcement)
  - [Safety & local toggles](#safety--local-toggles)
  - [Defaults & behavior](#defaults--behavior)
  - [Example `.env`](#example-env)
  - [Verify](#verify)
- [Deployment](#deployment)
  - [Network & Signer](#network--signer)
  - [Contracts](#contracts)
  - [One-Shot Deploy](#one-shot-deploy)
  - [Post-deploy Smoke](#post-deploy-smoke)
- [Observability](#observability)
  - [Scripted queries (Windows PowerShell)](#scripted-queries-windows-powershell)
  - [Local Artifacts & Hashes](#local-artifacts--hashes)
- [Engineering Deep-Dive](#engineering-deep-dive)
  - [System Model & Assumptions](#system-model--assumptions)
  - [Threat Model](#threat-model)
  - [Cryptography & Key Management](#cryptography--key-management)
  - [TEE Design & Attestation](#tee-design--attestation)
  - [Protocols & Algorithms (Round Flow)](#protocols--algorithms-round-flow)
  - [On-Chain Integration (0G/EVM)](#on-chain-integration-0gevem)
  - [Performance & Benchmarks](#performance--benchmarks)
  - [Reliability & Failure Modes](#reliability--failure-modes)
  - [Security & Privacy Validation](#security--privacy-validation)
  - [Reproducibility](#reproducibility)
  - [Artifacts & Evidence](#artifacts--evidence)
- [Engineering & Project Ops](#engineering--project-ops)
  - [Development](#development)
  - [Development — Policy & CI](#development--policy--ci)
  - [CI smoke](#ci-smoke)
  - [Byte-stability & EOL rules](#byte-stability--eol-rules)
  - [Verify locally](#verify-locally)
- [Roadmap and Milestones](#roadmap-and-milestones)
- [FAQ and Troubleshooting](#faq-and-troubleshooting)
- [Contributing and Code of Conduct](#contributing-and-code-of-conduct)
- [Versioning and Changelog Policy](#versioning-and-changelog-policy)
- [License and Notices](#license-and-notices)
- [Acknowledgements](#acknowledgements)


## Quick Start

Minimal, limitation-free path to a green end-to-end demo on 0G Galileo. Windows PowerShell first; Bash is optional.

### Prerequisites

- Windows 10/11, **PowerShell 7+**, **Node.js ≥ 18** (Node 20/22 OK), **npm ≥ 9**, **Git**
- Funded EVM key on **0G Galileo** (chainId **16601**)
- RPC endpoint: `https://evmrpc-testnet.0g.ai`


```powershell
# Verify
node -v
npm -v
git --version
# Expected: Node ≥ 18, npm ≥ 9.
```


### Clone and build

```powershell
Set-Location $env:USERPROFILE
git clone https://github.com/balkeumlabs/tee-fl-0g.git
Set-Location .\tee-fl-0g
npm ci
npm run build
npx hardhat compile --config .\hardhat.galileo.js

# Verify
Get-Item .\dist\crypto\encrypt_update.js
Get-ChildItem .\artifacts\contracts | Select-Object -First 3
# Expected: files exist in dist\crypto\ and contract artifacts under artifacts\contracts.
```

### Configure environment

> Copy `.env.example` to `.env` and set:  
- `PRIVATE_KEY` =0x... (test key for Galileo)
- `RPC_ENDPOINT` =https://evmrpc-testnet.0g.ai 
- `FL_ENC_MODE` =dev  
- `FL_TEE_PUBKEY_B64` =BASE64_X25519_PUBKEY
> Secrets: keep .env out of Git; repo includes .gitignore.


```powershell
# Verify
Select-String -Path .\.env -Pattern 'PRIVATE_KEY|RPC_ENDPOINT|FL_ENC_MODE|FL_TEE_PUBKEY_B64'
# Expected: each key present with a non-empty value.
```


### Sanity checks

```powershell
node .\scripts\check_balance_raw.js
'{"round":1,"weights":[0.1,0.2,0.3]}' | Set-Content -Encoding UTF8 .\sample_update.json
node .\dist\crypto\encrypt_update.js --in .\sample_update.json --out .\sample_update.enc.json
node .\dist\crypto\decrypt_update.js --in .\sample_update.enc.json --out .\sample_update.decrypted.json

# Verify
(Get-FileHash .\sample_update.json -Algorithm SHA256).Hash
(Get-FileHash .\sample_update.decrypted.json -Algorithm SHA256).Hash
# Expected: two identical SHA-256 hashes.
```


### Local aggregate

```powershell
node .\dist\local_normalize_and_aggregate.js --in-dir . --out-dir . --on-mismatch pad --force-path '$.weights'
$b=[IO.File]::ReadAllBytes('aggregated_model.json'); `
$h=[BitConverter]::ToString((New-Object Security.Cryptography.SHA256Managed).ComputeHash($b)).Replace('-','').ToLower(); `
"{`"file`":`"aggregated_model.json`",`"size`":$($b.Length),`"sha256`":`"$h`"}" | Set-Content -Encoding UTF8 aggregated_model.storage_meta.json

# Verify
Get-Content .\aggregated_model.storage_meta.json
# Expected: JSON with file, size, sha256.
```

### End-to-end demo

```powershell
node .\scripts\is_approved_raw.js --provider 0xYOUR_ADDRESS
node .\scripts\start_epoch_once_raw.js --epoch 3
node .\scripts\submit_update_checked_raw.js --file .\sample_update.enc.json --meta .\aggregated_model.storage_meta.json
node .\scripts\compute_scores_and_post_root_raw.js --epoch 3
node .\scripts\aggregate_and_publish_raw.js --epoch 3 --force-path '$.weights'
```

Expected output:
- Logs include scoresRoot, globalModelHash, globalModelCid
- (CID is simulated unless a Storage CID is provided/configured).



## Scope (This Phase)

**In Scope**
- Access gating on 0G Chain (AccessRegistry)
- Epoch lifecycle with FedAvg and on-chain anchoring
- Diagnostics lane (NO_TX): integrity + policy preview

**Out of Scope (This Phase)**
- Native 0G Storage CID issuance in workflows
- Enforced TEE attestation checks
- Marketplace invocation (pay-per-inference)



## Usage

### Key scripts
- `deploy_access_raw.js` — deploys **AccessRegistry** to 0G/EVM.
- `deploy_epoch_raw.js` — deploys **EpochManager**.
- `grant_access_raw.js` / `is_approved_raw.js` — manage/check provider approvals.
- `start_epoch_once_raw.js` — opens a single training epoch window.
- `submit_update_checked_raw.js` — posts an **encrypted** provider update + metadata checks.
- `compute_scores_and_post_root_raw.js` — computes scores and posts `scoresRoot`.
- `aggregate_and_publish_raw.js` — runs FedAvg and anchors `globalModelHash`/`globalModelCid`.
- `read_update_raw.js` / `read_epoch_meta_raw.js` — view submitted updates / epoch-level metadata.

> All scripts read RPC + keys from `.env`. Keep real secrets out of Git.



### Typical flow (contracts → access → round)

```powershell
# 1) Deploy contracts (once per environment)
node .\scripts\deploy_access_raw.js
node .\scripts\deploy_epoch_raw.js

# Verify
Get-Content .\deploy.out.json
# Expected: addresses for AccessRegistry and EpochManager
```

```powershell
# 2) Approve your provider address (allow-list on AccessRegistry)
node .\scripts\grant_access_raw.js --provider 0xYOUR_ADDRESS
node .\scripts\is_approved_raw.js --provider 0xYOUR_ADDRESS
# Expected output: true
```

```powershell
# 3) Start an epoch, submit update, score, aggregate, publish
node .\scripts\start_epoch_once_raw.js --epoch 3
node .\scripts\submit_update_checked_raw.js --file .\sample_update.enc.json --meta .\aggregated_model.storage_meta.json
node .\scripts\compute_scores_and_post_root_raw.js --epoch 3
node .\scripts\aggregate_and_publish_raw.js --epoch 3 --force-path '$.weights'
# Expected logs: scoresRoot, globalModelHash, globalModelCid, tx hashes
```

### Secure round wrapper (one-shot, guarded)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\dist\round_secure.ps1 `
  -RoundController .\round_controller.ps1 `
  -WorkDir .
```

What it enforces:
- Uses encryption helpers, refuses plaintext leaks.
- Leaves a small audit trail (hashes/paths) in the working dir.


```powershell
# Verify
Get-ChildItem . | Where-Object Name -match 'round|enc|meta|hash|log'
# Expected: encrypted payload(s), meta JSON, and a short log; no raw secrets

```



## Configuration

Set values in a local `.env` (never commit real secrets). Keys are grouped by purpose with sensible defaults.

### Required

- `PRIVATE_KEY` — **hex EVM key** used on 0G Galileo  
- `RPC_ENDPOINT` — EVM RPC (default: `https://evmrpc-testnet.0g.ai`)

### Storage

- `OG_STORAGE_MODE` — `manual` \| `ipfs-api`  
  - `manual`: you provide CIDs/URLs in metadata  
  - `ipfs-api`: scripts call your configured API/gateway
- `OG_STORAGE_API_BASE` — base URL for `ipfs-api`
- `OG_STORAGE_API_TOKEN` — bearer/key for the API (if required)
- `OG_GATEWAY_BASE` — public gateway base for CID reads

### Encryption (providers & wrappers)

- `FL_ENC_MODE` — `dev` \| `off`
  - `dev`: enable local X25519 + XChaCha20-Poly1305 helpers  
  - `off`: bypass encryption (tests only)
- `FL_TEE_PUBKEY_B64` — **required in `dev`** (recipient public key, Base64)
- `FL_TEE_PRIVKEY_B64` — optional (decrypt helpers, dev only)
- `FL_CLIENT_PRIVKEY_B64` — optional (client-side tests)
- `FL_ENC_DELETE_PLAINTEXT` — `1` to scrub plaintext after encrypt; `0` to keep files

### Attestation (policy preview / future enforcement)

- `TEE_ATTEST_MEAS_ALLOWLIST` — comma-separated measurements (e.g., MRENCLAVE)
- `TEE_ATTEST_ENCLAVE_ID` — enclave/service identifier for policy hooks

### Safety & local toggles

- `DRY_RUN` — `1` prints intended actions without sending write TXs (where supported)
- `LOCAL_UPLOAD` — `1` writes artifacts to a local folder during tests


### Defaults & behavior

| Key                       | Default                        | Effect                                          |
|---------------------------|--------------------------------|-------------------------------------------------|
| `RPC_ENDPOINT`            | `https://evmrpc-testnet.0g.ai` | EVM JSON-RPC endpoint for 0G Galileo            |
| `OG_STORAGE_MODE`         | `manual`                       | Use provided CIDs; skip API calls               |
| `FL_ENC_MODE`             | `dev`                          | Enable encrypt/decrypt helpers                  |
| `FL_ENC_DELETE_PLAINTEXT` | `1`                            | Remove plaintext after encrypt                  |
| `DRY_RUN`                 | `0`                            | Execute write paths instead of printing only    |
| `LOCAL_UPLOAD`            | `0`                            | Use remote/real upload paths if configured      |

Booleans accept `0/1`. Unset keys fall back to the defaults above.


### Example `.env`

```ini
# EVM / RPC
PRIVATE_KEY=0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
RPC_ENDPOINT=https://evmrpc-testnet.0g.ai

# Storage (switch to ipfs-api to enable client)
OG_STORAGE_MODE=manual
OG_STORAGE_API_BASE=
OG_STORAGE_API_TOKEN=
OG_GATEWAY_BASE=https://ipfs.io/ipfs/

# Encryption
FL_ENC_MODE=dev
FL_TEE_PUBKEY_B64=BASE64_X25519_PUBKEY_HERE
FL_TEE_PRIVKEY_B64=
FL_CLIENT_PRIVKEY_B64=
FL_ENC_DELETE_PLAINTEXT=1

# Attestation
TEE_ATTEST_MEAS_ALLOWLIST=
TEE_ATTEST_ENCLAVE_ID=

# Safety
DRY_RUN=0
LOCAL_UPLOAD=0
```

```powershell
# Verify

# Show required keys (masked) and effective toggles
$envPath = ".\.env"
if (-not (Test-Path $envPath)) { Write-Error "Missing .env"; exit 1 }

$kv = Get-Content $envPath | Where-Object { $_ -match '^\s*[^#].+=.*$' } |
  ForEach-Object {
    $k,$v = ($_ -split '=',2); [PSCustomObject]@{ Key=$k.Trim(); Value=$v.Trim() }
  }

$mask = {
  param($k,$v)
  if ($k -in 'PRIVATE_KEY','OG_STORAGE_API_TOKEN','FL_TEE_PRIVKEY_B64','FL_CLIENT_PRIVKEY_B64') {
    if ($v.Length -gt 8) { return ($v.Substring(0,4) + '…' + $v.Substring($v.Length-4)) } else { return '***' }
  }
  return $v
}

$show = 'PRIVATE_KEY','RPC_ENDPOINT','OG_STORAGE_MODE','OG_GATEWAY_BASE','FL_ENC_MODE','FL_TEE_PUBKEY_B64','FL_ENC_DELETE_PLAINTEXT','DRY_RUN','LOCAL_UPLOAD','TEE_ATTEST_MEAS_ALLOWLIST','TEE_ATTEST_ENCLAVE_ID'
$kv | Where-Object { $show -contains $_.Key } | ForEach-Object {
  "{0}={1}" -f $_.Key, (& $mask $_.Key $_.Value)
}

# Expected: All listed keys print; secrets are masked; toggles show 0/1.
```



## Deployment

Target: **0G Galileo** (chainId **16601**). Contracts are immutable—treat deploys as one-way and record addresses.

### Network & Signer

- **Network**: 0G Galileo (`https://evmrpc-testnet.0g.ai`)
- **Deployer / signer**: `0x9Ed57870379e28E32cb627bE365745dc184950dF`

### Contracts

- **AccessRegistry**: `0xE3bffF639B4522Fa3D1E72973f9BEc040504c21e`
- **EpochManager**:  `0x9341619f6B889A12bbb90BbE366405ce363Ab779`

Keep these in a tracked JSON (e.g., `deploy.out.json`) that scripts import at runtime.


### One-Shot Deploy

```powershell
# Dry-run first (prints tx targets/params when supported)
$env:DRY_RUN = '1'
node .\scripts\deploy_access_raw.js
node .\scripts\deploy_epoch_raw.js

# Real deploy
$env:DRY_RUN = '0'
node .\scripts\deploy_access_raw.js      | Tee-Object -FilePath .\deploy_access.log
node .\scripts\deploy_epoch_raw.js       | Tee-Object -FilePath .\deploy_epoch.log

# Persist addresses snapshot
$addr = @{
  network    = "0g-galileo"
  chainId    = 16601
  rpc        = "https://evmrpc-testnet.0g.ai"
  deployer   = "0x9Ed57870379e28E32cb627bE365745dc184950dF"
  AccessRegistry = "0xE3bffF639B4522Fa3D1E72973f9BEc040504c21e"
  EpochManager   = "0x9341619f6B889A12bbb90BbE366405ce363Ab779"
  timestampUtc   = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss 'UTC'")
}
$addr | ConvertTo-Json | Set-Content -Encoding UTF8 .\deploy.out.json

# Verify
Get-Content .\deploy.out.json
node .\scripts\is_approved_raw.js --provider 0x9Ed57870379e28E32cb627bE365745dc184950dF
# Expected: JSON with addresses; approval check prints true/false (depending on list)
```


### Post-deploy Smoke

```powershell
# Policy preview (diagnostics only)
node .\scripts\attestation_policy_preview.js --sample accept
node .\scripts\attestation_policy_preview.js --sample reject
# Expected: ACCEPT and REJECT samples printed

# Round skeleton (no external writes except chain txs)
node .\scripts\start_epoch_once_raw.js --epoch 3
node .\scripts\compute_scores_and_post_root_raw.js --epoch 3
```


## Observability

Quick ways to see what happened this epoch: on-chain state, approvals, hashes, and CI artifacts.

### Scripted queries (Windows PowerShell)

```powershell
# Epoch metadata (hashes, CIDs, scores root)
node .\scripts\read_epoch_meta_raw.js --epoch 3

# Provider approval status
node .\scripts\is_approved_raw.js --provider 0xYOUR_ADDRESS

# Verify
# Expected (sample):
# {
#   "epoch": 3,
#   "scoresRoot": "0x...",
#   "globalModelHash": "0x...",
#   "globalModelCid": "bafy...",
#   "publishedAt": "2025-09-20T12:34:56Z",
#   ...
# }
# true|false   # for is_approved_raw.js
```

### Local Artifacts & Hashes

```powershell
# List aggregation outputs and metadata
Get-ChildItem -Name .\aggregated_model*.json

# Recompute and compare SHA-256
$raw  = Get-Content .\aggregated_model.storage_meta.json -Raw | ConvertFrom-Json
$calc = (Get-FileHash $raw.file -Algorithm SHA256).Hash.ToLower()
"{0} (meta) vs {1} (recalc)" -f $raw.sha256, $calc
#Expected
#Filenames like aggregated_model.json and aggregated_model.storage_meta.json
#Printed line ends with identical hashes.
```


## Engineering Deep-Dive

### System Model & Assumptions
- **Actors**: Client (data owner), Provider (TEE / TEE-sim), Aggregator, **0G Chain** (EVM), **0G Storage**.
- **Trust**: Only TEEs may decrypt client payloads; orchestrator never handles plaintext.
- **Rounds**: Exactly **one** `publishModel` per epoch; epochs are append-only.
- **Determinism**: FedAvg and hash emission are deterministic for a given set of accepted updates.

### Threat Model
- **Assets**: Encrypted updates, global model weights, keys, attestation evidence, on-chain anchors.
- **Adversaries**: Malicious/Byzantine providers, curious storage readers, passive on-chain observers, replay/duplicate submitters.
- **Mitigations (current)**: Access gating on **AccessRegistry**, integrity via SHA-256 + manifest tail, on-chain anchoring (`scoresRoot`, `globalModelHash`, `globalModelCid`), NO_TX policy preview (ACCEPT/REJECT).
- **Next hardening**: Client-side encryption by default, attestation checks in the scoring path, duplicate/update-replay guards.

### Cryptography & Key Management
- **Algorithms**: Curve25519 key exchange (**X25519**) + AEAD (**XChaCha20-Poly1305**) for update encryption; **SHA-256** for integrity.
- **Nonces/AD**: Per-epoch nonces; include epoch/provider IDs as Associated Data for AEAD.
- **Key handling**: Dev keys via `.env`; production via Vault/KMS; decryption confined to TEEs.
- **Scrubbing**: `FL_ENC_DELETE_PLAINTEXT=1` removes plaintext after encryption.

### TEE Design & Attestation
- **Targets**: Intel SGX/TDX or AMD SEV-SNP.
- **Evidence (submit-time)**: JSON blob (e.g., `measurement`, `signer`, `svn`, `ts`) attached with the update metadata.
- **Policy**: Allow-list (`TEE_ATTEST_MEAS_ALLOWLIST`) evaluated in the scoring gate; NO_TX preview simulates ACCEPT/REJECT decisions.

### Protocols & Algorithms (Round Flow)
1. **Submit**: Provider → encrypted update (`update.enc.json`) → obtain CID (manual/API) → reference CID on-chain.
2. **Score**: Deterministic scoring → compute **`scoresRoot`** (Merkle root).
3. **Aggregate**: FedAvg over accepted updates → emit **`globalModelHash`** (SHA-256 of artifact).
4. **Publish**: `publishModel(globalModelCid, globalModelHash)` **once per epoch**.
5. **Discover**: Model listing prepared for the **0G Model Service Marketplace** (metadata bundle).

### On-Chain Integration (0G/EVM)
- **Network**: chainId **16601**; RPC `https://evmrpc-testnet.0g.ai`.
- **Anchors per epoch**: `scoresRoot`, `globalModelHash`, `globalModelCid`.
- **Contracts**: `AccessRegistry` (gating), `EpochManager` (round windows, anchoring, publish).

### Performance & Benchmarks
- **Baseline**: PoC logistic regression – seconds to publish per epoch on a dev workstation.
- **Next**: Capture timings for **N = 5–50** providers and report gas for `submit`, `postScoresRoot`, `publishModel`.

### Reliability & Failure Modes
- **Idempotence**: Epoch creation is idempotent; `publishModel` guarded one-shot.
- **Retries**: RPC retries with back-off; local artifacts/CIDs cached to allow re-publish in a new epoch if required.
- **Dupes**: Planned duplicate-update detection (hash/index-set guard) in scoring.

### Security & Privacy Validation
- **Now**: Secure wrapper prevents plaintext leakage; hashes anchored on-chain; NO_TX policy preview exercised in CI.
- **Next**: Encrypt-everywhere default, enforced attestation in scoring, storage-level integrity probes (size/hash checks).

### Reproducibility
- **Build/tooling**: `npm ci`; pinned compiler; fixed Hardhat config.
- **Provenance**: Log commit SHA, epoch ID, contract addresses, and artifact hashes in CI and local `*.storage_meta.json`.

### Artifacts & Evidence

**Local (dev)**
- `client_update_*.json` (clear), `client_update_*.enc.json` (encrypted),  
  `aggregated_model.json`, `aggregated_model.storage_meta.json` (size + SHA-256).

**On-chain (sample PoC logs)**
- Epoch 1: `scoresRoot=0x3606…bb157`; `globalModelCid=cid://simulated/global-1757444721`; `hash=0x5e47…38fc`; **published**  
- Epoch 2: `scoresRoot=0x391a…94fb`; `weights≈[0.01,-0.01,0.025]`; `globalModelCid=cid://simulated/global-1757446457`; `hash=0x2031…7278e`; **published**

Tip: keep a machine-readable `evidence.jsonl` appending `{ epoch, commit, scoresRoot, globalModelHash, globalModelCid, timestamp }` for audits and Marketplace listings.



## Engineering & Project Ops

### Development
- Layout: `contracts/`, `scripts/`, `dist/`, `docs/`
- **PowerShell-first** automation; **Visual Studio** preferred; VS Code optional

### Development — Policy & CI

Local policy is enforced via a **Git pre-commit hook**: it blocks plaintext client updates and requires an allow-listed attestation measurement. CI (NO_TX) mirrors these checks and produces SHA-256 evidence without requiring storage uploads.

**Pre-commit policy (local)**
- `scripts/guard_plaintext.ps1` — fails if `FL_TEE_PUBKEY_B64` is unset or any `client_update*.json` lacks `"ciphertext"`.
- `scripts/attestation_enforce.js` — ensures `attestation_example.json.measurement` is present in `attestation_allowlist.json`.

**One-time setup after cloning (installs the hook)**
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install_hooks.ps1
# Verify the hook exists (no extension)
Get-Item .\.git\hooks\pre-commit
```

**Quick self-test (hook should block plaintext, then pass after cleanup):**
```powershell
# Create a dummy PLAINTEXT update (no "ciphertext" field)
'{"round":123,"weights":[1,2,3]}' | Set-Content -Encoding UTF8 .\client_update_hook_test.json
# Force-add it despite .gitignore so the hook runs
git add -f .\client_update_hook_test.json
# Try to commit → EXPECT failure with guard error
git commit -m "test: hook should block plaintext"

# Cleanup and recheck
git reset HEAD .\client_update_hook_test.json
Remove-Item .\client_update_hook_test.json -Force
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\guard_plaintext.ps1  # EXPECT: OK
```

**CI smoke**  
- Workflow compiles, runs deterministic aggregation, computes SHA-256 evidence, enforces plaintext/attestation guards, and uploads artifacts.
- See runs under GitHub → Actions for branch rao.

**Byte-stability & EOL rules**  
- Aggregates and client updates are marked -text in .gitattributes to preserve exact bytes (future SHA/CID stability).
- Attestation JSON and docs normalized to LF to avoid noisy diffs.

**Verify locally:**
```powershell
# Expect: -text on aggregates/updates
git check-attr -a -- aggregated_model.json | Select-String text
git check-attr -a -- client_update_round1.enc.json | Select-String text
# Expect: text eol=lf on attestation JSON
git check-attr -a -- attestation_example.json | Select-String eol
```

### Roadmap and Milestones
1) Real 0G Storage CIDs wired into submit/publish paths  
2) Enforce client-side encryption; TEE-only decrypt  
3) Attestation metadata + verification in scoring  
4) CI smoke on PRs; badges green  
5) Contract extensions (attestation refs, inference receipts)  
6) Map final model into 0G Service Marketplace

### FAQ and Troubleshooting
- `publishModel` reverted → already published; open a new epoch  
- `isProviderApproved=false` → `grant_access_raw.js` for provider
- CIDs provided manually → set OG_STORAGE_MODE=manual (or switch to ipfs-api when configured)   
- Windows execution policy errors → use `-ExecutionPolicy Bypass`

### Contributing and Code of Conduct
- PRs with clear descriptions and logs; security-first etiquette

### Versioning and Changelog Policy
- Semver-ish tags for PoC milestones; per-PR changelog once CI is live

### License and Notices
- MIT; see `LICENSE`

### Acknowledgements
- 0G Labs (Galileo), Balkeum Labs team (Eli, Umar, Rao), open-source maintainers
