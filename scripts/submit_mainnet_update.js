// scripts/submit_mainnet_update.js - Submit encrypted update to mainnet epoch
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config({ path: '.env.mainnet' });

(async () => {
  console.log("📤 Submitting Encrypted Update to Mainnet...");
  
  const rpc = process.env.RPC_ENDPOINT || "https://evmrpc.0g.ai";
  const pk = process.env.PRIVATE_KEY;
  
  if (!pk) {
    throw new Error('Missing PRIVATE_KEY in .env.mainnet');
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
  
  const epochId = 1;
  
  // Check if epoch exists
  console.log(`\n📋 Checking Epoch ${epochId}...`);
  const epochInfo = await epochManager.epochs(epochId);
  if (epochInfo.modelHash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    throw new Error('Epoch 1 not started. Please start epoch first.');
  }
  console.log(`✅ Epoch ${epochId} is active`);
  console.log(`   Model hash: ${epochInfo.modelHash}`);
  
  // Load encrypted update file
  const updateFile = 'examples/client_update.enc.json';
  if (!fs.existsSync(updateFile)) {
    throw new Error(`Update file not found: ${updateFile}`);
  }
  
  const updateContent = fs.readFileSync(updateFile, 'utf8').replace(/^\uFEFF/, ''); // Remove BOM if present
  const updateData = JSON.parse(updateContent);
  console.log(`\n📦 Loaded encrypted update from: ${updateFile}`);
  
  // Create a test update CID and hash
  // In production, this would be the actual CID from 0G Storage
  const updateCid = `test-update-${Date.now()}`;
  const updateHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(updateData)));
  
  console.log(`\n📤 Submitting update...`);
  console.log(`   Update CID: ${updateCid}`);
  console.log(`   Update hash: ${updateHash}`);
  
  try {
    const tx = await epochManager.submitUpdate(epochId, updateCid, updateHash);
    console.log(`   Transaction hash: ${tx.hash}`);
    await tx.wait();
    console.log(`✅ Update submitted successfully!`);
    
    // Verify submission
    const updateCids = await epochManager.epochUpdateCids(epochId, 0);
    const updateHashes = await epochManager.epochUpdateHashes(epochId, 0);
    const submitters = await epochManager.epochSubmitters(epochId, 0);
    
    console.log(`\n📊 Verification:`);
    console.log(`   Total updates: 1`);
    console.log(`   Update CID: ${updateCids}`);
    console.log(`   Update hash: ${updateHashes}`);
    console.log(`   Submitter: ${submitters}`);
    
    console.log(`\n🎉 Update submission complete!`);
    
  } catch (error) {
    console.error(`❌ Submission failed:`, error.message);
    throw error;
  }
  
})().catch(e => { 
  console.error("Failed:", e); 
  process.exit(1); 
});
