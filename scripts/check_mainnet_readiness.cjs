#!/usr/bin/env node
// scripts/check_mainnet_readiness.cjs - Check if ready for mainnet deployment

const { ethers } = require("ethers");

async function main() {
  const RPC_ENDPOINT = "https://evmrpc.0g.ai";
  const CHAIN_ID = 16661;
  
  // Load mainnet private key
  const fs = require('fs');
  let mainnetEnv;
  try {
    mainnetEnv = fs.readFileSync('.env.mainnet', 'utf8');
  } catch (error) {
    console.log("❌ .env.mainnet file not found");
    process.exit(1);
  }
  
  const privateKeyMatch = mainnetEnv.match(/PRIVATE_KEY=(.+)/);
  if (!privateKeyMatch) {
    console.log("❌ PRIVATE_KEY not found in .env.mainnet");
    process.exit(1);
  }
  
  const PRIVATE_KEY = privateKeyMatch[1].trim();
  
  try {
    const provider = new ethers.JsonRpcProvider(RPC_ENDPOINT, {
      name: "0g-mainnet",
      chainId: CHAIN_ID
    });
    
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const address = await wallet.getAddress();
    const balance = await provider.getBalance(address);
    
    console.log("🚀 Mainnet Deployment Readiness Check");
    console.log("=====================================");
    console.log(`✅ Network: 0G Mainnet (Chain ID: ${CHAIN_ID})`);
    console.log(`✅ RPC: ${RPC_ENDPOINT}`);
    console.log(`✅ Wallet: ${address}`);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} 0G`);
    
    if (balance === 0n) {
      console.log("⏳ Status: Waiting for 0G tokens from 0G team");
      console.log("📝 Next: Once tokens are received, run deployment");
    } else {
      console.log("🎉 Status: Ready for mainnet deployment!");
      console.log("📝 Next: Run 'node scripts/deploy_mainnet.js'");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main().catch(console.error);
