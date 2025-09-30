// scripts/test_rpc_connection.js
import { JsonRpcProvider } from 'ethers';

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://evmrpc-testnet.0g.ai';

async function testRPCConnection() {
  console.log(`Testing RPC connection to: ${RPC_ENDPOINT}`);
  
  try {
    // Create provider with explicit network config
    const provider = new JsonRpcProvider(RPC_ENDPOINT, {
      name: "0g-galileo",
      chainId: 16602
    });

    console.log("Provider created, testing connection...");
    
    // Test basic RPC call
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ Connection successful! Current block: ${blockNumber}`);
    
    // Test chain ID
    const network = await provider.getNetwork();
    console.log(`✅ Network detected: ${network.name} (Chain ID: ${network.chainId})`);
    
    // Test contract call (read-only)
    const accessRegistryAddress = "0xE3bffF639B4522Fa3D1E72973f9BEc040504c21e";
    const code = await provider.getCode(accessRegistryAddress);
    
    if (code === "0x") {
      console.log(`❌ Contract not found at ${accessRegistryAddress}`);
    } else {
      console.log(`✅ Contract found at ${accessRegistryAddress} (${code.length} bytes)`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Connection failed: ${error.message}`);
    return false;
  }
}

testRPCConnection().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error(`Script failed: ${error.message}`);
  process.exit(1);
});
