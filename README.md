# FLAI + 0g Galileo PoC: TEE-FL Simulation


## Summary

This project is a minimal but functional Trusted Execution Environment + Federated Learning (TEE-FL) simulation using 0g services on the Galileo testnet. It demonstrates a decentralized, privacy-preserving model training workflow where data and models are stored on 0g Storage, jobs are tracked and settled on-chain, and training is simulated locally (mocking TEE behavior).

Due to current limitations in the 0g stack:
* File uploads to 0g Storage via CLI failed, so files were uploaded manually using the SDK and web UI.
* 0g Compute CLI does not support general training jobs, so model training was executed locally, simulating TEE execution.

This PoC will serve as a foundation for future integration with live TEE providers and federated model aggregation.


## Architecture

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



## Directory Structure

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



## Setup

**Prerequisites:**
* Node.js (v18+)
* Python (v3.11+)
* Hardhat
* TypeScript + ts-node
* 0g testnet wallet (private key)


**Install dependencies:**
* npm install
* pip install scikit-learn numpy
* Configure .env
* PRIVATE_KEY=your_private_key_without_0x


**Commands:**

* npx hardhat compile      // Compile contracts

* npx hardhat run scripts/deploy_jobs.js --network galileo      // Deploy FLAIComputeJobs.sol

* Manual via SDK (CLI not functional): ts-node --esm upload_to_0g_storage.ts      // Upload data/model files to 0g Storage

* npx hardhat run scripts/submit_job.js --network galileo      // Submit a job

* python train_model.py      // Run training (mocked TEE compute)
* Outputs a result hash (SHA256 of trained_model.json)      // Run training (mocked TEE compute)

* npx hardhat run scripts/complete_job.js --network galileo      // Complete job with result hash

* npx hardhat run scripts/get_job.js --network galileo      // Query job info


**Output Example:**

* Trained model saved to trained_model.json      // From train_model.py
* Result Hash: 2d26ea410c336015ef19e1533a3abc91ddae00e3b6b79859aa337e5cea5b3a2f      // From train_model.py

* New Job Submitted with ID: 2      // From submit_job.js

* Job 2 marked complete with result hash: 2d26ea410c336015ef19e1533a3abc91ddae00e3b6b79859aa337e5cea5b3a2f      // From complete_job.js


## Notes

* CLI upload of files to 0g Storage did not work, so we used SDK + manual confirmation via web UI.
* 0g Compute CLI only supports fine-tuning of pre-existing LLMs, so local training was used instead to simulate TEE behavior.
* Smart contract assumes the reward goes to whoever completes the job. Aggregation logic will be simulated in the next phase.


---

# 0G Serving Marketplace (Discovery → Headers → Request → Settlement)

This section adds a working path to call 0G Serving providers from the PoC.
Important: ledger amounts are OG decimals (ether style), not big integer A0GI.

**What this adds:**
* Discover providers and read their endpoint and model metadata.
* Fund your ledger in OG.
* Acknowledge a provider one time.
* Generate single-use auth headers.
* Call the provider’s /chat/completions and settle payment with processResponse.


## Additional files in scripts/

```bash
scripts/
├── list-services.mjs          # List marketplace providers, print endpoint + model + prices
├── market-setup.mjs           # Ensure ledger funded in OG and acknowledge provider
├── market-ping.mjs            # Generate headers, call provider, processResponse for settlement
└── compute-flow.mjs           # Full reference flow (wallet → ledger → ack → headers → request → settlement)
```


## Environment variables for marketplace
**Required:**
* PRIVATE_KEY=0xYOUR_TEST_PRIVATE_KEY
* RPC_ENDPOINT=https://evmrpc-testnet.0g.ai

**Optional:**
* LEDGER_OG=0.10                        # how much OG to ensure on your ledger (decimal)
* PROVIDER_ADDR=0xf07240Efa67755B5311bc75784a061eDB47165Dd   # default provider (llama-3.3-70b)
* PROMPT=Say hello from FLAI on 0G.                          # default prompt for market:ping


## Commands

**List providers:**
* npm run market:discover


**Ensure ledger funding in OG and acknowledge provider:**
* npm run market:setup


**Signed request to a provider and settlement:**
* npm run market:ping           // uses .env PROMPT by default
* npm run market:ping -- --provider 0xf07240Efa67755B5311bc75784a061eDB47165Dd --prompt "What is 2+2?"              // override at runtime


**Full end-to-end demo flow (reference):**
* npm run market:compute


## Expected output snapshot

**Provider discovery example:**

```bash
Found 3 services
  [1] deepseek-r1-70b | provider=0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3 | input=0.00000049 OG | output=0.00000114 OG
  [2] llama-3.3-70b-instruct | provider=0xf07240Efa67755B5311bc75784a061eDB47165Dd | input=0.000000000000000001 OG | output=0.000000000000000001 OG
  [3] Unknown | provider=0x6D233D2610c32f630ED53E8a7Cbf759568041f8f | input=0.0000009 OG | output=0.00000015 OG
```

**Working request and settlement example:**

```bash
Provider acknowledged.
Endpoint: http://50.145.48.92:30081/v1/proxy
Model: phala/llama-3.3-70b-instruct
Auth headers generated.

AI Response: The capital of France is Paris, ...
Chat ID: chatcmpl-ec0b004c80204774981d609908df8ebd
processResponse: Valid / payment settled

Ledger before: 0.010000000000000000 OG
Ledger after:  0.009999999999960000 OG
```


## Verification steps

* Check testnet OG balance on your wallet address.
* Run npm run market:setup and confirm it prints a final ledger balance in OG.
* Run npm run market:ping and confirm:
   * Endpoint and model print.
   * You receive an AI response and a Chat ID.
   * processResponse reports valid or prints a clear error.
   * Ledger decreases by a tiny amount in OG.



## Troubleshooting

* If you see AccountNotExists or Insufficient balance, ensure you ran npm run market:setup and that LEDGER_OG is set to a reasonable decimal like 0.10.
* If RPC issues occur, verify RPC_ENDPOINT=https://evmrpc-testnet.0g.ai.
* If imports fail on Node 22, note these scripts import the broker using createRequire for compatibility.

---


# Federated Aggregation (FedAvg) - WIP

## Goal

Encrypt client updates, upload to 0g Storage, record on-chain hashes per round, aggregate locally (mock TEE), and publish an encrypted global model and its hash.

## High level flow

* Clients train locally and produce encrypted gradients or deltas.
* Upload artifacts to 0g Storage. Save CIDs.
* Record round CIDs and SHA-256 hashes on-chain for audit.
* Aggregator loads artifacts, decrypts inside the mock TEE, runs FedAvg, outputs a new global model and hash.
* Store the global model in 0g Storage and keep its on-chain hash for verification.
* For pay-per-inference, call the 0G Serving marketplace using the scripts above.

## Status

Initial FedAvg scaffolding is in the repo. README and report will be extended as the pipeline stabilizes.