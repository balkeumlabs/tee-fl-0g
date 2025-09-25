// scripts/grant_access_raw.js
import { readFile } from 'node:fs/promises';
import { JsonRpcProvider, Wallet, ethers } from 'ethers';

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://evmrpc-testnet.0g.ai';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

// AccessRegistry ABI (minimal interface)
const ACCESS_REGISTRY_ABI = [
  "function grantAccess(address provider, uint256 expiry) external",
  "function isProviderApproved(address provider) external view returns (bool)",
  "function getProviderInfo(address provider) external view returns (address owner, uint256 expiry, bool approved)"
];

async function main() {
  const provider = process.argv[2];
  const expiry = process.argv[3];

  if (!provider) {
    console.error("Usage: node scripts/grant_access_raw.js <provider> [expiry]");
    console.error("Example: node scripts/grant_access_raw.js 0x1234... 1735689600");
    process.exit(2);
  }

  if (!PRIVATE_KEY) {
    console.error("Error: PRIVATE_KEY not set in environment");
    process.exit(1);
  }

  try {
    // Load deployment addresses
    const deployInfo = JSON.parse(await readFile('deploy.out.json', 'utf8'));
    const accessRegistryAddress = deployInfo.addresses.AccessRegistry;

    if (!accessRegistryAddress) {
      console.error("Error: AccessRegistry address not found in deploy.out.json");
      process.exit(1);
    }

    console.log(`Granting access to provider: ${provider}`);
    console.log(`AccessRegistry: ${accessRegistryAddress}`);
    console.log(`RPC: ${RPC_ENDPOINT}`);

    // Initialize provider and signer
    const rpcProvider = new JsonRpcProvider(RPC_ENDPOINT, {
      name: "0g-galileo",
      chainId: 16601
    });
    const signer = new Wallet(PRIVATE_KEY, rpcProvider);

    // Create contract instance
    const contract = new ethers.Contract(accessRegistryAddress, ACCESS_REGISTRY_ABI, signer);

    // Set expiry (default to 1 year from now if not provided)
    const expiryTime = expiry ? BigInt(expiry) : BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60);

    console.log(`Expiry: ${expiryTime} (${new Date(Number(expiryTime) * 1000).toISOString()})`);

    // Grant access
    const tx = await contract.grantAccess(provider, expiryTime);
    console.log(`Transaction submitted: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed}`);

    // Verify the access was granted
    const isApproved = await contract.isProviderApproved(provider);
    console.log(`Provider ${provider} approved: ${isApproved}`);

  } catch (error) {
    console.error(`Failed to grant access: ${error.message}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.stack || String(e));
  process.exit(1);
});
