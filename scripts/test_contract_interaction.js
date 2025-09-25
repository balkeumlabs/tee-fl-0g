// scripts/test_contract_interaction.js
import { JsonRpcProvider, Wallet, ethers } from 'ethers';
import { readFile } from 'node:fs/promises';

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://rpc.ankr.com/0g_galileo_testnet_evm';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x1234567890123456789012345678901234567890123456789012345678901234';

// AccessRegistry ABI (minimal interface)
const ACCESS_REGISTRY_ABI = [
  "function isProviderApproved(address provider) external view returns (bool)",
  "function getProviderInfo(address provider) external view returns (address owner, uint256 expiry, bool approved)"
];

async function testContractInteraction() {
  console.log(`Testing contract interaction with: ${RPC_ENDPOINT}`);
  
  try {
    // Load deployment addresses
    const deployInfo = JSON.parse(await readFile('deploy.out.json', 'utf8'));
    const accessRegistryAddress = deployInfo.addresses.AccessRegistry;
    
    console.log(`AccessRegistry: ${accessRegistryAddress}`);
    
    // Create provider with explicit network config
    const provider = new JsonRpcProvider(RPC_ENDPOINT, {
      name: "0g-galileo",
      chainId: 16601
    });

    console.log("Provider created, testing connection...");
    
    // Test basic RPC call
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ Connection successful! Current block: ${blockNumber}`);
    
    // Create signer
    const signer = new Wallet(PRIVATE_KEY, provider);
    console.log(`Signer address: ${await signer.getAddress()}`);
    
    // Create contract instance
    const contract = new ethers.Contract(accessRegistryAddress, ACCESS_REGISTRY_ABI, signer);
    
    // Test contract call
    const testProvider = "0x9Ed57870379e28E32cb627bE365745dc184950dF";
    console.log(`Testing contract call for provider: ${testProvider}`);
    
    const isApproved = await contract.isProviderApproved(testProvider);
    console.log(`✅ Contract call successful! Provider approved: ${isApproved}`);
    
    // Get detailed info
    const info = await contract.getProviderInfo(testProvider);
    console.log(`Provider info:`);
    console.log(`  Owner: ${info[0]}`);
    console.log(`  Expiry: ${info[1]} (${new Date(Number(info[1]) * 1000).toISOString()})`);
    console.log(`  Approved: ${info[2]}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Contract interaction failed: ${error.message}`);
    return false;
  }
}

testContractInteraction().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error(`Script failed: ${error.message}`);
  process.exit(1);
});
