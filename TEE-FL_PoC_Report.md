# TEE-FL PoC Report – Phase 2 (Local Training + 0g Integration)

**Project:** TEE-FL using 0g Galileo stack  
**Author:** Rao Ahmad  
**Repo:** https://github.com/balkeumlabs/flai-0g-poc  
**Report Date:** September 5, 2025

---

## 1. Objective

To simulate a functional end-to-end Trusted Execution Environment + Federated Learning (TEE-FL) pipeline using the 0g Galileo testnet for:
* Storing model and data (0g Storage)
* Managing job submissions and completions on-chain
* Executing local training as a placeholder for future TEE compute
* Integrating 0G Serving marketplace to allow pay-per-inference calls using 0G providers



## 2. Architecture Overview

```plaintext
                   +------------------------+
                   |  data.json + model.json|
                   +-----------+------------+
                               |
                               | (uploaded manually)
                               v
                     +---------+---------+
                     |     0g Storage     |
                     +---------+---------+
                               |
          submitJob()         |        completeJob(resultHash)
             via JS           |              via JS
                               v
                  +------------+-------------+
                  |   FLAIComputeJobs.sol    | <-- on 0g Galileo
                  +------------+-------------+
                               ^
                               |
         run logistic_regression locally (TEE simulation)
```



## 3. Implementation Summary

### Component	Tool / File	Description:
```bash
| Component           | Tool / File                         | Description                                           |
|---------------------|-------------------------------------|-------------------------------------------------------|
| Smart Contract       | `FLAIComputeJobs.sol`              | Manages job lifecycle and reward logic                |
| Upload to Storage    | `upload_to_0g_storage.ts`          | Uses `@0glabs/0g-ts-sdk` for manual upload            |
| Model & Data         | `model.json`, `data.json`          | Sample metadata and training input                    |
| Simulated Compute    | `train_model.py`                   | Logistic Regression (sklearn) with SHA256 hash        |
| Submission Scripts   | `submit_job.js`, `complete_job.js` | Registers and settles job via Hardhat                 |
| Output Hash          | `trained_model.json`               | Locally generated model result                        |
| Marketplace Discovery| list-services.mjs                  | Lists available providers and metadata                |
| Marketplace Setup    | market-setup.mjs                   | Ensures ledger funding in OG and acknowledge provider |
| Marketplace Ping     | market-ping.mjs                    | Signed request to provider with payment settlement    |
| Full Compute Flow    | compute-flow.mjs                   | Full demo flow integrating 0G Serving marketplace     |
```


## 4. What Was Actually Done

### 0g Storage:
* Used SDK to upload model.json and data.json
* Verified Merkle root on 0g Storage Explorer
* CLI upload failed — fallback used

### Local Training (TEE Mock):
* Ran logistic regression training locally
* Produced model output + calculated SHA256 hash
* Simulated trusted behavior (no external access)

### Smart Contract + On-chain Job Lifecycle:
* Deployed FLAIComputeJobs.sol on 0g Galileo
* Used Hardhat to:
  * Submit job with data/model hash
  * Complete job with result hash
  * Fetch job details via get_job.js

### 0G Serving Marketplace Integration

* **Discovery works:** list-services.mjs successfully lists available providers, models, and their respective prices in OG.
* **Marketplace Flow:**
  * Ensure ledger funding (in OG decimals) using market-setup.mjs.
  * Acknowledge the provider with market-ping.mjs and process payment via processResponse.
  * Tested successfully: AI responses retrieved, validated, and ledger payment settled.

### Output Snapshot

* **Trained Model:** Saved as trained_model.json
* **Result Hash:** 2d26ea410c336015ef19e1533a3abc91ddae00e3b6b79859aa337e5cea5b3a2f
* **New Job Submitted with ID:** 2
* **Job 2 marked complete with result hash:** 2d26ea410c336015ef19e1533a3abc91ddae00e3b6b79859aa337e5cea5b3a2f

### Marketplace Discovery Example:
```bash
Found 3 services
  [1] deepseek-r1-70b | provider=0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3 | input=0.00000049 OG | output=0.00000114 OG
  [2] llama-3.3-70b-instruct | provider=0xf07240Efa67755B5311bc75784a061eDB47165Dd | input=0.000000000000000001 OG | output=0.000000000000000001 OG
  [3] Unknown | provider=0x6D233D2610c32f630ED53E8a7Cbf759568041f8f | input=0.0000009 OG | output=0.00000015 OG
```

