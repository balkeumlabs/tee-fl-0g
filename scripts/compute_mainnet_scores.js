// scripts/compute_mainnet_scores.js - Compute scores and post scores root on mainnet
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config({ path: '.env.mainnet' });

(async () => {
  console.log("📊 Computing Scores on Mainnet...");
  
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
  
  // Check if epoch exists
  console.log(`\n📋 Checking Epoch ${epochId}...`);
  const epochInfo = await epochManager.epochs(epochId);
  if (epochInfo.modelHash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    throw new Error('Epoch 1 not started. Please start epoch first.');
  }
  console.log(`✅ Epoch ${epochId} is active`);
  
  // Get submitted updates from events
  console.log(`\n📦 Getting Submitted Updates from Events...`);
  
  const filter = epochManager.filters.UpdateSubmitted(epochId);
  const events = await epochManager.queryFilter(filter);
  
  console.log(`   Total updates: ${events.length}`);
  
  if (events.length === 0) {
    throw new Error('No updates submitted to epoch 1. Please submit an update first.');
  }
  
  // Extract update data from events
  const updateHashes = [];
  const updateCids = [];
  const submitters = [];
  
  for (const event of events) {
    updateCids.push(event.args.updateCid);
    updateHashes.push(event.args.updateHash);
    submitters.push(event.args.submitter);
    
    console.log(`   Update ${events.indexOf(event) + 1}:`);
    console.log(`     CID: ${event.args.updateCid}`);
    console.log(`     Hash: ${event.args.updateHash}`);
    console.log(`     Submitter: ${event.args.submitter}`);
  }
  
  // Compute scores root (simplified - in production this would compute actual scores)
  // For testing, we'll create a simple Merkle root from the update hashes
  console.log(`\n📊 Computing Scores Root...`);
  
  // Create a simple scores root from update hashes
  // In production, this would compute actual contribution scores
  let scoresRoot;
  if (updateHashes.length === 1) {
    // Single update - use its hash as root
    scoresRoot = updateHashes[0];
  } else {
    // Multiple updates - create Merkle root
    // Simplified: concatenate and hash
    const combined = ethers.concat(updateHashes);
    scoresRoot = ethers.keccak256(combined);
  }
  
  console.log(`   Scores root: ${scoresRoot}`);
  
  // Post scores root
  console.log(`\n📤 Posting scores root...`);
  try {
    const tx = await epochManager.postScoresRoot(epochId, scoresRoot);
    console.log(`   Transaction hash: ${tx.hash}`);
    await tx.wait();
    console.log(`✅ Scores root posted successfully!`);
    
    // Verify scores root was posted
    const updatedEpochInfo = await epochManager.epochs(epochId);
    console.log(`\n📊 Verification:`);
    console.log(`   Scores root: ${updatedEpochInfo.scoresRoot}`);
    console.log(`   Match: ${updatedEpochInfo.scoresRoot === scoresRoot ? 'Yes' : 'No'}`);
    
    console.log(`\n🎉 Scores computation complete!`);
    
  } catch (error) {
    console.error(`❌ Posting scores root failed:`, error.message);
    throw error;
  }
  
})().catch(e => { 
  console.error("Failed:", e); 
  process.exit(1); 
});
