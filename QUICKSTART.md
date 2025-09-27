# FLAI Protocol Quick Start Guide

**Purpose**: Get developers up and running quickly  
**Target**: Developers integrating with FLAI Protocol  
**Status**: Production-ready

## Quick Setup

### 1. Clone and Install
```bash
git clone https://github.com/balkeumlabs/tee-fl-0g.git
cd tee-fl-0g
npm install --legacy-peer-deps
```

### 2. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your values
# Required: CHAIN_RPC, ACCESS_REGISTRY_ADDR, EPOCH_MANAGER_ADDR
```

### 3. Verify Setup
```bash
# Test RPC connection
node scripts/test_rpc_connection.js

# Test contract access
node scripts/test_corrected_contract.js

# Run health check
node scripts/health_check.js
```

## Core Operations

### Submit Encrypted Update
```bash
# Create encrypted gradient update
node scripts/submit_update_checked_raw.js --epoch 1 --model-hash 0x1234...

# Check if provider is approved
node scripts/is_approved_raw.js --provider 0x...
```

### Compute Scores and Aggregate
```bash
# Compute contribution scores
node scripts/compute_scores_and_post_root_raw.js --epoch 1

# Aggregate gradients (FedAvg)
node scripts/aggregate_and_publish_raw.js --epoch 1
```

### Marketplace Operations
```bash
# Register model service
node scripts/marketplace_service_manager.js --action register

# Process inference request
node scripts/marketplace_inference_processor.js --request-id 123

# Client inference request
node scripts/marketplace_client.js --service-id 456
```

## Monitoring

### Health Checks
```bash
# System health
node scripts/health_check.js

# Alert monitoring
node scripts/alert_monitor.js
```

### Storage Testing
```bash
# Test storage integration
node scripts/test_storage_simple.cjs

# Test 0G Storage upload (when available)
node scripts/test_real_0g_upload.js --file test_upload_small.txt
```

## Development

### Contract Testing
```bash
# Run Hardhat tests
npx hardhat test

# Deploy contracts
npx hardhat deploy --network galileo
```

### CI/CD
```bash
# Dry run
npm run ci:dry

# Smoke test
npm run ci:smoke

# Live deployment
npm run ci:live
```

## Security

### Attestation Enforcement
```bash
# Enable attestation checks
export ATTESTATION_ENFORCED=true

# Disable for testing
export ATTESTATION_ENFORCED=false
```

### Access Control
```bash
# Grant provider access
node scripts/grant_access_raw.js --provider 0x... --dataset-cid bafy...

# Check access status
node scripts/is_approved_raw.js --provider 0x...
```

## Production Deployment

### Pre-deployment Checklist
- [ ] OG tokens available
- [ ] RPC endpoint responding
- [ ] Contracts deployed
- [ ] Environment configured
- [ ] Health checks passing

### Deployment Commands
```bash
# Switch to production mode
export OG_STORAGE_MODE=0g-storage

# Deploy contracts
npx hardhat deploy --network galileo

# Start monitoring
node scripts/health_check.js
```

## Troubleshooting

### Common Issues

**RPC Connection Failed**
```bash
# Try fallback endpoint
export CHAIN_RPC=https://rpc.ankr.com/0g_galileo_testnet_evm
```

**Insufficient Funds**
```bash
# Check balance
node scripts/check_balance_raw.js

# Get OG tokens from 0G faucet
```

**Storage Upload Failed**
```bash
# Check storage mode
echo $OG_STORAGE_MODE

# Switch to manual mode
export OG_STORAGE_MODE=manual
```

## Support

- **Documentation**: README.md, ai_prompt.md
- **Issues**: GitHub Issues
- **Team**: Slack #flai-protocol

---

**Status**: Production-ready. All commands tested and validated.
