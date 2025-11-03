# 0G Storage Status & Multiple Participants Requirements

## 📊 0G Storage Status Check Results

### ✅ What's Working

1. **SDK Installed**: ✅ `@0glabs/0g-ts-sdk@0.3.1` is installed
2. **Configuration Present**: ✅ Storage configuration exists in `.env.mainnet`
3. **Code Ready**: ✅ Storage upload code exists (`scripts/storage_manager.js`)
4. **Test Scripts**: ✅ Test scripts exist (`scripts/test_0g_storage_mainnet.js`)

### ⚠️ What's Not Working (Currently Disabled)

1. **Storage Mode**: ⚠️ Currently set to `manual` (uploads disabled)
   - **Current**: `OG_STORAGE_MODE=manual`
   - **Needed**: `OG_STORAGE_MODE=0g-storage`

2. **Storage Uploads**: ⚠️ Not tested yet (mode is manual)
   - Uploads are skipped when mode is "manual"
   - Need to enable and test

### 🔧 How to Enable 0G Storage

**Step 1: Update `.env.mainnet`**
```bash
# Change from:
OG_STORAGE_MODE=manual

# To:
OG_STORAGE_MODE=0g-storage
```

**Step 2: Set Storage Private Key**
```bash
# In .env.mainnet
OG_STORAGE_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
# Or use existing PRIVATE_KEY if same wallet
OG_STORAGE_PRIVATE_KEY=${PRIVATE_KEY}
```

**Step 3: Test Upload**
```bash
node scripts/test_0g_storage_mainnet.js
```

**Expected Output:**
- ✅ RPC connection successful
- ✅ Signer address created
- ✅ Storage nodes created
- ✅ Upload successful
- ✅ Root hash (CID) returned

---

## 📋 Multiple Participants Requirements

### ✅ What You Need

#### 1. Multiple Wallets ✅ (Required)

**What you need:**
- At least 2-3 different wallet addresses
- Each wallet needs:
  - Private key
  - 0G tokens for gas fees
  - Access granted via AccessRegistry

**How to create:**
```bash
# Use Node.js to create wallets
node -e "
const { ethers } = require('ethers');
const w1 = ethers.Wallet.createRandom();
const w2 = ethers.Wallet.createRandom();
const w3 = ethers.Wallet.createRandom();
console.log('Wallet 1:', w1.address, w1.privateKey);
console.log('Wallet 2:', w2.address, w2.privateKey);
console.log('Wallet 3:', w3.address, w3.privateKey);
"
```

**Storage:**
- Store in `.env.mainnet`:
  ```
  PRIVATE_KEY=0x...  # Main wallet
  PRIVATE_KEY_2=0x...  # Participant 2
  PRIVATE_KEY_3=0x...  # Participant 3
  ```

---

#### 2. Access Grants ✅ (Required)

**What you need:**
- Grant access to each participant via AccessRegistry
- Each participant needs access for:
  - Dataset CID
  - Model hash (epoch model hash)
  - Expiry timestamp

**How to grant:**
```javascript
// Grant access for each participant
await accessRegistry.grantAccess(
  participant1Address,  // Provider address
  datasetCid,          // Dataset CID
  modelHash,           // Model hash
  expiry               // Expiry timestamp
);
```

**Script needed:**
- Create `scripts/grant_access_multiple.js` to grant access to all participants

---

#### 3. Real Scoring Algorithm ✅ (Required)

**Current issue:**
- We use simplified scoring (single update = 100% weight)
- Need weighted scoring based on contribution quality

**What you need:**
- Scoring algorithm that evaluates:
  - Update quality (accuracy, contribution)
  - Data size (more data = higher weight)
  - Update relevance

**Implementation needed:**
- Update `scripts/compute_mainnet_scores.js` to use real scoring

---

#### 4. Real FedAvg Algorithm ✅ (Required)

**Current issue:**
- We use simplified FedAvg (single update = global model)
- Need weighted averaging based on scores

**What you need:**
- FedAvg algorithm that:
  - Downloads encrypted updates from storage
  - Decrypts in TEE (secure environment)
  - Applies weighted averaging based on scores
  - Creates global model

**Implementation needed:**
- Update `scripts/publish_mainnet_model.js` to use real FedAvg

---

#### 5. 0G Storage Enabled ✅ (Required)

**Current status:**
- ⚠️ 0G Storage is configured but disabled
- Need to enable and test uploads

**What you need:**
- Set `OG_STORAGE_MODE=0g-storage` in `.env.mainnet`
- Test uploads work
- Verify downloads work

---

#### 6. Real Model Weights ✅ (Required for Production)

**Current issue:**
- We use simplified test data
- Need real model weights (neural network, etc.)

**What you need:**
- Real model training code
- Model weight generation
- Model weight encryption
- Model weight upload to storage

---

## 📊 Summary

### ✅ What's Working

1. **Single Participant**: ✅ Works perfectly
2. **SDK Installed**: ✅ 0G Storage SDK is installed
3. **Configuration**: ✅ Storage config exists
4. **Code Ready**: ✅ Upload code exists

### ⚠️ What Needs to Be Done

1. **0G Storage**: ⚠️ Enable and test (currently disabled)
2. **Multiple Wallets**: ❌ Need to create and configure
3. **Access Grants**: ❌ Need to grant access to each participant
4. **Scoring Algorithm**: ❌ Need to implement real scoring
5. **FedAvg Algorithm**: ❌ Need to implement real FedAvg
6. **Real Model Weights**: ❌ Need to integrate real models

---

## 🎯 Immediate Next Steps

### Priority 1: Enable 0G Storage
1. Set `OG_STORAGE_MODE=0g-storage` in `.env.mainnet`
2. Test upload: `node scripts/test_0g_storage_mainnet.js`
3. Verify upload works

### Priority 2: Multiple Participants Setup
1. Create 2-3 test wallets
2. Grant access to each wallet
3. Test submitting updates from different wallets
4. Verify all updates are recorded

### Priority 3: Real Algorithms
1. Implement real scoring algorithm
2. Implement real FedAvg algorithm
3. Test with multiple participants
4. Verify global model is correct

---

## 📚 Related Documents

- [Multiple Participants Setup Guide](MULTIPLE_PARTICIPANTS_SETUP.md)
- [Mainnet Pipeline Test Explanation](MAINNET_PIPELINE_TEST_EXPLANATION.md)
- [Roadmap](ROADMAP.md)
- [Next Steps](NEXT_STEPS.md)
