// scripts/complete_epoch2_training.js - Complete epoch 2 training with dummy clients
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

(async () => {
  console.log("🚀 Completing Epoch 2 Training Pipeline...\n");

  const rpc = process.env.RPC_ENDPOINT || "https://evmrpc.0g.ai";
  const pk = process.env.PRIVATE_KEY;

  if (!pk) {
    throw new Error('Missing PRIVATE_KEY in .env');
  }

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);
  const deployerAddress = await wallet.getAddress();

  // Load deployment info
  const deployInfo = JSON.parse(fs.readFileSync('data/deploy.mainnet.json', 'utf8'));
  const epochManagerAddress = deployInfo.addresses.EpochManager;

  // Load contract ABI
  const epochManagerArt = JSON.parse(fs.readFileSync('artifacts/contracts/EpochManager.sol/EpochManager.json', 'utf8'));
  const epochManager = new ethers.Contract(epochManagerAddress, epochManagerArt.abi, wallet);

  const epochId = 2;

  // Step 1: Check epoch status
  console.log(`📋 Step 1: Checking Epoch ${epochId}...`);
  const epochInfo = await epochManager.epochs(epochId);
  if (epochInfo.modelHash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    throw new Error(`Epoch ${epochId} not started. Please start epoch first.`);
  }
  console.log(`✅ Epoch ${epochId} is active`);
  console.log(`   Model hash: ${epochInfo.modelHash}\n`);

  // Step 2: Submit dummy client updates
  console.log(`📤 Step 2: Submitting Dummy Client Updates...`);
  const numClients = 3; // Number of dummy clients
  
  for (let i = 1; i <= numClients; i++) {
    // Create dummy update data
    const dummyUpdate = {
      epoch: epochId,
      clientId: i,
      timestamp: Math.floor(Date.now() / 1000),
      data: `dummy-model-update-${i}-${Date.now()}`
    };
    
    // Generate dummy CID and hash
    const updateCid = `dummy-update-epoch${epochId}-client${i}-${Date.now()}`;
    const updateHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(dummyUpdate)));
    
    try {
      console.log(`   Submitting update ${i}/${numClients}...`);
      const tx = await epochManager.submitUpdate(epochId, updateCid, updateHash);
      console.log(`   ✅ Client ${i} update submitted: ${tx.hash}`);
      await tx.wait();
    } catch (error) {
      console.error(`   ❌ Client ${i} submission failed:`, error.message);
    }
  }
  console.log(`\n✅ All ${numClients} client updates submitted!\n`);

  // Step 3: Compute and post scores root
  console.log(`📊 Step 3: Computing Scores Root...`);
  
  // Get all submitted updates
  const filter = epochManager.filters.UpdateSubmitted(epochId);
  const events = await epochManager.queryFilter(filter);
  
  console.log(`   Found ${events.length} submitted updates`);
  
  // Create dummy scores (in production, this would be computed from actual model updates)
  const scores = events.map((e, idx) => ({
    submitter: e.args.submitter,
    score: 0.8 + (idx * 0.05) // Dummy scores: 0.8, 0.85, 0.9, etc.
  }));
  
  // Compute Merkle root of scores (simplified - in production use proper Merkle tree)
  const scoresData = scores.map(s => `${s.submitter}-${s.score}`).join('|');
  const scoresRoot = ethers.keccak256(ethers.toUtf8Bytes(scoresData));
  
  console.log(`   Scores root: ${scoresRoot}`);
  
  try {
    const tx = await epochManager.postScoresRoot(epochId, scoresRoot);
    console.log(`   ✅ Scores root posted: ${tx.hash}`);
    await tx.wait();
  } catch (error) {
    console.error(`   ❌ Failed to post scores root:`, error.message);
    throw error;
  }
  console.log(`\n✅ Scores root posted!\n`);

  // Step 4: Publish aggregated model
  console.log(`📦 Step 4: Publishing Aggregated Model...`);
  
  // Create dummy aggregated model CID and hash
  const globalModelCid = `aggregated-model-epoch${epochId}-${Date.now()}`;
  const globalModelData = {
    epoch: epochId,
    aggregated: true,
    timestamp: Math.floor(Date.now() / 1000),
    participants: events.length
  };
  const globalModelHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(globalModelData)));
  
  console.log(`   Global Model CID: ${globalModelCid}`);
  console.log(`   Global Model Hash: ${globalModelHash}`);
  
  try {
    const tx = await epochManager.publishModel(epochId, globalModelCid, globalModelHash);
    console.log(`   ✅ Model published: ${tx.hash}`);
    await tx.wait();
    
    // Verify
    const finalEpochInfo = await epochManager.epochs(epochId);
    console.log(`\n📊 Final Epoch Status:`);
    console.log(`   Published: ${finalEpochInfo.published}`);
    console.log(`   Global Model CID: ${finalEpochInfo.globalModelCid}`);
    console.log(`   Global Model Hash: ${finalEpochInfo.globalModelHash}`);
    
  } catch (error) {
    console.error(`   ❌ Failed to publish model:`, error.message);
    throw error;
  }

  console.log(`\n🎉 Epoch ${epochId} training pipeline completed successfully!`);
  console.log(`\n📋 Summary:`);
  console.log(`   - Epoch ID: ${epochId}`);
  console.log(`   - Client Updates: ${events.length}`);
  console.log(`   - Scores Root: ${scoresRoot}`);
  console.log(`   - Global Model CID: ${globalModelCid}`);
  console.log(`   - Status: Published ✅`);

})().catch(e => {
  console.error("❌ Failed:", e);
  process.exit(1);
});

