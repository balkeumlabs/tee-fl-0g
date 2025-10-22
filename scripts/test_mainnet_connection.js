#!/usr/bin/env node
// scripts/test_mainnet_connection.cjs - Test connection to 0G Mainnet

const { ethers } = require("ethers");

async function main() {
  const RPC_ENDPOINT = "https://evmrpc.0g.ai";
  const CHAIN_ID = 16661;
  
  console.log(`Testing RPC connection to: ${RPC_ENDPOINT}`);
  
  try {
    // Create provider with explicit network config
    const provider = new ethers.JsonRpcProvider(RPC_ENDPOINT, {
      name: "0g-mainnet",
      chainId: CHAIN_ID
    });
    
    console.log("Provider created, testing connection...");
    
    // Test basic connection
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ Connection successful! Current block: ${blockNumber}`);
    
    // Get network info
    const network = await provider.getNetwork();
    console.log(`✅ Network detected: ${network.name} (Chain ID: ${network.chainId})`);
    
    // Test if we can get latest block
    const latestBlock = await provider.getBlock("latest");
    console.log(`✅ Latest block hash: ${latestBlock.hash}`);
    
    console.log("\n🎉 Mainnet connection test successful!");
    
  } catch (error) {
    console.error("❌ Connection failed:", error.message);
    process.exit(1);
  }
}

main().catch(console.error);
