# Multiple Participants Setup Guide

## Overview

This document explains everything needed to test federated learning with **multiple participants** (not just one wallet). This is essential for real-world federated learning where multiple parties contribute to the global model.

---

## ✅ What We Currently Have (Single Participant)

**Current Setup:**
- ✅ 1 wallet (deployer)
- ✅ 1 epoch (Epoch 1)
- ✅ 1 update submitted
- ✅ Simplified scoring (100% weight)
- ✅ Simplified FedAvg (single update)

**What's Missing for Multiple Participants:**
- ❌ Multiple wallets
- ❌ Access grants for each participant
- ❌ Real scoring algorithm (weighted by contributions)
- ❌ Real FedAvg (weighted averaging)
- ❌ Participant management system

---

## 📋 Requirements for Multiple Participants

### 1. Multiple Wallets ✅ (Required)

**What you need:**
- At least 2-3 different wallet addresses
- Each wallet needs:
  - Private key (keep secure!)
  - 0G tokens for gas fees
  - Access granted via AccessRegistry

**How to create:**
```javascript
// Create new wallets
const { ethers } = require('ethers');
const wallet1 = ethers.Wallet.createRandom();
const wallet2 = ethers.Wallet.createRandom();
const wallet3 = ethers.Wallet.createRandom();

console.log('Wallet 1:', wallet1.address, wallet1.privateKey);
console.log('Wallet 2:', wallet2.address, wallet2.privateKey);
console.log('Wallet 3:', wallet3.address, wallet3.privateKey);
```

**Storage:**
- Store private keys in `.env.mainnet` or separate files
- Never commit private keys to GitHub!
- Use different variable names: `PRIVATE_KEY`, `PRIVATE_KEY_2`, `PRIVATE_KEY_3`

---

### 2. Access Grants for Each Participant ✅ (Required)

**What you need:**
- Each participant must have access granted via AccessRegistry
- Access must be granted by the dataset owner (usually deployer)

**How to grant access:**
```javascript
// Grant access for each participant
await accessRegistry.grantAccess(
  participant1Address,  // Provider address
  datasetCid,          // Dataset CID
  modelHash,           // Model hash
  expiry               // Expiry timestamp
);

await accessRegistry.grantAccess(
  participant2Address,
  datasetCid,
  modelHash,
  expiry
);

// ... repeat for each participant
```

**What's needed:**
- Participant wallet addresses
- Dataset CID (can be same for all)
- Model hash (epoch model hash)
- Expiry timestamp (when access expires)

---

### 3. Real Scoring Algorithm ✅ (Required)

**Current issue:**
- We use simplified scoring (single update = 100% weight)
- Need weighted scoring based on contribution quality

**What you need:**
- Scoring algorithm that evaluates:
  - Update quality (accuracy, contribution)
  - Data size (more data = higher weight)
  - Update relevance (how relevant is the update)
  
**How scoring should work:**
```javascript
// Real scoring algorithm
function computeScores(updates) {
  const scores = [];
  
  for (const update of updates) {
    // Evaluate update quality
    const quality = evaluateUpdateQuality(update);
    
    // Consider data size
    const dataSize = update.dataSize;
    const sizeWeight = dataSize / totalDataSize;
    
    // Combine factors
    const score = (quality * 0.7) + (sizeWeight * 0.3);
    scores.push(score);
  }
  
  // Normalize scores (sum to 1.0)
  const total = scores.reduce((a, b) => a + b, 0);
  return scores.map(s => s / total);
}
```

**What's needed:**
- Scoring algorithm implementation
- Quality metrics (accuracy, contribution, etc.)
- Normalization (scores must sum to 1.0)

---

### 4. Real FedAvg Aggregation ✅ (Required)

**Current issue:**
- We use simplified FedAvg (single update = global model)
- Need weighted averaging based on scores

**What you need:**
- FedAvg algorithm that:
  - Downloads encrypted updates from storage
  - Decrypts in TEE (secure environment)
  - Applies weighted averaging based on scores
  - Creates global model

**How FedAvg should work:**
```javascript
// Real FedAvg algorithm
function fedAvg(updates, scores) {
  // Download encrypted updates
  const encryptedUpdates = updates.map(u => downloadFromStorage(u.cid));
  
  // Decrypt in TEE
  const decryptedUpdates = encryptedUpdates.map(u => decryptInTEE(u));
  
  // Extract weights
  const weights = decryptedUpdates.map(u => u.weights);
  
  // Weighted average
  const globalWeights = [];
  for (let i = 0; i < weights[0].length; i++) {
    let sum = 0;
    for (let j = 0; j < weights.length; j++) {
      sum += weights[j][i] * scores[j];
    }
    globalWeights.push(sum);
  }
  
  return globalWeights;
}
```

**What's needed:**
- 0G Storage integration (download encrypted updates)
- TEE integration (decrypt securely)
- FedAvg algorithm implementation
- Weighted averaging logic

---

### 5. Participant Management System ✅ (Recommended)

**What you need:**
- System to track participants
- Participant registration
- Participant status tracking
- Participant contribution history

**Recommended structure:**
```javascript
const participants = {
  participant1: {
    address: "0x...",
    wallet: wallet1,
    accessGranted: true,
    updatesSubmitted: 0,
    totalContribution: 0
  },
  participant2: {
    address: "0x...",
    wallet: wallet2,
    accessGranted: true,
    updatesSubmitted: 0,
    totalContribution: 0
  }
  // ... more participants
};
```