###   AI Response Example:
```bash
AI Response: The capital of France is Paris, a city known for its iconic landmarks, rich history, and cultural significance.
Chat ID: chatcmpl-ec0b004c80204774981d609908df8ebd
```



## 5. Key Commands

### Compile & deploy contract
* npx hardhat compile
* npx hardhat run scripts/deploy_jobs.js --network galileo

### Upload data & model to storage
* ts-node --esm upload_to_0g_storage.ts

### Simulate compute
* python train_model.py

### Submit and complete jobs
* npx hardhat run scripts/submit_job.js --network galileo
* npx hardhat run scripts/complete_job.js --network galileo
* npx hardhat run scripts/get_job.js --network galileo

### 0G Serving marketplace flow:
* npm run market:discover
* npm run market:setup
* npm run market:ping
* npm run market:compute


## 6. Output Snapshot

- **Trained model saved to** trained_model.json
- **Result Hash:** 2d26ea410c336015ef19e1533a3abc91ddae00e3b6b79859aa337e5cea5b3a2f
- **New Job Submitted with ID:** 2
- **Job 2 marked complete with result hash:** 2d26ea410c336015ef19e1533a3abc91ddae00e3b6b79859aa337e5cea5b3a2f


## 7. Challenges and Workarounds

```bash
| Issue                                           | Resolution                                                              |
|-------------------------------------------------|-------------------------------------------------------------------------|
| 0g Storage CLI not functional                   | Used SDK + web UI                                                       |
| 0g Compute CLI unavailable                      | Simulated compute locally                                               |
| No TEE or encrypted data flow                   | Deferred to future implementation                                       |
| Insufficient funds for marketplace		          | Ensure ledger is funded in OG decimals (not big integer A0GI units).    |
| Missing per-provider account creation function  | Resolved by using ledger funding and provider acknowledgment in the SDK |
```



## 8. Federated Aggregation (FedAvg)

### Goal:

Encrypt client updates, upload CIDs to 0g Storage, record hashes on-chain per round, aggregate locally (mock TEE), and publish an encrypted global model and its hash.

### High level flow:

* Clients train locally and produce encrypted gradients or deltas.
* Upload artifacts to 0g Storage. Save CIDs.
* Record round CIDs and SHA-256 hashes on-chain for audit.
* Aggregator loads artifacts, decrypts inside the mock TEE, runs FedAvg, outputs a new global model and hash.
* Store the global model in 0g Storage and keep its on-chain hash for verification.
* For pay-per-inference, call the 0G Serving marketplace using the scripts above.

### Status:

Initial FedAvg scaffolding is in the repo. README and report will be extended as the pipeline stabilizes.


## Encrypted FedAvg (Round 1)

This phase simulates the encrypted client updates, local aggregation (TEE-sim), and anchoring of the global model hash on-chain.

### Goal:
- Encrypt client updates.
- Upload to 0g Storage, record hashes on-chain.
- Aggregate locally using mock TEE behavior (FedAvg).
- Publish an encrypted global model and store its on-chain hash.

### High-Level Flow:
1. Clients generate encrypted updates using X25519 + AES-GCM.
2. Upload artifacts to 0g Storage and save CIDs.
3. Record round CIDs and SHA-256 hashes on-chain for audit.
4. Aggregator decrypts the artifacts, runs FedAvg, and outputs a new global model.
5. Store the global model in 0g Storage and keep its on-chain hash.

### Artifacts:
- `out/round-1/client-A.cipher.json`, `out/round-1/client-B.cipher.json`
- `out/round-1/global_model.npy`, `out/round-1/global_model.json`

### On-Chain:
- Contract (jobs): `<CONTRACT_ADDRESS>`
- Anchor tx: `<TX_HASH>`
- Calldata format: `0x464c4149` ("FLAI") + `round(uint32 BE)` + `keccak(bytes32)`

### How to Verify:
```powershell
# Receipt status
$rc = Invoke-RestMethod -Uri $env:EVM_RPC -Method Post -ContentType 'application/json' -Body (@{ jsonrpc="2.0"; id=1; method="eth_getTransactionReceipt"; params=@($TX) } | ConvertTo-Json)
$rc.result.status   # expect 0x1

# Calldata
$tx = Invoke-RestMethod -Uri $env:EVM_RPC -Method Post -ContentType 'application/json' -Body (@{ jsonrpc="2.0"; id=1; method="eth_getTransactionByHash"; params=@($TX) } | ConvertTo-Json)
[string]$tx.result.input
```


## 9. Lessons Learned

