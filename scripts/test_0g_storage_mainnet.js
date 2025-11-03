// scripts/test_0g_storage_mainnet.js - Test 0G Storage upload on mainnet
import dotenv from 'dotenv';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ethers } from 'ethers';

dotenv.config({ path: '.env.mainnet' });

const OG_STORAGE_MODE = process.env.OG_STORAGE_MODE || 'manual';
const OG_STORAGE_RPC = process.env.OG_STORAGE_RPC || process.env.RPC_ENDPOINT || 'https://evmrpc.0g.ai';
const OG_STORAGE_PRIVATE_KEY = process.env.OG_STORAGE_PRIVATE_KEY || process.env.PRIVATE_KEY || '';

console.log('=== 0G Storage Mainnet Test ===');
console.log(`Mode: ${OG_STORAGE_MODE}`);
console.log(`RPC: ${OG_STORAGE_RPC}`);
console.log(`Has Private Key: ${!!OG_STORAGE_PRIVATE_KEY}`);
console.log(`Chain ID: ${process.env.CHAIN_ID || '16661'}`);

async function test0GStorageMainnet() {
  try {
    // Check configuration
    console.log('\n📋 Configuration Check:');
    if (OG_STORAGE_MODE === 'manual') {
      console.log('⚠️  Mode is "manual" - 0G Storage uploads are disabled');
      console.log('   To enable: Set OG_STORAGE_MODE=0g-storage in .env.mainnet');
      return;
    }

    if (!OG_STORAGE_PRIVATE_KEY) {
      console.error('❌ OG_STORAGE_PRIVATE_KEY not set in .env.mainnet');
      console.error('   Required for 0G Storage uploads');
      return;
    }

    // Create test file
    console.log('\n📦 Creating test file...');
    const testData = JSON.stringify({ 
      test: "0G Storage mainnet upload test", 
      timestamp: new Date().toISOString(),
      network: "0G Mainnet",
      chainId: 16661
    });
    await writeFile('test_0g_storage_mainnet.json', testData);
    console.log('✅ Test file created: test_0g_storage_mainnet.json');

    // Read and hash file
    const fileBuffer = await readFile('test_0g_storage_mainnet.json');
    const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
    console.log(`✅ File hash: 0x${fileHash}`);
    console.log(`✅ File size: ${fileBuffer.length} bytes`);

    if (OG_STORAGE_MODE === '0g-storage') {
      console.log('\n📤 Testing 0G Storage SDK upload...');
      
      try {
        // Dynamic import to catch module errors
        const { StorageNode, Uploader, defaultUploadOption, ZgFile, getFlowContract } = await import('@0glabs/0g-ts-sdk');
        const { JsonRpcProvider, Wallet } = await import('ethers');
        
        console.log('✅ 0G Storage SDK imported successfully');

        // Create provider for mainnet
        const provider = new JsonRpcProvider(OG_STORAGE_RPC, {
          name: "0g-mainnet",
          chainId: 16661,
          ensAddress: null // Disable ENS
        });

        // Test RPC connection
        try {
          const blockNumber = await provider.getBlockNumber();
          console.log(`✅ RPC connection successful. Block: ${blockNumber}`);
        } catch (error) {
          console.error(`❌ RPC connection failed: ${error.message}`);
          throw error;
        }

        // Create signer
        const signer = new Wallet(OG_STORAGE_PRIVATE_KEY, provider);
        const signerAddress = await signer.getAddress();
        console.log(`✅ Signer address: ${signerAddress}`);

        // Check balance
        try {
          const balance = await provider.getBalance(signerAddress);
          console.log(`✅ Balance: ${ethers.formatEther(balance)} 0G`);
          if (balance === 0n) {
            console.error('⚠️  Warning: Wallet has no 0G tokens. Upload may fail.');
          }
        } catch (error) {
          console.warn(`⚠️  Could not check balance: ${error.message}`);
        }

        // Create storage nodes (mainnet nodes)
        const nodes = [
          new StorageNode('https://node1.storage.0g.ai'),
          new StorageNode('https://node2.storage.0g.ai')
        ];
        console.log('✅ Storage nodes created');

        // Get flow contract
        const flow = await getFlowContract(OG_STORAGE_RPC, signer);
        console.log('✅ Flow contract initialized');

        // Create uploader
        const uploader = new Uploader(nodes, OG_STORAGE_RPC, flow);
        console.log('✅ Uploader created');

        // Create ZgFile
        const zgFile = new ZgFile(fileBuffer, fileBuffer.length);
        console.log('✅ ZgFile created');

        // Attempt upload
        console.log('\n📤 Uploading to 0G Storage...');
        console.log('   This may take a few seconds...');
        
        const [rootHash, error] = await uploader.uploadFile(zgFile, defaultUploadOption);

        if (error) {
          console.error(`❌ Upload failed: ${error}`);
          console.error('   Error details:', error);
          throw new Error(`0G Storage upload failed: ${error}`);
        }

        if (!rootHash) {
          console.error('❌ Upload failed: No root hash returned');
          throw new Error('Upload returned no root hash');
        }

        console.log('\n✅ Upload successful!');
        console.log(`   Root Hash (CID): ${rootHash}`);
        console.log(`   URL: 0g://${rootHash}`);
        console.log(`   Verify on: https://indexer-storage-turbo.0g.ai/search?cid=${rootHash}`);

        // Save upload info
        const uploadInfo = {
          success: true,
          rootHash: rootHash,
          url: `0g://${rootHash}`,
          fileHash: `0x${fileHash}`,
          fileSize: fileBuffer.length,
          timestamp: new Date().toISOString(),
          network: "0G Mainnet",
          chainId: 16661
        };

        await writeFile('data/0g_storage_upload_mainnet.json', JSON.stringify(uploadInfo, null, 2));
        console.log('\n💾 Upload info saved to: data/0g_storage_upload_mainnet.json');

        return rootHash;

      } catch (error) {
        console.error(`\n❌ 0G Storage SDK error: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
        
        if (error.message.includes('Cannot find module')) {
          console.error('\n💡 Solution: Install 0G Storage SDK');
          console.error('   npm install @0glabs/0g-ts-sdk');
        }
        
        if (error.message.includes('insufficient funds')) {
          console.error('\n💡 Solution: Add 0G tokens to wallet');
          console.error(`   Wallet: ${signerAddress || 'N/A'}`);
        }

        throw error;
      }
    } else {
      console.log('⚠️  Skipping 0G Storage test (mode is not 0g-storage)');
      console.log('   Current mode:', OG_STORAGE_MODE);
      console.log('   To enable: Set OG_STORAGE_MODE=0g-storage in .env.mainnet');
    }

  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
    process.exit(1);
  }
}

test0GStorageMainnet().then(() => {
  console.log('\n✅ Test completed');
}).catch(error => {
  console.error(`\n❌ Test error: ${error.message}`);
  process.exit(1);
});
