# Changelog

All notable changes to the TEE-FL-0G project will be documented in this file.

## [Unreleased]

### What Happened

We successfully deployed smart contracts (AccessRegistry and EpochManager) on 0G Mainnet and ran a complete federated learning pipeline end-to-end. This included:

1. **Starting Epoch 1** with an initial model hash
2. **Submitting an encrypted model update** (without exposing private data)
3. **Computing contribution scores** for the update
4. **Aggregating updates** using FedAvg (Federated Averaging)
5. **Publishing the global model** on-chain

**Result:** All 4 transactions succeeded and are verified on the 0G blockchain.

### Overview

This dashboard showcases a **Federated Learning system** deployed on **0G Mainnet**. Federated Learning allows multiple parties to train a shared AI model without sharing their private data.

The dashboard shows the contract addresses, transaction history, and pipeline execution details.

---

## [2025-12-04] - Dashboard Deployment

### Added
- AWS EC2 backend deployment with Node.js/Express API
- Real-time blockchain data fetching via backend APIs
- Manual refresh button for cost-efficient data updates
- Network health monitoring
- Transaction gas cost tracking

### Changed
- Moved from static GitHub Pages to dynamic AWS EC2 hosting
- Updated frontend to fetch data from backend APIs instead of local JSON files
- Disabled auto-polling to reduce API costs (manual refresh only)
- Removed intro section from dashboard (moved to CHANGELOG.md)
- Removed 0G Storage Integration section from dashboard

### Technical Details
- Backend API endpoints: `/api/deployment`, `/api/epoch/:number`, `/api/storage`, `/api/network/health`, `/api/transaction/receipt`
- Server: Node.js with Express.js, managed by PM2
- Reverse proxy: Nginx
- Hosting: AWS EC2 instance

---

## [2025-11-03] - Mainnet Deployment

### Added
- Smart contracts deployed on 0G Mainnet
- AccessRegistry contract for participant access control
- EpochManager contract for federated learning pipeline management
- Complete end-to-end pipeline execution (Epoch 1)

### Technical Details
- Network: 0G Mainnet (Chain ID: 16661)
- Contracts:
  - AccessRegistry: `0x29029882D92d91024dBA05A43739A397AC1d9557`
  - EpochManager: `0x39FDd691B8fA988aE221CB3d0423c5f613Bee56e`
- Pipeline: 4 transactions executed successfully

---

