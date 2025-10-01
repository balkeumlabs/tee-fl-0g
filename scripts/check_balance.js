// scripts/check_balance.js
import { JsonRpcProvider, Wallet, ethers } from 'ethers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://evmrpc-testnet.0g.ai';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error('❌ PRIVATE_KEY environment variable not set');
  process.exit(1);
}

async function checkBalance() {
  try {
    const provider = new JsonRpcProvider(RPC_ENDPOINT, {
      name: "0g-galileo",
      chainId: 16602
    });
    
    const wallet = new Wallet(PRIVATE_KEY, provider);
    const address = await wallet.getAddress();
    const balance = await provider.getBalance(address);
    
    console.log('Wallet address:', address);
    console.log('Balance:', ethers.formatEther(balance), '0G');
    console.log('Balance (wei):', balance.toString());
    
    if (balance > 0n) {
      console.log('✅ Wallet has funds - ready for testing!');
    } else {
      console.log('❌ Wallet has no funds - need 0G tokens');
    }
    
  } catch (error) {
    console.error('❌ Error checking balance:', error.message);
    process.exit(1);
  }
}

checkBalance();
