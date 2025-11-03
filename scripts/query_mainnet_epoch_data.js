// scripts/query_mainnet_epoch_data.js - Query actual epoch data from mainnet
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config({ path: '.env.mainnet' });

(async () => {
  console.log("🔍 Querying Mainnet Epoch Data...");
  
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
  
  // Get epoch info
  console.log(`\n📋 Getting Epoch ${epochId} Data...`);
  const epochInfo = await epochManager.epochs(epochId);
  
  // Get all events for this epoch
  console.log(`\n📋 Getting Events for Epoch ${epochId}...`);
  
  // EpochStarted event
  const startedFilter = epochManager.filters.EpochStarted(epochId);
  const startedEvents = await epochManager.queryFilter(startedFilter);
  
  // UpdateSubmitted events
  const updateFilter = epochManager.filters.UpdateSubmitted(epochId);
  const updateEvents = await epochManager.queryFilter(updateFilter);
  
  // ScoresRootPosted event
  const scoresFilter = epochManager.filters.ScoresRootPosted(epochId);
  const scoresEvents = await epochManager.queryFilter(scoresFilter);
  
  // ModelPublished event
  const publishFilter = epochManager.filters.ModelPublished(epochId);
  const publishEvents = await epochManager.queryFilter(publishFilter);
  
  // Compile all data
  const epochData = {
    epochId: epochId,
    network: "0G Mainnet",
    chainId: 16661,
    contractAddress: epochManagerAddress,
    timestamp: new Date().toISOString(),
    
    epochInfo: {
      modelHash: epochInfo.modelHash,
      scoresRoot: epochInfo.scoresRoot,
      globalModelCid: epochInfo.globalModelCid,
      globalModelHash: epochInfo.globalModelHash,
      published: epochInfo.published
    },
    
    events: {
      epochStarted: startedEvents.map(e => ({
        transactionHash: e.transactionHash,
        blockNumber: e.blockNumber,
        modelHash: e.args.modelHash,
        timestamp: e.blockTimestamp
      })),
      
      updatesSubmitted: updateEvents.map(e => ({
        transactionHash: e.transactionHash,
        blockNumber: e.blockNumber,
        submitter: e.args.submitter,
        updateCid: e.args.updateCid,
        updateHash: e.args.updateHash,
        timestamp: e.blockTimestamp
      })),
      
      scoresPosted: scoresEvents.map(e => ({
        transactionHash: e.transactionHash,
        blockNumber: e.blockNumber,
        scoresRoot: e.args.scoresRoot,
        timestamp: e.blockTimestamp
      })),
      
      modelPublished: publishEvents.map(e => ({
        transactionHash: e.transactionHash,
        blockNumber: e.blockNumber,
        globalModelCid: e.args.globalModelCid,
        globalModelHash: e.args.globalModelHash,
        timestamp: e.blockTimestamp
      }))
    }
  };
  
  // Save to file
  fs.writeFileSync('data/epoch_1_mainnet_data.json', JSON.stringify(epochData, null, 2));
  
  console.log(`\n✅ Epoch Data Queried:`);
  console.log(`   Epoch ID: ${epochId}`);
  console.log(`   Model Hash: ${epochInfo.modelHash}`);
  console.log(`   Scores Root: ${epochInfo.scoresRoot}`);
  console.log(`   Global Model CID: ${epochInfo.globalModelCid}`);
  console.log(`   Global Model Hash: ${epochInfo.globalModelHash}`);
  console.log(`   Published: ${epochInfo.published}`);
  console.log(`\n📊 Events:`);
  console.log(`   Epoch Started: ${startedEvents.length}`);
  console.log(`   Updates Submitted: ${updateEvents.length}`);
  console.log(`   Scores Posted: ${scoresEvents.length}`);
  console.log(`   Model Published: ${publishEvents.length}`);
  
  console.log(`\n💾 Data saved to: data/epoch_1_mainnet_data.json`);
  
  // Display detailed update info
  if (updateEvents.length > 0) {
    console.log(`\n📦 Submitted Updates:`);
    updateEvents.forEach((e, i) => {
      console.log(`   Update ${i + 1}:`);
      console.log(`     CID: ${e.args.updateCid}`);
      console.log(`     Hash: ${e.args.updateHash}`);
      console.log(`     Submitter: ${e.args.submitter}`);
      console.log(`     TX: ${e.transactionHash}`);
    });
  }
  
})().catch(e => { 
  console.error("Failed:", e); 
  process.exit(1); 
});
