Set-Content -Path TEE-FL_PoC_Report.md -Encoding UTF8 -Value @'
TEE-FL PoC Report – Phase 2 (Local Training + 0g Integration)
Project: TEE-FL using 0g Galileo stack
Author: Rao Ahmad
Repo: https://github.com/balkeumlabs/tee-fl-0g
Report Date: July 28, 2025
Update: September 5, 2025 — 0G Serving marketplace flow validated (OG-decimal ledger)

1. Objective
Simulate an end-to-end Trusted Execution Environment + Federated Learning (TEE-FL) pipeline using the 0g Galileo testnet:
- Store model and data (0g Storage)
- Manage job submissions and completions on-chain
- Execute local training as a placeholder for future TEE compute
- Integrate with 0G Serving marketplace for pay-per-inference

2. Architecture Overview
                   +------------------------+
                   |  data.json + model.json|
                   +-----------+------------+
                               |
                               | (uploaded via SDK)
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

3. Implementation Summary
Component                   Tool / File                       Description
Smart Contract              FLAIComputeJobs.sol               Manages job lifecycle and reward logic
Upload to Storage           upload_to_0g_storage.ts           Uses @0glabs/0g-ts-sdk for uploads
Model & Data                model.json, data.json             Sample metadata and training input
Simulated Compute           train_model.py                    Logistic Regression (sklearn) + SHA256
Submission Scripts          submit_job.js, complete_job.js    Registers and settles job via Hardhat
Read Job                    get_job.js                        Fetch job details
Marketplace (discovery)     list-services.mjs                 Lists providers + metadata
Marketplace (setup)         market-setup.mjs                  Ensures ledger OG funding + acknowledge
Marketplace (ping)          market-ping.mjs                   Signed request + settlement
Full Flow (reference)       compute-flow.mjs                  Working end-to-end flow (JS, no ts-node)

4. What Was Actually Done
0g Storage
- Uploaded model.json and data.json via SDK; verified in UI.
- CLI upload attempts failed; SDK + web UI used instead.

Local Training (TEE Mock)
- Ran logistic regression locally on sklearn diabetes.
- Produced trained_model.json and SHA256 result hash.

Smart Contract + On-chain Job Lifecycle
- Deployed FLAIComputeJobs.sol on 0g Galileo.
- Submitted job with data/model hashes, completed job with result hash, and fetched job details.

0G Serving Marketplace (Updated)
- Key correction: broker ledger amounts are **OG decimals** (ether-style), not big-integer A0GI units.
- Working flow:
  1) Ensure ledger exists and is funded, e.g. LEDGER_OG=0.10
  2) Acknowledge provider (one-time per provider)
  3) Get service metadata
  4) Get request headers (single-use)
  5) Call provider /chat/completions
  6) processResponse() for verification + payment settlement

- Observed run (reference):
  Provider: 0xf07240Efa67755B5311bc75784a061eDB47165Dd (llama-3.3-70b-instruct)
  Endpoint: http://50.145.48.92:30081/v1/proxy
  Model: phala/llama-3.3-70b-instruct
  Response: "The capital of France is Paris..."
  Chat ID: chatcmpl-ec0b004c80204774981d609908df8ebd
  Settlement: processResponse → Valid / payment settled
  Ledger OG (approx.): 0.010000000000000000 → 0.009999999999960000

5. Key Commands
Compile & deploy contract
npx hardhat compile
npx hardhat run scripts/deploy_jobs.js --network galileo

Upload data & model to storage
ts-node --esm upload_to_0g_storage.ts

Simulate compute
python train_model.py

Submit and complete jobs
npx hardhat run scripts/submit_job.js --network galileo
npx hardhat run scripts/complete_job.js --network galileo
npx hardhat run scripts/get_job.js --network galileo

0G Serving marketplace
npm run market:discover
npm run market:setup
npm run market:ping
npm run market:compute

6. Output Snapshot
Trained model saved to trained_model.json
Result Hash: 2d26ea410c336015ef19e1533a3abc91ddae00e3b6b79859aa337e5cea5b3a2f
New Job Submitted with ID: 2
Job 2 marked complete with result hash: 2d26ea410c336015ef19e1533a3abc91ddae00e3b6b79859aa337e5cea5b3a2f
Marketplace: llama-3.3-70b-instruct returned a valid answer; payment settled.

7. Challenges and Resolutions
Issue                                   Resolution
0g Storage CLI not functional           Used SDK + web UI
0g Compute CLI unavailable              Simulated compute locally
A0GI big-int assumption                 Corrected to OG decimals (ether-style) on ledger
Missing per-provider account function   Not required in this flow; ledger funding + acknowledge works

8. Federated Aggregation (FedAvg) – WIP
- Encrypt client updates, upload CIDs to 0g Storage, record hashes on-chain per round.
- Aggregator (mock TEE) performs FedAvg and publishes encrypted global model + hash.
- Repo code scaffolding has started; docs will be updated as pieces solidify.

9. Lessons Learned
- Use OG decimal amounts for ledger funding; format with formatEther for clarity.
- ESM/CJS interop on Node 22 is easiest via createRequire when importing the broker.
- Testnet providers currently use HTTP endpoints; fine for demos.

10. Next Steps
- Parameterize provider/model in scripts; add round-by-round artifacts to README.
- Extend FedAvg path with encrypted upload + on-chain attestations per round.
- Prepare a simple end-to-end demo: submit job → local train (mock TEE) → upload → on-chain hash → pay-per-inference via marketplace.

'@
