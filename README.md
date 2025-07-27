# TEE-FL + 0g PoC

This is the first Proof-of-Concept implementation of Trusted Federated Learning (TEE-FL) using 0g's Galileo stack. The goal is to simulate a basic federated job lifecycle that integrates 0g’s on-chain compute tracking and decentralized storage services.

[Full Report → TEE-FL\_PoC\_Report.md](TEE-FL_PoC_Report.md)

## Objectives

* Build a minimal compute job manager smart contract
* Deploy and interact with it on the 0g Galileo testnet
* Upload sample model and input data to 0g Storage
* Simulate reward-based job completion using hashes





\## Phase 2: Currently Working on Preparing Compute Job for 0g TEE



We built and verified a logistic regression training task in a Docker container. The model is trained on scikit-learn's diabetes dataset and outputs accuracy along with the model file and metrics.



\### What's Working:

\- `train.py` performs binary classification via logistic regression

\- Packaged into Docker with all dependencies (Python 3.10, scikit-learn, joblib)

\- Tested locally: `Accuracy: ~0.76`

\- `config.json` uploaded to 0g Storage successfully

\- Merkle root hash received: `0x7e6b87dcc37ab07c1e970224b7806a6c5dd5d0123811b0466d22141c7f76b525`



\### Current Blocker:

\- The CLI (`0g-compute-cli`) required to submit fine-tuning jobs is not publicly available via npm or GitHub.

\- Attempted install methods: npm (`@0glabs/0g-compute-cli`), GitHub clone, direct binary — all failed.

\- SDK alternatives (`@0glabs/0g-serving-broker`) do not support training jobs (only inference).



\### Next Steps:

\- Awaiting access to the official CLI via 0g Labs or manager.

\- Once received, we will:

&nbsp; - Submit the compute job with TEE-backed provider

&nbsp; - Retrieve encrypted result

&nbsp; - Optionally submit hash to `FLAIComputeJobs` contract



