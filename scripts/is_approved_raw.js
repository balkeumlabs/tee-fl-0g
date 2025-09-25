// scripts/is_approved_raw.js
import { readFile } from 'node:fs/promises';
import { JsonRpcProvider, Wallet, ethers } from 'ethers';

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://evmrpc-testnet.0g.ai';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

// AccessRegistry ABI (minimal interface)
const ACCESS_REGISTRY_ABI = [
  "function isProviderApproved(address provider) external view returns (bool)",
  "function getProviderInfo(address provider) external view returns (address owner, uint256 expiry, bool approved)"
];

async function main() {
  const provider = process.argv[2];

  if (!provider) {
    console.error("Usage: node scripts/is_approved_raw.js <provider>");
    console.error("Example: node scripts/is_approved_raw.js 0x1234...");
    process.exit(2);
  }

  try {
    // Load deployment addresses
    const deployInfo = JSON.parse(await readFile('deploy.out.json', 'utf8'));
    const accessRegistryAddress = deployInfo.addresses.AccessRegistry;

    if (!accessRegistryAddress) {
      console.error("Error: AccessRegistry address not found in deploy.out.json");
      process.exit(1);
    }

    console.log(`Checking approval status for provider: ${provider}`);
    console.log(`AccessRegistry: ${accessRegistryAddress}`);

    // Initialize provider and signer with explicit network
    const rpcProvider = new JsonRpcProvider(RPC_ENDPOINT, {
      name: "0g-galileo",
      chainId: 16601
    });
    
    // Test connection first
    await rpcProvider.getBlockNumber();
    console.log("✅ RPC connection verified");
    
    const signer = new Wallet(PRIVATE_KEY, rpcProvider);

    // Create contract instance
    const contract = new ethers.Contract(accessRegistryAddress, ACCESS_REGISTRY_ABI, signer);

    // Check approval status
    const isApproved = await contract.isProviderApproved(provider);
    console.log(`Provider ${provider} approved: ${isApproved}`);

    // Get detailed info
    const info = await contract.getProviderInfo(provider);
    console.log(`Provider info:`);
    console.log(`  Owner: ${info[0]}`);
    console.log(`  Expiry: ${info[1]} (${new Date(Number(info[1]) * 1000).toISOString()})`);
    console.log(`  Approved: ${info[2]}`);

  } catch (error) {
    console.error(`Failed to check approval status: ${error.message}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.stack || String(e));
  process.exit(1);
});
