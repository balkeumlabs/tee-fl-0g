// scripts/deploy_mainnet.js - Deploy contracts to 0G Mainnet
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import { execSync } from 'child_process';

dotenv.config({ path: '.env.mainnet' });

(async () => {
  console.log("🚀 Deploying to 0G Mainnet...");
  
  const rpc = process.env.RPC_ENDPOINT || "https://evmrpc.0g.ai";
  const pk = process.env.PRIVATE_KEY;
  
  if (!pk) {
    throw new Error('Missing PRIVATE_KEY in .env.mainnet');
  }
  
  console.log(`RPC: ${rpc}`);
  console.log(`Chain ID: 16661`);
  
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);
  
  console.log(`Deployer: ${await wallet.getAddress()}`);
  
  // Check balance
  const balance = await provider.getBalance(await wallet.getAddress());
  console.log(`Balance: ${ethers.formatEther(balance)} 0G`);
  
  if (balance === 0n) {
    throw new Error("Insufficient balance for deployment");
  }
  
  const addresses = {};
  
  // Deploy AccessRegistry
  console.log("\n📋 Deploying AccessRegistry...");
  const accessRegistryArt = JSON.parse(fs.readFileSync('artifacts/contracts/AccessRegistry.sol/AccessRegistry.json', 'utf8'));
  const accessRegistryFac = new ethers.ContractFactory(accessRegistryArt.abi, accessRegistryArt.bytecode, wallet);
  const accessRegistry = await accessRegistryFac.deploy();
  console.log('// Deploy tx:', (await accessRegistry.deploymentTransaction()).hash);
  await accessRegistry.waitForDeployment();
  const accessRegistryAddress = await accessRegistry.getAddress();
  addresses.AccessRegistry = accessRegistryAddress;
  console.log(`✅ AccessRegistry deployed: ${accessRegistryAddress}`);
  
  // Deploy EpochManager
  console.log("\n⏰ Deploying EpochManager...");
  const epochManagerArt = JSON.parse(fs.readFileSync('artifacts/contracts/EpochManager.sol/EpochManager.json', 'utf8'));
  const epochManagerFac = new ethers.ContractFactory(epochManagerArt.abi, epochManagerArt.bytecode, wallet);
  const epochManager = await epochManagerFac.deploy();
  console.log('// Deploy tx:', (await epochManager.deploymentTransaction()).hash);
  await epochManager.waitForDeployment();
  const epochManagerAddress = await epochManager.getAddress();
  addresses.EpochManager = epochManagerAddress;
  console.log(`✅ EpochManager deployed: ${epochManagerAddress}`);
  
  // Save deployment info
  const deployInfo = {
    network: "0G-Mainnet",
    chainId: 16661,
    commit: execSync("git rev-parse HEAD").toString().trim(),
    addresses: {
      AccessRegistry: accessRegistryAddress,
      EpochManager: epochManagerAddress,
      Deployer: await wallet.getAddress()
    },
    generatedAtUtc: new Date().toISOString()
  };
  
  fs.writeFileSync("data/deploy.mainnet.json", JSON.stringify(deployInfo, null, 2));
  console.log("\n💾 Deployment info saved to data/deploy.mainnet.json");
  
  console.log("\n🎉 Mainnet deployment complete!");
  console.log(`AccessRegistry: ${accessRegistryAddress}`);
  console.log(`EpochManager: ${epochManagerAddress}`);
})().catch(e => { 
  console.error("Deployment failed:", e); 
  process.exit(1); 
});