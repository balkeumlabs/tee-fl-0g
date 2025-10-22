#!/usr/bin/env node
// scripts/deploy_mainnet.js - Deploy contracts to 0G Mainnet

const { ethers } = require("hardhat");
const fs = require("fs").promises;

async function main() {
  console.log("🚀 Deploying to 0G Mainnet...");
  
  // Check environment
  const rpc = process.env.RPC_ENDPOINT;
  const pk = process.env.PRIVATE_KEY;
  
  if (!rpc || !pk) {
    throw new Error("Missing RPC_ENDPOINT or PRIVATE_KEY in .env");
  }
  
  console.log(`RPC: ${rpc}`);
  console.log(`Chain ID: 16661`);
  
  // Create provider and wallet
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
  const AccessRegistry = await ethers.getContractFactory("AccessRegistry");
  const accessRegistry = await AccessRegistry.deploy();
  await accessRegistry.waitForDeployment();
  const accessRegistryAddress = await accessRegistry.getAddress();
  addresses.AccessRegistry = accessRegistryAddress;
  console.log(`✅ AccessRegistry deployed: ${accessRegistryAddress}`);
  
  // Deploy EpochManager
  console.log("\n⏰ Deploying EpochManager...");
  const EpochManager = await ethers.getContractFactory("EpochManager");
  const epochManager = await EpochManager.deploy();
  await epochManager.waitForDeployment();
  const epochManagerAddress = await epochManager.getAddress();
  addresses.EpochManager = epochManagerAddress;
  console.log(`✅ EpochManager deployed: ${epochManagerAddress}`);
  
  // Save deployment info
  const deployInfo = {
    network: "0G-Mainnet",
    chainId: 16661,
    commit: require("child_process").execSync("git rev-parse HEAD").toString().trim(),
    addresses: {
      AccessRegistry: accessRegistryAddress,
      EpochManager: epochManagerAddress,
      Deployer: await wallet.getAddress()
    },
    generatedAtUtc: new Date().toISOString()
  };
  
  await fs.writeFile("data/deploy.mainnet.json", JSON.stringify(deployInfo, null, 2));
  console.log("\n💾 Deployment info saved to data/deploy.mainnet.json");
  
  console.log("\n🎉 Mainnet deployment complete!");
  console.log(`AccessRegistry: ${accessRegistryAddress}`);
  console.log(`EpochManager: ${epochManagerAddress}`);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exit(1);
});
