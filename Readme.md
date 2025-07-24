# TEE-FL + 0g PoC

This is the first Proof-of-Concept implementation of Trusted Federated Learning (TEE-FL) using 0g's Galileo stack. The goal is to simulate a basic federated job lifecycle that integrates 0g’s on-chain compute tracking and decentralized storage services.

## Objectives

- Build a minimal compute job manager smart contract
- Deploy and interact with it on the 0g Galileo testnet
- Upload sample model and input data to 0g Storage
- Simulate reward-based job completion using hashes

---

## Stack

- Solidity + Hardhat (0.8.19)
- Node.js (v22.16.0)
- 0g Galileo testnet (EVM-compatible)
- `@0glabs/0g-ts-sdk` for storage
- TypeScript for 0g file upload
- Windows (Dev Environment)

---

## Smart Contract: `FLAIComputeJobs.sol`

Tracks compute jobs off-chain with on-chain references and rewards.

```solidity
struct Job {
  address client;
  string modelHash;
  string inputHash;
  string resultHash;
  uint256 fee;
  bool completed;
}
