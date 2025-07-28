## FLAI + 0g Galileo PoC: TEE-FL Simulation

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

<pre><code>```bash flai-0g-test/ ├── contracts/ │ └── FLAIComputeJobs.sol # On-chain job tracking smart contract ├── data.json # Sample federated input ├── model.json # Sample model metadata ├── trained_model.json # Local output from training ├── train_model.py # Python script for mock TEE compute ├── scripts/ │ ├── deploy_jobs.js # Deploy contract │ ├── submit_job.js # Submit new compute job │ ├── complete_job.js # Complete a job with resultHash │ ├── get_job.js # Read job details ├── upload_to_0g_storage.ts # SDK-based file uploader (TS) ├── tsconfig.json # TS compiler config ├── .env # Private key for 0g deployment ├── .gitignore # Ignore artifacts and secrets ├── hardhat.config.js # EVM setup for 0g ├── package.json # Project metadata └── README.md # This file ```</code></pre>



## Setup

**Prerequisites**

* Node.js (v18+)
* Python (v3.11+)
* Hardhat
* TypeScript + ts-node
* 0g testnet wallet (private key)


**Install dependencies**

* npm install
* pip install scikit-learn numpy
* Configure .env
* PRIVATE_KEY=your_private_key_without_0x


**Commands**

Compile contracts
* npx hardhat compile

Deploy FLAIComputeJobs.sol
* npx hardhat run scripts/deploy_jobs.js --network galileo

Upload data/model files to 0g Storage
* Manual via SDK (CLI not functional): ts-node --esm upload_to_0g_storage.ts

Submit a job
* npx hardhat run scripts/submit_job.js --network galileo

Run training (mocked TEE compute)
* python train_model.py
* Outputs a result hash (SHA256 of trained_model.json)

Complete job with result hash
* npx hardhat run scripts/complete_job.js --network galileo

Query job info
* npx hardhat run scripts/get_job.js --network galileo


**Output Example**

From train_model.py
* Trained model saved to trained_model.json
* Result Hash: 2d26ea410c336015ef19e1533a3abc91ddae00e3b6b79859aa337e5cea5b3a2f

From submit_job.js
* New Job Submitted with ID: 2

From complete_job.js
* Job 2 marked complete with result hash: 2d26ea410c336015ef19e1533a3abc91ddae00e3b6b79859aa337e5cea5b3a2f

## Notes

CLI upload of files to 0g Storage did not work, so we used SDK + manual confirmation via web UI.
0g Compute CLI only supports fine-tuning of pre-existing LLMs, so local training was used instead to simulate TEE behavior.
Smart contract assumes the reward goes to whoever completes the job. Aggregation logic will be simulated in the next phase.

## Next Steps

Add aggregation simulation (FedAvg) across multiple clients
Connect to a real TEE provider when supported
Expand input/output file formats and validations
Integrate SubDAO governance and revenue flow per FLAI spec

## License

MIT