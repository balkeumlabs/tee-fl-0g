#!/usr/bin/env node
// scripts/check_mainnet_balance.cjs - Check mainnet wallet balance

const { ethers } = require("ethers");

async function main() {
  const RPC_ENDPOINT = "https://evmrpc.0g.ai";
  const CHAIN_ID = 16661;
  
  // You need to set your mainnet private key
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  
  if (!PRIVATE_KEY) {
    console.log("❌ Please set PRIVATE_KEY environment variable with your mainnet private key");
    console.log("Example: PRIVATE_KEY=0x... node scripts/check_mainnet_balance.cjs");
    process.exit(1);
  }
  
  try {
    const provider = new ethers.JsonRpcProvider(RPC_ENDPOINT, {
      name: "0g-mainnet",
      chainId: CHAIN_ID
    });
    
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const address = await wallet.getAddress();
    const balance = await provider.getBalance(address);
    
    console.log(`Wallet: ${address}`);
    console.log(`Balance: ${ethers.formatEther(balance)} 0G`);
    
    if (balance === 0n) {
      console.log("❌ No 0G tokens found. You need 0G tokens for deployment.");
      console.log("Visit: https://docs.0g.ai/developer-hub/mainnet/mainnet-overview");
    } else {
      console.log("✅ Sufficient balance for deployment");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main().catch(console.error);
