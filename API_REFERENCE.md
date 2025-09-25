# FLAI Protocol API Reference

**Purpose**: Complete API documentation for all scripts and functions  
**Target**: Developers integrating with FLAI Protocol  
**Status**: Production-ready

## 📋 Scripts Overview

### Core Operations
| Script | Purpose | Input | Output |
|--------|---------|-------|--------|
| `submit_update_checked_raw.js` | Submit encrypted gradient update | `--epoch`, `--model-hash` | Success/Error |
| `compute_scores_and_post_root_raw.js` | Compute contribution scores | `--epoch` | Merkle root |
| `aggregate_and_publish_raw.js` | Aggregate gradients (FedAvg) | `--epoch` | Global model |
| `start_epoch_once_raw.js` | Start new federated learning epoch | `--epoch` | Epoch metadata |

### Access Control
| Script | Purpose | Input | Output |
|--------|---------|-------|--------|
| `grant_access_raw.js` | Grant provider access | `--provider`, `--dataset-cid` | Transaction hash |
| `is_approved_raw.js` | Check provider approval | `--provider` | Boolean |
| `deploy_access_raw.js` | Deploy AccessRegistry contract | None | Contract address |

### Marketplace Integration
| Script | Purpose | Input | Output |
|--------|---------|-------|--------|
| `marketplace_service_manager.js` | Manage model services | `--action` | Service metadata |
| `marketplace_inference_processor.js` | Process inference requests | `--request-id` | Inference result |
| `marketplace_client.js` | Client inference requests | `--service-id` | Inference response |

### Testing & Validation
| Script | Purpose | Input | Output |
|--------|---------|-------|--------|
| `test_rpc_connection.js` | Test RPC connectivity | None | Connection status |
| `test_corrected_contract.js` | Test contract interactions | None | Transaction results |
| `test_storage_simple.cjs` | Test storage integration | None | Storage status |
| `health_check.js` | System health monitoring | None | Health report |

## 🔧 Environment Variables

### Required Variables
```bash
# Blockchain Configuration
CHAIN_RPC=https://rpc.ankr.com/0g_galileo_testnet_evm
CHAIN_ID=5167003
ACCESS_REGISTRY_ADDR=0xE3bffF639B4522Fa3D1E72973f9BEc040504c21e
EPOCH_MANAGER_ADDR=0x...

# Storage Configuration
OG_STORAGE_MODE=manual  # or '0g-storage', 'ipfs-api'
OG_STORAGE_RPC=https://evmrpc-testnet.0g.ai
OG_STORAGE_PRIVATE_KEY=0x...

# Security Configuration
ATTESTATION_ENFORCED=true
ATT_ALLOWLIST_PATH=./attestation_allowlist.json
```

### Optional Variables
```bash
# IPFS Configuration
IPFS_API=https://api.pinata.cloud
IPFS_PROJECT_ID=your_project_id
IPFS_SECRET=your_secret

# Marketplace Configuration
OG_MARKETPLACE_RPC=https://evmrpc-testnet.0g.ai
OG_MARKETPLACE_PRIVATE_KEY=0x...
OG_MARKETPLACE_CONTRACT_ADDRESS=0x...
OG_MARKETPLACE_SERVICE_ID=123
```

## 📊 Data Structures

### Update Submission
```json
{
  "epoch": 1,
  "provider": "0x...",
  "modelHash": "0x...",
  "encryptedGradients": "encrypted_data",
  "signature": "0x...",
  "timestamp": 1640995200
}
```

### Epoch Metadata
```json
{
  "epoch": 1,
  "startTime": 1640995200,
  "endTime": 1640998800,
  "participants": ["0x...", "0x..."],
  "globalModelHash": "0x...",
  "merkleRoot": "0x..."
}
```

### Service Registration
```json
{
  "serviceId": "123",
  "name": "FLAI-Model-Epoch-1",
  "description": "Federated Learning model",
  "price": "1000000000000000",
  "modelCid": "bafy...",
  "epoch": 1
}
```

## 🔐 Security Functions

### Attestation Enforcement
```javascript
// Check attestation before sensitive operations
const attestationStatus = await checkAttestation(measurements);
if (!attestationStatus.valid) {
  throw new Error('Attestation failed');
}
```

### Access Control
```javascript
// Check provider approval
const isApproved = await accessRegistry.isProviderApproved(provider, datasetCid);
if (!isApproved) {
  throw new Error('Provider not approved');
}
```

### Encryption Helpers
```javascript
// Encrypt gradients
const encrypted = await encryptGradients(gradients, publicKey);

// Decrypt gradients
const decrypted = await decryptGradients(encrypted, privateKey);
```

## 📈 Monitoring Functions

### Health Check
```javascript
// System health status
const health = await checkSystemHealth();
console.log(`Status: ${health.status}`);
console.log(`RPC: ${health.rpc.status}`);
console.log(`Contracts: ${health.contracts.status}`);
```

### Alert Monitoring
```javascript
// Monitor for alerts
const alerts = await monitorAlerts();
alerts.forEach(alert => {
  console.log(`Alert: ${alert.type} - ${alert.severity}`);
});
```

## 🛠️ Utility Functions

### Merkle Proof Generation
```javascript
// Generate Merkle proof for gradient bundle
const proof = await generateMerkleProof(files);
console.log(`Root: ${proof.root}`);
console.log(`Proofs: ${proof.proofs.length}`);
```

### CID Generation
```javascript
// Generate CID for file
const cid = await generateCID(fileData);
console.log(`CID: ${cid}`);
```

### Hash Verification
```javascript
// Verify file integrity
const isValid = await verifyFileHash(fileData, expectedHash);
console.log(`Valid: ${isValid}`);
```

## 🔄 CI/CD Integration

### GitHub Actions
```yaml
# Dry run validation
- name: Dry Run
  run: npm run ci:dry

# Smoke tests
- name: Smoke Tests
  run: npm run ci:smoke

# Live deployment
- name: Live Deployment
  run: npm run ci:live
```

### Artifact Management
```javascript
// Upload artifacts
const artifact = await uploadArtifact(fileData);
console.log(`Artifact CID: ${artifact.cid}`);

// Download and verify
const verified = await downloadAndVerify(artifact.cid);
console.log(`Verified: ${verified}`);
```

## 📞 Error Handling

### Common Error Codes
- `INSUFFICIENT_FUNDS`: Need OG tokens
- `RPC_ERROR`: Network connectivity issue
- `ATTESTATION_FAILED`: Attestation check failed
- `ACCESS_DENIED`: Provider not approved
- `STORAGE_ERROR`: Upload/download failed

### Error Recovery
```javascript
try {
  await submitUpdate(update);
} catch (error) {
  if (error.code === 'INSUFFICIENT_FUNDS') {
    console.log('Get OG tokens from faucet');
  } else if (error.code === 'RPC_ERROR') {
    console.log('Try fallback RPC endpoint');
  }
}
```

---

**Status**: Complete API reference for all production scripts and functions.