* Use OG decimal amounts for ledger funding; format with formatEther for clarity.
* ESM/CJS interop on Node 22 is easiest via createRequire when importing the broker.
* Testnet providers currently use HTTP endpoints; fine for demos, but not production.


## 9. Next Steps

* Parameterize provider/model in scripts; add round-by-round artifacts to README.
* Extend FedAvg path with encrypted upload + on-chain attestations per round.
* Prepare a simple end-to-end demo: submit job → local train (mock TEE) → upload → on-chain hash → pay-per-inference via marketplace.

## Update (2025-09-09T20:39:23Z)

<!-- BL-REPORT-docs/raoah-readme-report-20250910-0139 -->

### Progress snapshot (then → now)
| Task | % complete then | % complete now | Notes (why this score) |
|---|---:|---:|---|
| Repo bootstrap & installs | 70 | 100 | Lock drift fixed; reproducible \
pm ci\. |
| Hardhat config & compile | 30 | 100 | Minimal \hardhat.galileo.js\ with .env; clean compile. |
| Contracts (AccessRegistry, EpochManager) | 50 | 100 | Deployed and exercised core paths. |
| Deploy to Galileo | 0 | 100 | Both contracts deployed; \.addresses.json\ committed. |
| Epoch lifecycle (start/submit/read) | 20 | 100 | Epochs 1–3 exercised; event-based readers. |
| Event-based update indexer | 0 | 100 | \ead_update_raw.js\ reconstructs updates from logs. |
| Scoring root (compute + post) | 0 | 100 | Deterministic dummy scores → Merkle root on-chain. |
| Aggregation & publish (FedAvg) | 10 | 100 | Aggregated JSON + SHA-256; immutable publish per epoch. |
| Access control gating (off-chain) | 0 | 80 | \submit_update_checked_raw.js\ enforces approvals; not yet used everywhere. |
| Round orchestrator | 0 | 80 | \ound_controller.ps1\ runs full loop. |
| 0G Storage integration (real CIDs) | 70 | 70 | Uploader exists; demo still uses simulated CIDs. |
| Data encryption before upload | 20 | 20 | Planned, not yet enforced in scripts. |
| TEE simulation + attestation placeholders | 20 | 30 | Stronger skeleton; RA not implemented. |
| TEE scoring service (real) | 0 | 0 | Pending enclave + attestation. |
| TEE aggregation service (real) | 0 | 0 | Pending enclave + attestation. |
| Inference via 0G Service Marketplace | 0 | 0 | Not started. |
| Payments/rewards distribution | 0 | 0 | Not started. |
| Governance/SubDAO registries | 0 | 0 | Not started. |
| CI/CD + smoke tests | 0 | 10 | No GH Actions yet; candidates identified. |
| Documentation (README + Report) | 60 | 80 | This update brings docs in sync with current flow. |

### On-chain runs (Galileo)
- AccessRegistry: \ xE3bffF639B4522Fa3D1E72973f9BEc040504c21e\  
- EpochManager:   \ x9341619f6B889A12bbb90BbE366405ce363Ab779\

**Epoch 1**
- updates: 1  
- scoresRoot: \ x3606b407a32ff354665b0466c0a66f1d23b53e11e24646a437a5c086bf0bb157\  
- publish:  
  - globalModelCid: \cid://simulated/global-1757444721\  
  - globalModelHash: \ x5e47909ae238ac0486826478017e6f5ee1da68c6e8f528249bc858d2bce838fc\  
  - published: \	rue\

**Epoch 2**
- updates: 2  
- scoresRoot: \ x391a54342f48a1229d7f87afbbce4593538f0ad05274ae0befc3477ee4c194fb\  
- FedAvg weights ≈ \[0.01, -0.01, 0.025]\  
- publish:  
  - globalModelCid: \cid://simulated/global-1757446457\  
  - globalModelHash: \ x2031283ac53a2e8b1c6438b20913bee3b5099e056acb3fd60ea7ae106aed278e\  
  - published: \	rue\

### Access control gating (how to)
1. Attempt submit with \submit_update_checked_raw.js\ → expect failure if not approved.  
2. Grant via \grant_access_raw.js\ for \(owner, provider, datasetCid, modelHash)\.  
3. Retry submit → success; then post scoresRoot and publish.

### Next steps
- Replace simulated CIDs with real 0G storage CIDs in submit/publish.
- Add attestation artifacts (quote/measurement) and verify in scoring.
- Minimal CI workflow to compile + smoke a local round with mocks.
