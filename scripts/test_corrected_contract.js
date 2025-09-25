// scripts/test_corrected_contract.js
import { JsonRpcProvider, Wallet, ethers } from 'ethers';
import { readFile } from 'node:fs/promises';

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://rpc.ankr.com/0g_galileo_testnet_evm';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x1234567890123456789012345678901234567890123456789012345678901234';

// Correct AccessRegistry ABI based on the actual contract
const ACCESS_REGISTRY_ABI = [
  "function grantAccess(address provider, string calldata datasetCid, bytes32 modelHash, uint64 expiry) external returns (bytes32 key)",
  "function isProviderApproved(address owner, address provider, string calldata datasetCid, bytes32 modelHash) external view returns (bool)",
  "function grants(bytes32 key) external view returns (address owner, address provider, string datasetCid, bytes32 modelHash, uint64 expiry, bool revoked)",
  "event AccessGranted(bytes32 indexed key, address indexed owner, address indexed provider, string datasetCid, bytes32 modelHash, uint64 expiry)"
];

async function testCorrectedContract() {
  console.log(`Testing corrected contract interaction with: ${RPC_ENDPOINT}`);
  
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
    
    // Test parameters
    const owner = await signer.getAddress();
    const provider_addr = "0x9Ed57870379e28E32cb627bE365745dc184950dF";
    const datasetCid = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
    const modelHash = ethers.keccak256(ethers.toUtf8Bytes("test-model-v1"));
    const expiry = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 1 year from now
    
    console.log(`Testing with parameters:`);
    console.log(`  Owner: ${owner}`);
    console.log(`  Provider: ${provider_addr}`);
    console.log(`  Dataset CID: ${datasetCid}`);
    console.log(`  Model Hash: ${modelHash}`);
    console.log(`  Expiry: ${expiry} (${new Date(expiry * 1000).toISOString()})`);
    
    // Grant access
    console.log(`\nGranting access...`);
    const tx = await contract.grantAccess(provider_addr, datasetCid, modelHash, expiry);
    console.log(`✅ Transaction submitted: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed}`);
    
    // Get the grant key from the event
    const event = receipt.logs.find(log => {
      try {
        const parsed = contract.interface.parseLog(log);
        return parsed.name === 'AccessGranted';
      } catch (e) {
        return false;
      }
    });
    
    if (event) {
      const parsed = contract.interface.parseLog(event);
      const key = parsed.args.key;
      console.log(`✅ Grant key: ${key}`);
      
      // Verify the access was granted
      const isApproved = await contract.isProviderApproved(owner, provider_addr, datasetCid, modelHash);
      console.log(`✅ Provider approved: ${isApproved}`);
      
      // Get grant details
      const grant = await contract.grants(key);
      console.log(`Grant details:`);
      console.log(`  Owner: ${grant[0]}`);
      console.log(`  Provider: ${grant[1]}`);
      console.log(`  Dataset CID: ${grant[2]}`);
      console.log(`  Model Hash: ${grant[3]}`);
      console.log(`  Expiry: ${grant[4]} (${new Date(Number(grant[4]) * 1000).toISOString()})`);
      console.log(`  Revoked: ${grant[5]}`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Contract interaction failed: ${error.message}`);
    return false;
  }
}

testCorrectedContract().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error(`Script failed: ${error.message}`);
  process.exit(1);
});
