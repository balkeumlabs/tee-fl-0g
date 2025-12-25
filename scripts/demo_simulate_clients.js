// scripts/demo_simulate_clients.js - Simulate multiple clients for demo
// This script submits client updates to the latest active epoch to make the dashboard show a complete demo

import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

(async () => {
  console.log("🎬 Demo: Simulating Client Updates for Dashboard\n");

  const rpc = process.env.RPC_ENDPOINT || "https://evmrpc.0g.ai";
  const pk = process.env.PRIVATE_KEY;

  if (!pk) {
    throw new Error('Missing PRIVATE_KEY in .env');
  }

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);
  const deployerAddress = await wallet.getAddress();

  console.log(`👤 Using wallet: ${deployerAddress}\n`);

  // Load deployment info
  const deployInfo = JSON.parse(fs.readFileSync('data/deploy.mainnet.json', 'utf8'));
  const epochManagerAddress = deployInfo.addresses.EpochManager;

  // Load contract ABI
  const epochManagerArt = JSON.parse(fs.readFileSync('artifacts/contracts/EpochManager.sol/EpochManager.json', 'utf8'));
  const epochManager = new ethers.Contract(epochManagerAddress, epochManagerArt.abi, wallet);

  // Find latest active epoch
  console.log("📋 Finding latest active epoch...");
  let latestEpoch = 0;
  let epochInfo = null;
  
  for (let i = 10; i >= 1; i--) {
    try {
      const info = await epochManager.epochs(i);
      if (info.modelHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        latestEpoch = i;
        epochInfo = info;
        break;
      }
    } catch (e) {
      continue;
    }
  }

  if (latestEpoch === 0) {
    throw new Error('No active epoch found. Please start an epoch first using the training interface.');
  }

  console.log(`✅ Found active Epoch ${latestEpoch}`);
  console.log(`   Model hash: ${epochInfo.modelHash}`);
  console.log(`   Published: ${epochInfo.published}\n`);

  if (epochInfo.published) {
    console.log("⚠️  Epoch is already published. Starting a new epoch...");
    // Start a new epoch
    const nextEpochId = latestEpoch + 1;
    const modelHash = ethers.keccak256(ethers.toUtf8Bytes(`epoch-${nextEpochId}-${Date.now()}`));
    
    try {
      const tx = await epochManager.startEpoch(nextEpochId, modelHash);
      console.log(`   ✅ Started Epoch ${nextEpochId}: ${tx.hash}`);
      await tx.wait();
      latestEpoch = nextEpochId;
      epochInfo = await epochManager.epochs(latestEpoch);
    } catch (error) {
      console.error(`   ❌ Failed to start new epoch:`, error.message);
      throw error;
    }
  }

  // Check existing updates
  const existingFilter = epochManager.filters.UpdateSubmitted(latestEpoch);
  const existingEvents = await epochManager.queryFilter(existingFilter);
  console.log(`📊 Current status: ${existingEvents.length} update(s) already submitted\n`);

  // Step 1: Submit multiple client updates
  console.log("📤 Step 1: Submitting Client Updates...");
  const numClients = 5; // Number of clients to simulate
  const delay = 2000; // 2 seconds between submissions
  
  for (let i = 1; i <= numClients; i++) {
    // Create realistic update data
    const clientUpdate = {
      epoch: latestEpoch,
      clientId: `client-${i}`,
      timestamp: Math.floor(Date.now() / 1000),
      modelWeights: Array.from({ length: 10 }, () => Math.random()),
      loss: 0.5 - (i * 0.05), // Decreasing loss (improving model)
      accuracy: 0.6 + (i * 0.04), // Increasing accuracy
      round: latestEpoch
    };
    
    // Generate unique CID and hash for each client
    const updateCid = `demo-client${i}-epoch${latestEpoch}-${Date.now()}`;
    const updateHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(clientUpdate)));
    
    try {
      console.log(`   Submitting Client ${i}/${numClients}...`);
      const tx = await epochManager.submitUpdate(latestEpoch, updateCid, updateHash);
      console.log(`   ✅ Client ${i} update submitted: ${tx.hash.substring(0, 10)}...`);
      await tx.wait();
      
      // Small delay between submissions
      if (i < numClients) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error(`   ❌ Client ${i} submission failed:`, error.message);
      // Continue with next client
    }
  }

  // Verify submissions
  const filter = epochManager.filters.UpdateSubmitted(latestEpoch);
  const events = await epochManager.queryFilter(filter);
  const uniqueSubmitters = new Set(events.map(e => e.args.submitter));
  
  console.log(`\n✅ Client Updates Complete!`);
  console.log(`   Total updates: ${events.length}`);
  console.log(`   Unique clients: ${uniqueSubmitters.size}\n`);

  // Step 2: Post scores root (optional - only if not already posted)
  if (epochInfo.scoresRoot === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    console.log("📊 Step 2: Computing and Posting Scores Root...");
    
    // Create realistic scores based on submission order
    const scores = events.map((e, idx) => ({
      submitter: e.args.submitter,
      score: 0.75 + (idx * 0.04) // Scores: 0.75, 0.79, 0.83, 0.87, 0.91
    }));
    
    // Compute Merkle root (simplified - in production use proper Merkle tree)
    const scoresData = scores.map(s => `${s.submitter}-${s.score.toFixed(4)}`).join('|');
    const scoresRoot = ethers.keccak256(ethers.toUtf8Bytes(scoresData));
    
    console.log(`   Scores root: ${scoresRoot.substring(0, 20)}...`);
    console.log(`   Scores: ${scores.map(s => s.score.toFixed(2)).join(', ')}`);
    
    try {
      const tx = await epochManager.postScoresRoot(latestEpoch, scoresRoot);
      console.log(`   ✅ Scores root posted: ${tx.hash.substring(0, 10)}...`);
      await tx.wait();
      console.log(`\n✅ Scores posted!\n`);
    } catch (error) {
      console.error(`   ❌ Failed to post scores root:`, error.message);
      // Don't throw - continue to model publishing
    }
  } else {
    console.log("📊 Step 2: Scores root already posted, skipping...\n");
  }

  // Step 3: Publish aggregated model (optional - only if not already published)
  if (!epochInfo.published) {
    console.log("📦 Step 3: Publishing Aggregated Model...");
    
    // Create realistic aggregated model
    const globalModelCid = `aggregated-model-epoch${latestEpoch}-${Date.now()}`;
    const globalModelData = {
      epoch: latestEpoch,
      aggregated: true,
      timestamp: Math.floor(Date.now() / 1000),
      participants: events.length,
      avgLoss: 0.35,
      avgAccuracy: 0.82,
      modelVersion: `v1.${latestEpoch}`
    };
    const globalModelHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(globalModelData)));
    
    console.log(`   Global Model CID: ${globalModelCid}`);
    console.log(`   Global Model Hash: ${globalModelHash.substring(0, 20)}...`);
    
    try {
      const tx = await epochManager.publishModel(latestEpoch, globalModelCid, globalModelHash);
      console.log(`   ✅ Model published: ${tx.hash.substring(0, 10)}...`);
      await tx.wait();
      
      // Verify
      const finalEpochInfo = await epochManager.epochs(latestEpoch);
      console.log(`\n📊 Final Epoch Status:`);
      console.log(`   Published: ${finalEpochInfo.published}`);
      console.log(`   Global Model CID: ${finalEpochInfo.globalModelCid}`);
      console.log(`   Global Model Hash: ${finalEpochInfo.globalModelHash.substring(0, 20)}...`);
      
    } catch (error) {
      console.error(`   ❌ Failed to publish model:`, error.message);
      // Don't throw - demo is still useful with updates and scores
    }
  } else {
    console.log("📦 Step 3: Model already published, skipping...\n");
  }

  // Final summary
  const finalFilter = epochManager.filters.UpdateSubmitted(latestEpoch);
  const finalEvents = await epochManager.queryFilter(finalFilter);
  const finalUniqueSubmitters = new Set(finalEvents.map(e => e.args.submitter));
  const finalEpochInfo = await epochManager.epochs(latestEpoch);

  console.log(`\n🎉 Demo Simulation Complete!\n`);
  console.log(`📋 Summary:`);
  console.log(`   - Epoch ID: ${latestEpoch}`);
  console.log(`   - Client Updates: ${finalEvents.length}`);
  console.log(`   - Unique Clients: ${finalUniqueSubmitters.size}`);
  console.log(`   - Scores Posted: ${finalEpochInfo.scoresRoot !== '0x0000000000000000000000000000000000000000000000000000000000000000' ? '✅' : '❌'}`);
  console.log(`   - Model Published: ${finalEpochInfo.published ? '✅' : '❌'}`);
  console.log(`\n💡 Dashboard should now show:`);
  console.log(`   - Connected Clients: ${finalUniqueSubmitters.size}`);
  console.log(`   - Training Progress: Active`);
  console.log(`   - Updates Submitted: ${finalEvents.length}`);
  console.log(`   - Complete Pipeline: ${finalEpochInfo.published ? 'Yes' : 'Partial'}`);

})().catch(e => {
  console.error("\n❌ Demo failed:", e);
  process.exit(1);
});














