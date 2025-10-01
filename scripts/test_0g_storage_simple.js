// scripts/test_0g_storage_simple.js
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

const OG_STORAGE_MODE = process.env.OG_STORAGE_MODE || 'manual';
const OG_STORAGE_RPC = process.env.OG_STORAGE_RPC || '';
const OG_STORAGE_PRIVATE_KEY = process.env.OG_STORAGE_PRIVATE_KEY || '';

console.log('=== 0G Storage Simple Test ===');
console.log(`Mode: ${OG_STORAGE_MODE}`);
console.log(`RPC: ${OG_STORAGE_RPC}`);
console.log(`Has Private Key: ${!!OG_STORAGE_PRIVATE_KEY}`);

async function test0GStorage() {
  try {
    // Test file creation
    const testData = JSON.stringify({ test: "0G Storage integration", timestamp: new Date().toISOString() });
    await writeFile('test_0g_storage.json', testData);
    console.log('✅ Test file created');

    // Test file reading
    const fileBuffer = await readFile('test_0g_storage.json');
    const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
    console.log(`✅ File hash: 0x${fileHash}`);

    if (OG_STORAGE_MODE === '0g-storage') {
      console.log('Testing 0G Storage SDK...');
      
      try {
        // Dynamic import to catch module errors
        const { StorageNode, Uploader, defaultUploadOption, ZgFile, getFlowContract } = await import('@0glabs/0g-ts-sdk');
        const { JsonRpcProvider, Wallet } = await import('ethers');
        
        console.log('✅ 0G Storage SDK imported successfully');
        
        // Test provider connection
        const provider = new JsonRpcProvider(OG_STORAGE_RPC, {
          name: "0g-galileo",
          chainId: 16602,
          ensAddress: null // Disable ENS
        });
        
        const blockNumber = await provider.getBlockNumber();
        console.log(`✅ RPC connection successful. Block: ${blockNumber}`);
        
        // Test signer
        const signer = new Wallet(OG_STORAGE_PRIVATE_KEY, provider);
        console.log(`✅ Signer address: ${await signer.getAddress()}`);
        
        // Test storage nodes (these might be the issue)
        const nodes = [
          new StorageNode('https://node1.storage.0g.ai'),
          new StorageNode('https://node2.storage.0g.ai')
        ];
        console.log('✅ Storage nodes created');
        
        // Test flow contract
        const flow = await getFlowContract(OG_STORAGE_RPC, signer);
        console.log('✅ Flow contract created');
        
        // Test uploader
        const uploader = new Uploader(nodes, OG_STORAGE_RPC, flow);
        console.log('✅ Uploader created');
        
        // Test ZgFile
        const zgFile = new ZgFile(fileBuffer, fileBuffer.length);
        console.log('✅ ZgFile created');
        
        console.log('All components ready for upload!');
        
      } catch (error) {
        console.error(`❌ 0G Storage SDK error: ${error.message}`);
        console.error(`Stack: ${error.stack}`);
      }
    } else {
      console.log('Skipping 0G Storage test (mode is not 0g-storage)');
    }

  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
  }
}

test0GStorage().then(() => {
  console.log('Test completed');
}).catch(error => {
  console.error(`Test error: ${error.message}`);
});
