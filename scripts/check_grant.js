// scripts/check_grant.js
import { JsonRpcProvider, Wallet, ethers } from 'ethers';
import { readFile } from 'node:fs/promises';
import dotenv from 'dotenv';

dotenv.config();

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://evmrpc-testnet.0g.ai';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// AccessRegistry ABI
const ACCESS_REGISTRY_ABI = [
  "function grants(bytes32 key) external view returns (address owner, address provider, string memory datasetCid, bytes32 modelHash, uint64 expiry, bool revoked)"
];

async function checkGrant() {
  try {
    const provider = new JsonRpcProvider(RPC_ENDPOINT, {
      name: "0g-galileo",
      chainId: 16602
    });
    
    const wallet = new Wallet(PRIVATE_KEY, provider);
    const owner = await wallet.getAddress();
    
    // Load deployment addresses
    const deployInfo = JSON.parse(await readFile('data/deploy.out.json', 'utf8'));
    const accessRegistryAddress = deployInfo.addresses.AccessRegistry;
    
    const contract = new ethers.Contract(accessRegistryAddress, ACCESS_REGISTRY_ABI, provider);
    
    // Calculate the grant key
    const datasetCid = "QmTestDataset123456789";
    const modelHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const providerAddr = owner; // Same as owner for this test
    
    const key = ethers.keccak256(ethers.solidityPacked(
      ["address", "address", "string", "bytes32"],
      [owner, providerAddr, datasetCid, modelHash]
    ));
    
    console.log(`Grant key: ${key}`);
    console.log(`Owner: ${owner}`);
    console.log(`Provider: ${providerAddr}`);
    console.log(`Dataset CID: ${datasetCid}`);
    console.log(`Model Hash: ${modelHash}`);
    
    // Check the grant
    const grant = await contract.grants(key);
    console.log(`\nGrant details:`);
    console.log(`  Owner: ${grant[0]}`);
    console.log(`  Provider: ${grant[1]}`);
    console.log(`  Dataset CID: ${grant[2]}`);
    console.log(`  Model Hash: ${grant[3]}`);
    console.log(`  Expiry: ${grant[4]} (${new Date(Number(grant[4]) * 1000).toISOString()})`);
    console.log(`  Revoked: ${grant[5]}`);
    
    const isExpired = Number(grant[4]) <= Math.floor(Date.now() / 1000);
    console.log(`  Is Expired: ${isExpired}`);
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

checkGrant();
