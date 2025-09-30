// scripts/test_grant_access.js
import { JsonRpcProvider, Wallet, ethers } from 'ethers';
import { readFile } from 'node:fs/promises';

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://evmrpc-testnet.0g.ai';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x1234567890123456789012345678901234567890123456789012345678901234';

// AccessRegistry ABI (minimal interface)
const ACCESS_REGISTRY_ABI = [
  "function grantAccess(address provider, uint256 expiry) external",
  "function isProviderApproved(address provider) external view returns (bool)",
  "function getProviderInfo(address provider) external view returns (address owner, uint256 expiry, bool approved)"
];

async function testGrantAccess() {
  console.log(`Testing grant access with: ${RPC_ENDPOINT}`);
  
  try {
    // Load deployment addresses
    const deployInfo = JSON.parse(await readFile('deploy.out.json', 'utf8'));
    const accessRegistryAddress = deployInfo.addresses.AccessRegistry;
    
    console.log(`AccessRegistry: ${accessRegistryAddress}`);
    
    // Create provider with explicit network config
    const provider = new JsonRpcProvider(RPC_ENDPOINT, {
      name: "0g-galileo",
      chainId: 16602
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
    
    // Test provider to grant access to
    const testProvider = "0x9Ed57870379e28E32cb627bE365745dc184950dF";
    console.log(`Granting access to provider: ${testProvider}`);
    
    // Set expiry (1 year from now)
    const expiryTime = BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60);
    console.log(`Expiry: ${expiryTime} (${new Date(Number(expiryTime) * 1000).toISOString()})`);
    
    // Grant access
    const tx = await contract.grantAccess(testProvider, expiryTime);
    console.log(`✅ Transaction submitted: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed}`);
    
    // Verify the access was granted
    const isApproved = await contract.isProviderApproved(testProvider);
    console.log(`✅ Provider ${testProvider} approved: ${isApproved}`);
    
    // Get detailed info
    const info = await contract.getProviderInfo(testProvider);
    console.log(`Provider info:`);
    console.log(`  Owner: ${info[0]}`);
    console.log(`  Expiry: ${info[1]} (${new Date(Number(info[1]) * 1000).toISOString()})`);
    console.log(`  Approved: ${info[2]}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Grant access failed: ${error.message}`);
    return false;
  }
}

testGrantAccess().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error(`Script failed: ${error.message}`);
  process.exit(1);
});
