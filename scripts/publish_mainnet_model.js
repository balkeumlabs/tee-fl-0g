// scripts/publish_mainnet_model.js - Aggregate and publish model on mainnet
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config({ path: '.env.mainnet' });

(async () => {
  console.log("🔄 Aggregating and Publishing Model on Mainnet...");
  
  const rpc = process.env.RPC_ENDPOINT || "https://evmrpc.0g.ai";
  const pk = process.env.PRIVATE_KEY;
  
  if (!pk) {
    throw new Error('Missing PRIVATE_KEY in .env.mainnet');
  }
  
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);
  
  // Load deployment info
  const deployInfo = JSON.parse(fs.readFileSync('data/deploy.mainnet.json', 'utf8'));
  const epochManagerAddress = deployInfo.addresses.EpochManager;
  
  // Load contract ABI
  const epochManagerArt = JSON.parse(fs.readFileSync('artifacts/contracts/EpochManager.sol/EpochManager.json', 'utf8'));
  const epochManager = new ethers.Contract(epochManagerAddress, epochManagerArt.abi, wallet);
  
  const epochId = 1;
  
  // Check if epoch exists and scores root is posted
  console.log(`\n📋 Checking Epoch ${epochId}...`);
  const epochInfo = await epochManager.epochs(epochId);
  
  if (epochInfo.modelHash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    throw new Error('Epoch 1 not started. Please start epoch first.');
  }
  
  if (epochInfo.scoresRoot === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    throw new Error('Scores root not posted. Please compute scores first.');
  }
  
  if (epochInfo.published) {
    throw new Error('Epoch 1 already published. Start a new epoch for next round.');
  }
  
  console.log(`✅ Epoch ${epochId} is ready for aggregation`);
  console.log(`   Model hash: ${epochInfo.modelHash}`);
  console.log(`   Scores root: ${epochInfo.scoresRoot}`);
  
  // Get submitted updates from events
  console.log(`\n📦 Getting Submitted Updates...`);
  const filter = epochManager.filters.UpdateSubmitted(epochId);
  const events = await epochManager.queryFilter(filter);
  
  console.log(`   Total updates: ${events.length}`);
  
  if (events.length === 0) {
    throw new Error('No updates submitted. Cannot aggregate empty epoch.');
  }
  
  // Aggregate updates (simplified - in production this would use FedAvg)
  console.log(`\n🔄 Aggregating Updates (FedAvg simulation)...`);
  
  // In production, this would:
  // 1. Download encrypted updates from storage
  // 2. Decrypt in TEE
  // 3. Aggregate using FedAvg algorithm
  // 4. Compute global model hash
  // 5. Upload aggregated model to storage
  // 6. Get CID from storage
  
  // For testing, we'll create a simulated aggregated model
  const globalModelCid = `aggregated-model-epoch-${epochId}-${Date.now()}`;
  const globalModelHash = ethers.keccak256(ethers.concat(
    events.map(e => e.args.updateHash)
  ));
  
  console.log(`   Global model CID: ${globalModelCid}`);
  console.log(`   Global model hash: ${globalModelHash}`);
  
  // Publish model
  console.log(`\n📤 Publishing Model...`);
  try {
    const tx = await epochManager.publishModel(epochId, globalModelCid, globalModelHash);
    console.log(`   Transaction hash: ${tx.hash}`);
    await tx.wait();
    console.log(`✅ Model published successfully!`);
    
    // Verify model was published
    const updatedEpochInfo = await epochManager.epochs(epochId);
    console.log(`\n📊 Verification:`);
    console.log(`   Global model CID: ${updatedEpochInfo.globalModelCid}`);
    console.log(`   Global model hash: ${updatedEpochInfo.globalModelHash}`);
    console.log(`   Published: ${updatedEpochInfo.published ? 'Yes' : 'No'}`);
    
    console.log(`\n🎉 Model aggregation and publishing complete!`);
    console.log(`\n📋 Epoch ${epochId} Summary:`);
    console.log(`   Model hash: ${updatedEpochInfo.modelHash}`);
    console.log(`   Scores root: ${updatedEpochInfo.scoresRoot}`);
    console.log(`   Global model CID: ${updatedEpochInfo.globalModelCid}`);
    console.log(`   Global model hash: ${updatedEpochInfo.globalModelHash}`);
    console.log(`   Published: Yes`);
    
    console.log(`\n🔗 View on Block Explorer:`);
    console.log(`   Transaction: https://chainscan.0g.ai/tx/${tx.hash}`);
    console.log(`   Contract: https://chainscan.0g.ai/address/${epochManagerAddress}`);
    
  } catch (error) {
    console.error(`❌ Publishing failed:`, error.message);
    throw error;
  }
  
})().catch(e => { 
  console.error("Failed:", e); 
  process.exit(1); 
});
