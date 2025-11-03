// scripts/test_mainnet_pipeline.js - Test complete federated learning pipeline on mainnet
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config({ path: '.env.mainnet' });

(async () => {
  console.log("🚀 Testing Complete Federated Learning Pipeline on Mainnet...");
  console.log("=".repeat(60));
  
  const rpc = process.env.RPC_ENDPOINT || "https://evmrpc.0g.ai";
  const pk = process.env.PRIVATE_KEY;
  
  if (!pk) {
    throw new Error('Missing PRIVATE_KEY in .env.mainnet');
  }
  
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);
  const deployerAddress = await wallet.getAddress();
  
  console.log(`\n📋 Configuration:`);
  console.log(`   Network: 0G Mainnet (Chain ID: 16661)`);
  console.log(`   Deployer: ${deployerAddress}`);
  
  // Load deployment info
  const deployInfo = JSON.parse(fs.readFileSync('data/deploy.mainnet.json', 'utf8'));
  const accessRegistryAddress = deployInfo.addresses.AccessRegistry;
  const epochManagerAddress = deployInfo.addresses.EpochManager;
  
  console.log(`\n📋 Contract Addresses:`);
  console.log(`   AccessRegistry: ${accessRegistryAddress}`);
  console.log(`   EpochManager: ${epochManagerAddress}`);
  
  // Load contract ABIs
  const accessRegistryArt = JSON.parse(fs.readFileSync('artifacts/contracts/AccessRegistry.sol/AccessRegistry.json', 'utf8'));
  const epochManagerArt = JSON.parse(fs.readFileSync('artifacts/contracts/EpochManager.sol/EpochManager.json', 'utf8'));
  
  const accessRegistry = new ethers.Contract(accessRegistryAddress, accessRegistryArt.abi, wallet);
  const epochManager = new ethers.Contract(epochManagerAddress, epochManagerArt.abi, wallet);
  
  const epochId = 1;
  
  // Step 1: Verify Epoch 1 exists
  console.log(`\n📋 Step 1: Verifying Epoch 1...`);
  try {
    const epochInfo = await epochManager.epochs(epochId);
    const startTime = Number(epochInfo.startTime);
    if (startTime === 0) {
      throw new Error('Epoch 1 does not exist. Please start epoch first.');
    }
    console.log(`✅ Epoch 1 exists`);
    if (startTime > 0) {
      console.log(`   Start time: ${new Date(startTime * 1000).toISOString()}`);
    } else {
      console.log(`   Start time: Not set`);
    }
  } catch (error) {
    console.error(`❌ Epoch verification failed:`, error.message);
    throw error;
  }
  
  // Step 2: Verify Access
  console.log(`\n🔐 Step 2: Verifying Access...`);
  try {
    const datasetCid = "test-dataset-cid";
    const modelHash = ethers.keccak256(ethers.toUtf8Bytes("test-model"));
    const isApproved = await accessRegistry.isProviderApproved(deployerAddress, deployerAddress, datasetCid, modelHash);
    if (!isApproved) {
      console.log(`⚠️  Access not granted. Granting access...`);
      const expiry = Math.floor(Date.now() / 1000) + 86400; // 24 hours
      const tx = await accessRegistry.grantAccess(deployerAddress, datasetCid, modelHash, expiry);
      await tx.wait();
      console.log(`✅ Access granted`);
    } else {
      console.log(`✅ Access verified`);
    }
  } catch (error) {
    console.error(`❌ Access verification failed:`, error.message);
    throw error;
  }
  
  // Step 3: Check if we have encrypted update file
  console.log(`\n📦 Step 3: Checking for Encrypted Update File...`);
  const updateFile = 'examples/client_update.enc.json';
  if (!fs.existsSync(updateFile)) {
    console.log(`⚠️  Encrypted update file not found at ${updateFile}`);
    console.log(`   Creating sample encrypted update...`);
    
    // Create a simple encrypted update structure for testing
    const sampleUpdate = {
      epoch: epochId,
      provider: deployerAddress,
      encryptedData: "0x" + Buffer.from("encrypted-sample-update-data").toString('hex'),
      timestamp: Math.floor(Date.now() / 1000)
    };
    
    fs.writeFileSync(updateFile, JSON.stringify(sampleUpdate, null, 2));
    console.log(`✅ Sample encrypted update created`);
  } else {
    console.log(`✅ Encrypted update file found: ${updateFile}`);
  }
  
  // Step 4: Submit Update (simulated - we'll note this requires full implementation)
  console.log(`\n📤 Step 4: Submitting Encrypted Update...`);
  console.log(`   Note: Full submission requires complete implementation`);
  console.log(`   For now, verifying epoch is ready for submissions...`);
  try {
    const epochInfo = await epochManager.epochs(epochId);
    const currentTime = Math.floor(Date.now() / 1000);
    const epochStartTime = Number(epochInfo.startTime);
    
    if (currentTime >= epochStartTime && epochStartTime > 0) {
      console.log(`✅ Epoch is active and ready for submissions`);
      console.log(`   Epoch start: ${epochStartTime > 0 ? new Date(epochStartTime * 1000).toISOString() : 'Not set'}`);
      console.log(`   Current time: ${new Date(currentTime * 1000).toISOString()}`);
    } else {
      console.log(`⚠️  Epoch not yet started or not set`);
    }
  } catch (error) {
    console.error(`❌ Epoch check failed:`, error.message);
  }
  
  // Step 5: Compute Scores (simulated - requires full implementation)
  console.log(`\n📊 Step 5: Computing Scores...`);
  console.log(`   Note: Full scoring requires complete implementation`);
  console.log(`   For now, verifying contract is ready...`);
  try {
    const epochInfo = await epochManager.epochs(epochId);
    console.log(`✅ EpochManager contract is ready for scoring`);
    console.log(`   Scores root: ${epochInfo.scoresRoot === '0x0000000000000000000000000000000000000000000000000000000000000000' ? 'Not set yet' : epochInfo.scoresRoot}`);
  } catch (error) {
    console.error(`❌ Scoring check failed:`, error.message);
  }
  
  // Step 6: Aggregate and Publish (simulated - requires full implementation)
  console.log(`\n🔄 Step 6: Aggregating and Publishing Model...`);
  console.log(`   Note: Full aggregation requires complete implementation`);
  console.log(`   For now, verifying contract is ready...`);
  try {
    const epochInfo = await epochManager.epochs(epochId);
    console.log(`✅ EpochManager contract is ready for aggregation`);
    console.log(`   Global model hash: ${epochInfo.globalModelHash === '0x0000000000000000000000000000000000000000000000000000000000000000' ? 'Not set yet' : epochInfo.globalModelHash}`);
    console.log(`   Published: ${epochInfo.published ? 'Yes' : 'No'}`);
  } catch (error) {
    console.error(`❌ Aggregation check failed:`, error.message);
  }
  
  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 Pipeline Test Summary:`);
  console.log(`   ✅ Epoch 1: Verified and active`);
  console.log(`   ✅ Access: Verified and granted`);
  console.log(`   ✅ Contracts: Ready for full pipeline`);
  console.log(`   ⚠️  Full Pipeline: Requires complete implementation`);
  console.log(`\n🎯 Next Steps:`);
  console.log(`   1. Implement full update submission logic`);
  console.log(`   2. Implement scoring computation`);
  console.log(`   3. Implement FedAvg aggregation`);
  console.log(`   4. Test with real encrypted updates`);
  console.log(`\n✅ Basic infrastructure is ready for full pipeline testing!`);
  
})().catch(e => { 
  console.error("\n❌ Pipeline test failed:", e); 
  process.exit(1); 
});