---

### 6. 0G Storage Integration ✅ (Required for Production)

**Current Status:**
- ✅ **SDK Installed**: `@0glabs/0g-ts-sdk@0.3.1` is installed
- ✅ **Configuration Present**: Storage configuration exists in `.env.mainnet`
- ✅ **Code Ready**: Storage upload code exists (`scripts/storage_manager.js`)
- ✅ **Uploads Working**: Fixed by using official API from docs (`ZgFile.fromFilePath`, `Indexer`, `indexer.upload`)
- ✅ **ENS Issue Fixed**: Disabled ENS resolution in provider config (`ensAddress: null`)

**What you need:**
- Enable 0G Storage: Set `OG_STORAGE_MODE=0g-storage` in `.env.mainnet`
- Configure 0G Storage private key
- Test uploads work (they should now work correctly)

**How to enable:**
```bash
# In .env.mainnet
OG_STORAGE_MODE=0g-storage
OG_STORAGE_RPC=https://evmrpc.0g.ai
OG_STORAGE_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
```

**Test command:**
```bash
node scripts/test_0g_storage_mainnet.js
```

**Note**: Uploads are now working correctly. The issue was resolved by checking the official 0G Storage SDK documentation and using the correct API (`ZgFile.fromFilePath`, `Indexer`, `indexer.upload`) instead of the incorrect API we were using before.

---

### 7. Real Model Weights ✅ (Required for Production)

**Current issue:**
- We use simplified test data
- Need real model weights (neural network, etc.)

**What you need:**
- Real model training code
- Model weight generation
- Model weight encryption
- Model weight upload to storage

**Model structure:**
```javascript
const model = {
  weights: [0.234, -0.567, 0.891, ...],  // 1000+ numbers
  bias: [0.123, 0.456, ...],
  shape: [1000],
  dtype: "float32"
};
```

---

### 8. TEE Integration ✅ (Required for Production)

**What you need:**
- TEE attestation verification
- TEE decryption environment
- Secure computation environment

**Current status:**
- ⚠️ TEE is simulated (not real hardware)
- Need real TEE integration for production

---

## 🔧 Implementation Checklist

### Phase 1: Basic Multi-Participant Setup
- [ ] Create 2-3 test wallets
- [ ] Grant access to each wallet
- [ ] Test submitting updates from different wallets
- [ ] Verify all updates are recorded

### Phase 2: Scoring Implementation
- [ ] Implement scoring algorithm
- [ ] Test scoring with multiple updates
- [ ] Verify scores root is correct
- [ ] Test score normalization

### Phase 3: FedAvg Implementation
- [ ] Enable 0G Storage (if not already)
- [ ] Implement FedAvg algorithm
- [ ] Test weighted averaging
- [ ] Verify global model is correct

### Phase 4: Production Readiness
- [ ] Integrate real model weights
- [ ] Test TEE integration
- [ ] Test with 5+ participants
- [ ] Performance testing

---

## 📝 Quick Start for Multiple Participants

### Step 1: Create Wallets
```bash
node scripts/create_test_wallets.js
```

### Step 2: Grant Access
```bash
node scripts/grant_access_multiple.js
```

### Step 3: Start Epoch 2
```bash
node scripts/start_mainnet_epoch.js --epoch 2
```

### Step 4: Submit Updates from Each Wallet
```bash
node scripts/submit_mainnet_update.js --epoch 2 --wallet wallet1
node scripts/submit_mainnet_update.js --epoch 2 --wallet wallet2
node scripts/submit_mainnet_update.js --epoch 2 --wallet wallet3
```

### Step 5: Compute Scores
```bash
node scripts/compute_mainnet_scores.js --epoch 2
```

### Step 6: Aggregate and Publish
```bash
node scripts/publish_mainnet_model.js --epoch 2
```

---

## 🎯 Summary

**What you need for multiple participants:**

1. ✅ **Multiple Wallets** - At least 2-3 different wallet addresses
2. ✅ **Access Grants** - Grant access to each participant via AccessRegistry
3. ✅ **Scoring Algorithm** - Real scoring based on contribution quality
4. ✅ **FedAvg Algorithm** - Real weighted averaging
5. ✅ **0G Storage** - Enable and test uploads/downloads
6. ✅ **Real Model Weights** - Use actual model weights (not test data)
7. ✅ **TEE Integration** - Real TEE for secure computation (production)

**Current Status:**
- ✅ Single participant works
- ⚠️ 0G Storage configured but disabled (mode: "manual")
- ❌ Multiple participants not tested yet
- ❌ Real scoring not implemented
- ❌ Real FedAvg not implemented

**Next Steps:**
1. Enable 0G Storage (`OG_STORAGE_MODE=0g-storage`)
2. Create multiple test wallets
3. Grant access to each wallet
4. Test with multiple participants
5. Implement real scoring
6. Implement real FedAvg

---

## 📚 Related Documents

- [Mainnet Pipeline Test Explanation](MAINNET_PIPELINE_TEST_EXPLANATION.md)
- [Roadmap](ROADMAP.md)
- [Next Steps](NEXT_STEPS.md)
- [API Reference](API_REFERENCE.md)
