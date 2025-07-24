TEE-FL + 0g: PoC Report

Project: TEE-FL using 0g Galileo stack

Author: Rao Ahmad

Repo: https://github.com/balkeumlabs/tee-fl-0g

Report Date: July 24, 2025



Overview

This document summarizes the goals, implementation, results, and verification of the first Proof-of-Concept (PoC) for integrating Trusted Execution Environments + Federated Learning (TEE-FL) with the 0g Galileo testnet. It is designed to make the repo self-explanatory to anyone reviewing the work, manager, team member, or external partner.



This PoC was developed under instructions from the Balkeum Labs team to:



Build a functional FL job pipeline



Use 0g for storage and on-chain job tracking



Upload model + input data



Simulate rewards for compute jobs



Architecture Summary

Components Built:



FLAIComputeJobs.sol: Smart contract that tracks FL compute jobs on 0g



submit\_job.js, complete\_job.js, get\_job.js: Scripts to simulate FL job lifecycle



upload\_to\_0g\_storage.ts: TypeScript uploader to 0g Storage via @0glabs/0g-ts-sdk



model.json and data.json: Sample model metadata and input tensor



Project is built with Hardhat, connected to 0g Galileo RPC, and written on Windows



Contract Structure:



solidity

Copy

Edit

struct Job {

&nbsp;   address client;

&nbsp;   string modelHash;

&nbsp;   string inputHash;

&nbsp;   string resultHash;

&nbsp;   uint256 fee;

&nbsp;   bool completed;

}

Flow:



Upload files to 0g Storage → get Merkle root hash



Call submitJob() with those hashes + fee



Call completeJob() with output result hash



Smart contract emits logs + transfers reward



Outputs and Verifications

Deployment

css

Copy

Edit

Contract deployed to: 0x57a069a1c980a1E7577b9094b15968A2962d7b33

Confirmed on 0g explorer.



Job Submission

bash

Copy

Edit

npx hardhat run scripts/submit\_job.js --network galileo

Output:



yaml

Copy

Edit

Submitted job ID: 0

Job Completion

bash

Copy

Edit

npx hardhat run scripts/complete\_job.js --network galileo

Output:



python

Copy

Edit

Job 0 marked as complete with result hash: QmResultHashExample789

Job Retrieval

bash

Copy

Edit

npx hardhat run scripts/get\_job.js --network galileo

Output:



yaml

Copy

Edit

Job 0

Client: 0x9Ed57870379e28E32cb627bE365745dc184950dF

Model Hash: QmModelHashExample123

Input Hash: QmInputHashExample456

Result Hash: QmResultHashExample789

Fee: 0.01 OG

Completed: true

0g Storage Uploads

Used upload\_to\_0g\_storage.ts and 0g SDK. Uploaded:



model.json



data.json



Example 0g File Hashes seen on explorer:



Copy

Edit

0x635d8733affec9beb3834d5d9b661fedc8e8e531f48b2e9ed9ab8a4cf3a01a5a  

0x2260b090d4442056cd997b0aa791ed4db56948d765ddb4b6a6843f4a42657bd5

Confirmed uploaded status, Merkle positions, and block details on:

https://storagescan-galileo.0g.ai



Job 1 (Real Compute Result Submission)

Job ID: 1 was successfully created and completed with the actual result hash from Python compute.



Accuracy: 0.8045



Model Output Hash:

f4247a08c3bf4ea001e6c2074e045572ea508a58dc4cca0d44d7e367676d09b7



Verification Summary

Task	Output Verified?	Tool

Contract deployed	✅	0g explorer

Job submitted	✅	Script logs

Job marked complete	✅	Contract call

Data uploaded	✅	0g storage scan

Result readable	✅	get\_job.js

Reward sent	✅	Solidity transfer



Files in This Repo

File	Purpose

FLAIComputeJobs.sol	Job tracking smart contract

submit\_job.js, complete\_job.js	Interact with contract

model.json, data.json	FL mock input/output

upload\_to\_0g\_storage.ts	Upload to 0g storage

README.md	Overview of project

TEE-FL\_PoC\_Report.md	Full documentation of what was built and verified



Lessons Learned

0g Galileo testnet is fully EVM-compatible and integrates easily with Hardhat



File uploads to 0g work reliably with JS SDK and produce traceable Merkle roots



Contract logic and file hashes can simulate FL pipelines effectively



Git conflicts around README.md on Windows (CRLF + casing) require caution and cleanup



This report will be kept up-to-date with further development.

