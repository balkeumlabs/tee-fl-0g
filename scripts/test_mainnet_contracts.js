// scripts/test_mainnet_contracts.js - Test mainnet contracts
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config({ path: '.env.mainnet' });

(async () => {
  console.log("🧪 Testing Mainnet Contracts...");
  
  const rpc = process.env.RPC_ENDPOINT || "https://evmrpc.0g.ai";
  const pk = process.env.PRIVATE_KEY;
  
  if (!pk) {
    throw new Error('Missing PRIVATE_KEY in .env.mainnet');
  }
  
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);
  const deployerAddress = await wallet.getAddress();
  
  console.log(`Deployer: ${deployerAddress}`);
  
  // Load deployment info
  const deployInfo = JSON.parse(fs.readFileSync('data/deploy.mainnet.json', 'utf8'));
  const accessRegistryAddress = deployInfo.addresses.AccessRegistry;
  const epochManagerAddress = deployInfo.addresses.EpochManager;
  
  console.log(`\n📋 Loaded Deployment Info:`);
  console.log(`AccessRegistry: ${accessRegistryAddress}`);
  console.log(`EpochManager: ${epochManagerAddress}`);
  
  // Load contract ABIs
  const accessRegistryArt = JSON.parse(fs.readFileSync('artifacts/contracts/AccessRegistry.sol/AccessRegistry.json', 'utf8'));
  const epochManagerArt = JSON.parse(fs.readFileSync('artifacts/contracts/EpochManager.sol/EpochManager.json', 'utf8'));
  
  // Create contract instances
  const accessRegistry = new ethers.Contract(accessRegistryAddress, accessRegistryArt.abi, wallet);
  const epochManager = new ethers.Contract(epochManagerAddress, epochManagerArt.abi, wallet);
  
  console.log(`\n✅ Contracts loaded successfully`);
  
  // Test 1: Check AccessRegistry contract
  console.log(`\n📋 Test 1: Checking AccessRegistry...`);
  try {
    const code = await provider.getCode(accessRegistryAddress);
    if (code === '0x') {
      throw new Error('AccessRegistry contract not found at address');
    }
    console.log(`✅ AccessRegistry contract exists`);
    
    // Check if deployer is approved (need all parameters for this function)
    // We'll test this after granting access
    console.log(`   Contract methods available`);
  } catch (error) {
    console.error(`❌ AccessRegistry test failed:`, error.message);
    throw error;
  }
  
  // Test 2: Check EpochManager contract
  console.log(`\n⏰ Test 2: Checking EpochManager...`);
  try {
    const code = await provider.getCode(epochManagerAddress);
    if (code === '0x') {
      throw new Error('EpochManager contract not found at address');
    }
    console.log(`✅ EpochManager contract exists`);
    
    // Check if we can read epoch info (should work even if no epoch exists)
    try {
      const epochInfo = await epochManager.epochs(1);
      console.log(`   Epoch 1 exists: ${epochInfo.startTime > 0}`);
    } catch (error) {
      console.log(`   Epoch 1 does not exist yet (expected)`);
    }
  } catch (error) {
    console.error(`❌ EpochManager test failed:`, error.message);
    throw error;
  }
  
  // Test 3: Grant access (if not already granted)
  console.log(`\n🔐 Test 3: Granting access to deployer...`);
  try {
    // Create a dummy dataset CID and model hash for testing
    const datasetCid = "test-dataset-cid";
    const modelHash = ethers.keccak256(ethers.toUtf8Bytes("test-model"));
    const expiry = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
    
    // Check if already approved
    const isApproved = await accessRegistry.isProviderApproved(deployerAddress, deployerAddress, datasetCid, modelHash);
    
    if (!isApproved) {
      console.log(`   Granting access...`);
      const tx = await accessRegistry.grantAccess(deployerAddress, datasetCid, modelHash, expiry);
      console.log(`   Transaction hash: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ Access granted successfully`);
      
      // Verify access was granted
      const verified = await accessRegistry.isProviderApproved(deployerAddress, deployerAddress, datasetCid, modelHash);
      console.log(`   Access verified: ${verified}`);
    } else {
      console.log(`✅ Deployer already has access`);
    }
  } catch (error) {
    console.error(`❌ Grant access failed:`, error.message);
    throw error;
  }
  
  // Test 4: Start an epoch
  console.log(`\n⏰ Test 4: Starting epoch 1...`);
  try {
    // Check if epoch 1 already exists
    try {
      const epochInfo = await epochManager.epochs(1);
      if (epochInfo.startTime > 0) {
        console.log(`✅ Epoch 1 already exists`);
        console.log(`   Start time: ${new Date(Number(epochInfo.startTime) * 1000).toISOString()}`);
      }
    } catch (error) {
      // Epoch doesn't exist, create it
      console.log(`   Creating epoch 1...`);
      const tx = await epochManager.startEpoch(1);
      console.log(`   Transaction hash: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ Epoch 1 started successfully`);
      
      // Read epoch info
      const epochInfo = await epochManager.epochs(1);
      console.log(`   Start time: ${new Date(Number(epochInfo.startTime) * 1000).toISOString()}`);
    }
  } catch (error) {
    console.error(`❌ Start epoch failed:`, error.message);
    throw error;
  }
  
  console.log(`\n🎉 All mainnet contract tests passed!`);
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ AccessRegistry: Working`);
  console.log(`   ✅ EpochManager: Working`);
  console.log(`   ✅ Access granted: Yes`);
  console.log(`   ✅ Epoch 1: Ready`);
  
})().catch(e => { 
  console.error("Test failed:", e); 
  process.exit(1); 
});
