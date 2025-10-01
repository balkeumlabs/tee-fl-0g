// scripts/test_contract_interaction.js
import { JsonRpcProvider, Wallet, ethers } from 'ethers';
import { readFile } from 'node:fs/promises';

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://evmrpc-testnet.0g.ai';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x1234567890123456789012345678901234567890123456789012345678901234';

// AccessRegistry ABI (minimal interface)
const ACCESS_REGISTRY_ABI = [
  "function isProviderApproved(address owner, address provider, string calldata datasetCid, bytes32 modelHash) external view returns (bool)",
  "function grants(bytes32 key) external view returns (address owner, address provider, string memory datasetCid, bytes32 modelHash, uint64 expiry, bool revoked)"
];

async function testContractInteraction() {
  console.log(`Testing contract interaction with: ${RPC_ENDPOINT}`);
  
  try {
    // Load deployment addresses
    const deployInfo = JSON.parse(await readFile('data/deploy.out.json', 'utf8'));
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
    
    // Test contract call with same parameters as grant
    const testProvider = "0x9Ed57870379e28E32cb627bE365745dc184950dF";
    const datasetCid = "QmTestDataset123456789";
    const modelHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const owner = "0x9Ed57870379e28E32cb627bE365745dc184950dF"; // Use the owner from the grant
    
    console.log(`Testing contract call for provider: ${testProvider}`);
    console.log(`Owner: ${owner}`);
    console.log(`Dataset CID: ${datasetCid}`);
    console.log(`Model Hash: ${modelHash}`);
    
    const isApproved = await contract.isProviderApproved(owner, testProvider, datasetCid, modelHash);
    console.log(`✅ Contract call successful! Provider approved: ${isApproved}`);
    
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
