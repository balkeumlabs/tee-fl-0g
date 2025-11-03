// scripts/start_mainnet_epoch.js - Start epoch on mainnet
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config({ path: '.env.mainnet' });

(async () => {
  console.log("🚀 Starting Epoch on Mainnet...");
  
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
  
  // Check if epoch already exists
  console.log(`\n📋 Checking Epoch ${epochId}...`);
  try {
    const epochInfo = await epochManager.epochs(epochId);
    const modelHash = epochInfo.modelHash;
    
    if (modelHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      console.log(`✅ Epoch ${epochId} already started`);
      console.log(`   Model hash: ${modelHash}`);
      console.log(`   Scores root: ${epochInfo.scoresRoot === '0x0000000000000000000000000000000000000000000000000000000000000000' ? 'Not set' : epochInfo.scoresRoot}`);
      console.log(`   Global model hash: ${epochInfo.globalModelHash === '0x0000000000000000000000000000000000000000000000000000000000000000' ? 'Not set' : epochInfo.globalModelHash}`);
      console.log(`   Published: ${epochInfo.published ? 'Yes' : 'No'}`);
    } else {
      console.log(`⚠️  Epoch ${epochId} not started yet. Starting epoch...`);
      // Create a model hash for the epoch (using timestamp as seed)
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes(`epoch-${epochId}-${Date.now()}`));
      console.log(`   Model hash: ${modelHash}`);
      
      const tx = await epochManager.startEpoch(epochId, modelHash);
      console.log(`   Transaction hash: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ Epoch ${epochId} started successfully`);
      
      // Read epoch info again
      const newEpochInfo = await epochManager.epochs(epochId);
      console.log(`   Model hash: ${newEpochInfo.modelHash}`);
      console.log(`   Scores root: ${newEpochInfo.scoresRoot === '0x0000000000000000000000000000000000000000000000000000000000000000' ? 'Not set' : newEpochInfo.scoresRoot}`);
    }
  } catch (error) {
    console.error(`❌ Failed to start epoch:`, error.message);
    throw error;
  }
  
  console.log(`\n🎉 Epoch ${epochId} is ready for submissions!`);
  
})().catch(e => { 
  console.error("Failed:", e); 
  process.exit(1); 
});
