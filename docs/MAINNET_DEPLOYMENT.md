# 0G Mainnet Deployment Guide

**Purpose**: Complete guide for deploying TEE-FL-0G to 0G Mainnet  
**Target**: Developers deploying federated learning on 0G Mainnet  
**Status**: Ready for deployment

## 0G Mainnet Overview

### Network Details
| Parameter | Value |
|-----------|-------|
| **Network Name** | 0G Mainnet |
| **Chain ID** | 16661 |
| **Token Symbol** | 0G |
| **RPC URL** | `https://evmrpc.0g.ai` |
| **Storage Indexer** | `https://indexer-storage-turbo.0g.ai` |
| **Block Explorer** | `https://chainscan.0g.ai` |

### 0G Storage Contract Addresses
- **Flow Contract**: `0x62D4144dB0F0a6fBBaeb6296c785C71B3D57C526`
- **Mine Contract**: `0xCd01c5Cd953971CE4C2c9bFb95610236a7F414fe`
- **Reward Contract**: `0x457aC76B58ffcDc118AABD6DbC63ff9072880870`

### Third-Party RPC Providers (Recommended for Production)
✅ **Recommended for production apps:**
- **QuickNode**: High-performance RPC endpoints
- **ThirdWeb**: Developer-friendly infrastructure  
- **Ankr**: Reliable blockchain infrastructure

> **Note**: For redundancy in production apps, consider adding multiple RPC providers where available.

### Wallet Integration
- **MetaMask**: Add 0G Mainnet network
- **OKX Wallet**: Add 0G Mainnet network
- **Network Configuration**: Use the network details above to add 0G Mainnet to your wallet

## Prerequisites

### 1. 0G Tokens
- **Required**: 0G tokens for transaction fees
- **Source**: 0G team, exchanges, or airdrop
- **Minimum**: ~1-5 0G tokens for deployment

### 2. Wallet Setup
- **Private Key**: Mainnet private key
- **Wallet Address**: EVM-compatible wallet
- **Network Configuration**: Add 0G Mainnet to wallet

### 3. Environment Configuration
- **File**: `.env.mainnet`
- **Template**: `mainnet.env.template`
- **Required Variables**: See configuration section below

## Configuration

### Mainnet Environment File (.env.mainnet)
```bash
# Blockchain Configuration
PRIVATE_KEY=0x[your-mainnet-private-key]
RPC_ENDPOINT=https://evmrpc.0g.ai
CHAIN_ID=16661

# 0G Storage Contract Addresses (Mainnet)
OG_STORAGE_FLOW_CONTRACT=0x62D4144DB0F0a6fBBaeb6296c785C71B3D57C526
OG_STORAGE_MINE_CONTRACT=0xCd01c5Cd953971CE4C2c9bFb95610236a7F414fe
OG_STORAGE_REWARD_CONTRACT=0x457aC76B58ffcDc118AABD6DbC63ff9072880870

# Storage Configuration
OG_STORAGE_MODE=manual
OG_STORAGE_RPC=https://evmrpc.0g.ai
OG_STORAGE_API_BASE=
OG_STORAGE_API_TOKEN=
OG_GATEWAY_BASE=https://ipfs.io/ipfs/

# Encryption
FL_ENC_MODE=dev
FL_TEE_PUBKEY_B64=BASE64_X25519_PUBKEY_HERE
FL_TEE_PRIVKEY_B64=
FL_CLIENT_PRIVKEY_B64=
FL_ENC_DELETE_PLAINTEXT=1

# Attestation
TEE_ATTEST_MEAS_ALLOWLIST=
TEE_ATTEST_ENCLAVE_ID=

# Safety
DRY_RUN=0
LOCAL_UPLOAD=0

# Marketplace Integration
OG_MARKETPLACE_RPC=https://evmrpc.0g.ai
OG_MARKETPLACE_PRIVATE_KEY=0x[your-mainnet-private-key]
OG_MARKETPLACE_CONTRACT_ADDRESS=0xMARKETPLACE_CONTRACT_ADDRESS
OG_MARKETPLACE_SERVICE_ID=1
```

## Deployment Process

### Step 1: Pre-Deployment Checks
```bash
# Test mainnet connection
node scripts/test_mainnet_connection.cjs

# Check wallet balance
node scripts/check_mainnet_balance.cjs

# Check deployment readiness
node scripts/check_mainnet_readiness.cjs
```

### Step 2: Deploy Contracts
```bash
# Deploy to mainnet
node scripts/deploy_mainnet.js
```

### Step 3: Verify Deployment
```bash
# Check deployed contracts
cat data/deploy.mainnet.json

# Test contract interactions
node scripts/health_check.js
```

## Post-Deployment

### 1. Grant Access
```bash
# Grant provider access
node scripts/grant_access_raw.js --provider 0x[your-address]
```

### 2. Test Federated Learning Pipeline
```bash
# Start epoch
node scripts/start_epoch_once_raw.js --epoch 1

# Submit update
node scripts/submit_update_checked_raw.js --epoch 1

# Compute scores
node scripts/compute_scores_and_post_root_raw.js --epoch 1

# Aggregate and publish
node scripts/aggregate_and_publish_raw.js --epoch 1
```

### 3. Register Services
```bash
# Register model service
node scripts/marketplace_service_manager.js --action register
```

## Monitoring

### Health Checks
```bash
# System health
node scripts/health_check.js

# Alert monitoring
node scripts/alert_monitor.js
```

### Block Explorer
- **URL**: https://chainscan.0g.ai
- **Search**: Contract addresses, transaction hashes
- **Monitoring**: Real-time transaction status

## Troubleshooting

### Common Issues

**Insufficient Balance**
```bash
# Check balance
node scripts/check_mainnet_balance.cjs
# Solution: Get more 0G tokens
```

**RPC Connection Failed**
```bash
# Test connection
node scripts/test_mainnet_connection.cjs
# Solution: Check RPC endpoint or use alternative provider
```

**Contract Deployment Failed**
```bash
# Check gas settings
# Solution: Increase gas limit or check network status
```

**Storage Upload Failed**
```bash
# Check storage mode
echo $OG_STORAGE_MODE
# Solution: Switch to manual mode or check storage configuration
```

## Security Considerations

### Private Key Management
- **Production**: Use hardware wallets or key management services
- **Development**: Keep private keys secure and never commit to Git
- **Rotation**: Regularly rotate private keys

### Access Control
- **Provider Approval**: Only approve trusted providers
- **Dataset Access**: Control access to sensitive datasets
- **Attestation**: Enable TEE attestation for production

### Monitoring
- **Transaction Monitoring**: Monitor all on-chain transactions
- **Alert System**: Set up alerts for unusual activity
- **Audit Logs**: Maintain comprehensive audit logs

## Support Resources

### Documentation
- **0G Mainnet Docs**: https://docs.0g.ai/developer-hub/mainnet/mainnet-overview
- **API Reference**: API_REFERENCE.md
- **Quick Start**: QUICKSTART.md

### Community
- **Discord**: 0G Labs Discord
- **Telegram**: 0G Labs Telegram
- **GitHub**: Repository issues and discussions

### Tools
- **Block Explorer**: https://chainscan.0g.ai
- **Storage Indexer**: https://indexer-storage-turbo.0g.ai
- **RPC Providers**: QuickNode, ThirdWeb, Ankr

## Status

**Current Status**: Ready for mainnet deployment  
**Last Updated**: 2025-10-22 23:59:00 UTC  
**Next Steps**: Deploy once 0G tokens are received
