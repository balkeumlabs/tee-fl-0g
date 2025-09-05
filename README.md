Set-Content -Path README.md -Encoding UTF8 -Value @'
LAI + 0g Galileo PoC: TEE-FL Simulation

Summary
This project is a minimal but functional Trusted Execution Environment + Federated Learning (TEE-FL) simulation using 0g services on the Galileo testnet. It demonstrates a decentralized, privacy-preserving model training workflow where data and models are stored on 0g Storage, jobs are tracked and settled on-chain, and training is simulated locally (mocking TEE behavior).

Due to current limitations in the 0g stack:
- File uploads to 0g Storage via CLI failed, so files were uploaded using the SDK and confirmed in the web UI.
- 0g Compute CLI does not support general training jobs, so model training was executed locally, simulating TEE execution.
This PoC will serve as a foundation for future integration with live TEE providers and federated model aggregation.

Architecture
               +------------------------+
               |  data.json + model.json|
               +-----------+------------+
                           |
                           | (uploaded via SDK)
                           v
                 +---------+---------+
                 |       0g Storage   |
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

Directory Structure
flai-0g-test/
├── contracts/
│   └── FLAIComputeJobs.sol
├── data.json
├── model.json
├── trained_model.json
├── train_model.py
├── scripts/
│   ├── deploy_jobs.js
│   ├── submit_job.js
│   ├── complete_job.js
│   ├── get_job.js
│   ├── list-services.mjs              # 0G Serving: list providers
│   ├── market-setup.mjs               # 0G Serving: ensure ledger (OG decimals) + acknowledge
│   ├── market-ping.mjs                # 0G Serving: signed request + settlement
│   └── compute-flow.mjs               # Full working flow (reference)
├── upload_to_0g_storage.ts
├── tsconfig.json
├── .env
├── .gitignore
├── hardhat.config.js
├── package.json
└── README.md

Setup
Prerequisites
- Node.js (v18+)
- Python (v3.11+)
- Hardhat
- TypeScript + ts-node
- 0g testnet wallet (private key with test OG)

Install dependencies
npm install
pip install scikit-learn numpy

Configure .env
PRIVATE_KEY=0xYOUR_TEST_PRIVATE_KEY
RPC_ENDPOINT=https://evmrpc-testnet.0g.ai
# Optional for setup script:
LEDGER_OG=0.10
# Optional default provider:
# PROVIDER_ADDR=0xf07240Efa67755B5311bc75784a061eDB47165Dd

Core PoC Commands

Compile contracts
npx hardhat compile

Deploy FLAIComputeJobs.sol
npx hardhat run scripts/deploy_jobs.js --network galileo

Upload data/model files to 0g Storage (SDK)
ts-node --esm upload_to_0g_storage.ts

Submit a job
npx hardhat run scripts/submit_job.js --network galileo

Run training (mocked TEE compute)
python train_model.py
# Outputs a result hash (SHA256 of trained_model.json)

Complete job with result hash
npx hardhat run scripts/complete_job.js --network galileo

Query job info
npx hardhat run scripts/get_job.js --network galileo

0G Serving Marketplace (Updated: OG-decimal ledger)
Status
- Discovery works: providers + metadata are listed correctly.
- The end-to-end marketplace flow is **working** when funding the ledger in **OG decimals** (ether-style), not big-integer A0GI units.
- Flow: Ensure ledger (OG) → acknowledge provider → generate headers → call /chat/completions → processResponse (settlement).

Scripts
# list providers
npm run market:discover

# ensure ledger OG funding + acknowledge provider
npm run market:setup
# optional:
# LEDGER_OG=0.10 in .env
# PROVIDER_ADDR=0xf07240Efa67755B5311bc75784a061eDB47165Dd in .env

# signed request + settlement
npm run market:ping

# full demo flow (reference)
npm run market:compute

Example (from compute-flow.mjs)
- Selected provider: 0xf07240Efa67755B5311bc75784a061eDB47165Dd (llama-3.3-70b-instruct)
- Endpoint: http://50.145.48.92:30081/v1/proxy
- Model: phala/llama-3.3-70b-instruct
- Response: "The capital of France is Paris..."
- Settlement: processResponse → Valid / payment settled
- Ledger (OG): ~0.010000000000000000 → ~0.009999999999960000 (tiny cost)

Federated Aggregation (FedAvg) — WIP
- Goal: encrypt client updates, upload to 0g Storage (CIDs), record hashes on-chain per round, aggregate (mock TEE) → publish encrypted global model + hash.
- Current: initial FedAvg scaffolding is in progress; repo code updated separately. README/Report will be extended as the pipeline stabilizes.

Notes
- 0g Compute CLI for general training is not available; training is simulated locally.
- Provider endpoints are HTTP in testnet; OK for demo, not production.

License
MIT
'@
