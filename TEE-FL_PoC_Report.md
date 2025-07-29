# TEE-FL PoC Report – Phase 2 (Local Training + 0g Integration)

**Project:** TEE-FL using 0g Galileo stack  
**Author:** Rao Ahmad  
**Repo:** https://github.com/balkeumlabs/flai-0g-poc  
**Report Date:** July 28, 2025  

---

## 1. Objective

To simulate a functional end-to-end Trusted Execution Environment + Federated Learning (TEE-FL) pipeline using the 0g Galileo testnet for:
- Storing model and data (0g Storage)
- Managing job submissions and completions on-chain
- Executing local training as a placeholder for future TEE compute

---


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

**Component	Tool / File	Description**

| Component           | Tool / File                 | Description                                      |
|---------------------|-----------------------------|--------------------------------------------------|
| Smart Contract       | `FLAIComputeJobs.sol`        | Manages job lifecycle and reward logic           |
| Upload to Storage    | `upload_to_0g_storage.ts`     | Uses `@0glabs/0g-ts-sdk` for manual upload       |
| Model & Data         | `model.json`, `data.json`    | Sample metadata and training input               |
| Simulated Compute    | `train_model.py`             | Logistic Regression (sklearn) with SHA256 hash   |
| Submission Scripts   | `submit_job.js`, `complete_job.js` | Registers and settles job via Hardhat     |
| Output Hash          | `trained_model.json`         | Locally generated model result                   |



## 4. What Was Actually Done

**0g Storage**
* Used SDK to upload model.json and data.json
* Verified Merkle root on 0g Storage Explorer
* CLI upload failed — fallback used

**Local Training (TEE Mock)**
* Ran logistic regression training locally
* Produced model output + calculated SHA256 hash
* Simulated trusted behavior (no external access)

**Smart Contract + On-chain Job Lifecycle**
* Deployed FLAIComputeJobs.sol on 0g Galileo
* Used Hardhat to:
  * Submit job with data/model hash
  * Complete job with result hash
  * Fetch job details via get_job.js


## 5. Key Commands

Compile & deploy contract
* npx hardhat compile
* npx hardhat run scripts/deploy_jobs.js --network galileo

Upload data & model to storage
* ts-node --esm upload_to_0g_storage.ts

Simulate compute
* python train_model.py

Submit and complete jobs
* npx hardhat run scripts/submit_job.js --network galileo
* npx hardhat run scripts/complete_job.js --network galileo
* npx hardhat run scripts/get_job.js --network galileo


## 6. Output Snapshot

- Trained model saved to trained_model.json
- Result Hash: 2d26ea410c336015ef19e1533a3abc91ddae00e3b6b79859aa337e5cea5b3a2f

- New Job Submitted with ID: 2
- Job 2 marked complete with result hash: 2d26ea410c336015ef19e1533a3abc91ddae00e3b6b79859aa337e5cea5b3a2f


## 7. Challenges and Workarounds

| Issue                          | Resolution                  |
|--------------------------------|-----------------------------|
| 0g Storage CLI not functional  | Used SDK + web UI           |
| 0g Compute CLI unavailable     | Simulated compute locally   |
| No TEE or encrypted data flow  | Deferred to future implementation |



## 8. Next Steps (Phase 3)
* Simulate aggregation of encrypted model updates (FedAvg)
* Add Docker containerization + encryption
* Await 0g Compute CLI or real TEE access
* Integrate global model tracking in smart contract
* Align with SubDAO logic and payment routing (FLAI spec)


## 9. Directory Layout

```bash
flai-0g-test/
├── contracts/
│   └── FLAIComputeJobs.sol           # On-chain job tracking smart contract
├── data.json                         # Sample federated input
├── model.json                        # Sample model metadata
├── trained_model.json                # Local output from training
├── train_model.py                    # Python script for mock TEE compute
├── scripts/
│   ├── deploy_jobs.js                # Deploy contract
│   ├── submit_job.js                 # Submit new compute job
│   ├── complete_job.js               # Complete a job with resultHash
│   ├── get_job.js                    # Read job details
├── upload_to_0g_storage.ts           # SDK-based file uploader (TS)
├── tsconfig.json                     # TS compiler config
├── .env                              # Private key for 0g deployment
├── .gitignore                        # Ignore artifacts and secrets
├── hardhat.config.js                 # EVM setup for 0g
├── package.json                      # Project metadata
└── README.md                         # This file
```



## 10. Prepared By

- Rao Ahmad
- Engineer, Balkeum Labs
- Mentors: Eli, Umer
- Windows 11 · Python 3.11 · Node 18 · Galileo Testnet