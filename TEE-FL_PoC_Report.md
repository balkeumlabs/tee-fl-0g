# TEE-FL + 0g: PoC Report

**Project:** TEE-FL using 0g Galileo stack  
**Author:** Rao Ahmad  
**Repo:** https://github.com/balkeumlabs/tee-fl-0g  
**Report Date:** July 24, 2025

---

## Overview

This document summarizes the goals, implementation, results, and verification of the first Proof-of-Concept (PoC) for integrating Trusted Execution Environments + Federated Learning (TEE-FL) with the 0g Galileo testnet. It is designed to make the repo self-explanatory to anyone reviewing the work, manager, team member, or external partner.

This PoC was developed under instructions from the Balkeum Labs team to:

- Build a functional FL job pipeline  
- Use 0g for storage and on-chain job tracking  
- Upload model + input data  
- Simulate rewards for compute jobs  

---

## Architecture Summary

**Components Built:**

- `FLAIComputeJobs.sol`: Smart contract that tracks FL compute jobs on 0g  
- `submit_job.js`, `complete_job.js`, `get_job.js`: Scripts to simulate FL job lifecycle  
- `upload_to_0g_storage.ts`: TypeScript uploader to 0g Storage via `@0glabs/0g-ts-sdk`  
- `model.json` and `data.json`: Sample model metadata and input tensor  
- Project is built with Hardhat, connected to 0g Galileo RPC, and developed on Windows  

**Contract Structure:**

```solidity
struct Job {
    address client;
    string modelHash;
    string inputHash;
    string resultHash;
    uint256 fee;
    bool completed;
}
```

## Flow:

Upload files to 0g Storage → get Merkle root hash
Call submitJob() with those hashes + fee
Call completeJob() with output result hash
Smart contract emits logs and transfers reward

**Outputs and Verifications**
Deployment
Contract deployed to:
0x57a069a1c980a1E7577b9094b15968A2962d7b33
Confirmed on 0g Explorer.

## Job Submission:

npx hardhat run scripts/submit_job.js --network galileo
Output:
Submitted job ID: 0
Job Completion

npx hardhat run scripts/complete_job.js --network galileo
Output:
Job 0 marked as complete with result hash: QmResultHashExample789
Job Retrieval

npx hardhat run scripts/get_job.js --network galileo
Output:
Job 0
Client: 0x9Ed57870379e28E32cb627bE365745dc184950dF
Model Hash: QmModelHashExample123
Input Hash: QmInputHashExample456
Result Hash: QmResultHashExample789
Fee: 0.01 OG
Completed: true
0g Storage Uploads

Used upload_to_0g_storage.ts and the 0g SDK to upload:
model.json
data.json

Example file hashes seen on https://storagescan-galileo.0g.ai:

0x635d8733affec9beb3834d5d9b661fedc8e8e531f48b2e9ed9ab8a4cf3a01a5a  
0x2260b090d4442056cd997b0aa791ed4db56948d765ddb4b6a6843f4a42657bd5
Status, Merkle positions, and block inclusion were verified.
Job 1: Real Compute Submission

Used run_logistic_diabetes.py (scikit-learn’s diabetes dataset with LogisticRegression):
Accuracy: 0.8045

Result hash submitted to contract:
f4247a08c3bf4ea001e6c2074e045572ea508a58dc4cca0d44d7e367676d09b7


## Verification Summary

| Task                | Verified | Method                  |
|---------------------|----------|--------------------------|
| Contract deployed   | Yes      | 0g Explorer              |
| Job submitted       | Yes      | Hardhat script logs      |
| Job marked complete | Yes      | Smart contract call      |
| Data uploaded       | Yes      | 0g Storage Explorer      |
| Result readable     | Yes      | `get_job.js`             |
| Reward sent         | Yes      | Solidity `transfer()`    |


### Files in This Repo

| File                          | Purpose                              |
|-------------------------------|---------------------------------------|
| `FLAIComputeJobs.sol`         | Smart contract for FL jobs           |
| `submit_job.js`               | Job submission script                |
| `complete_job.js`             | Complete job with result hash        |
| `get_job.js`                  | Retrieve job status and metadata     |
| `upload_to_0g_storage.ts`     | Upload model/input to 0g storage     |
| `model.json`, `data.json`     | Mock model and input data            |
| `run_logistic_diabetes.py`    | Local FL compute with result hashing |
| `TEE-FL_PoC_Report.md`        | This full report                     |
| `README.md`                   | Project overview and setup           |


## Lessons Learned:

0g Galileo is EVM-compatible and easy to deploy with Hardhat
File uploads are reliable and produce traceable Merkle roots
The job smart contract logic handles off-chain results effectively
Git casing issues (README.md vs Readme.md) can be problematic on Windows and need caution



## Phase 2: Compute Task Preparation (TEE-Ready)

This phase focused on preparing a Dockerized ML training task to be executed on a TEE-backed compute node in the 0g Network.

---

### Step 1: Isolated Compute Job Setup

- Created a dedicated folder: `tee_fl_node/` under the main project directory
- Wrote a Python training script (`train.py`) to train a logistic regression model on the scikit-learn diabetes dataset
- Added a `Dockerfile` to install dependencies (`scikit-learn`, `joblib`) and run the training

---

### Step 2: Local Testing in Docker

- Built the Docker image using the command:
docker build -t tee-fl-logreg .

- Ran the container to verify training:
docker run --rm tee-fl-logreg

**Result:**  
Model trained successfully inside the container.  
Accuracy: 0.7640


**Output Artifacts:**  
- `model.pkl` – trained model (saved inside container)
- `metrics.json` – serialized accuracy score

---

### Step 3: Uploading Compute Config to 0g Storage

- Created a `config.json` file describing the compute parameters and training script path
- Attempted upload using our existing `upload_to_0g_storage.ts` script

**Issue:**  
The RPC endpoint (`rpc.0g-chain.dev`) failed to resolve due to DNS issues (same as previously observed)

**Workaround:**  
Manually uploaded `config.json` using the 0g Labs web uploader

**Merkle Root Returned:**  
0x7e6b87dcc37ab07c1e970224b7806a6c5dd5d0123811b0466d22141c7f76b525


---

### Step 4: CLI Blocker

- Next step would be to submit a compute job using `0g-compute-cli`
- CLI is referenced in all official 0g documentation and required for:
  - Submitting compute jobs
  - Choosing TEE-backed providers
  - Decrypting model outputs
- We tried:
  - Installing via npm → 404 error
  - Cloning from GitHub → repo not found

No working install path is publicly available

---

### Current Status

All prep work is complete:
- Training logic works
- Docker image builds cleanly
- Output is accurate
- Config is uploaded and hash received

But we are blocked on:
> Access to the official `0g-compute-cli` tool to submit the job to a TEE-backed provider.

---

### Next Steps

- Request CLI access from 0g Labs via Discord or through manager
- Once available:
  - Run `create-task` with the config hash and Docker model name
  - Track and decrypt results
  - Optionally post result hash to `FLAIComputeJobs` smart contract