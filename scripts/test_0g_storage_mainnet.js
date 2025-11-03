// scripts/test_0g_storage_mainnet.js - Test 0G Storage upload on mainnet (using official API from docs)
import dotenv from 'dotenv';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ethers } from 'ethers';

dotenv.config({ path: '.env.mainnet' });

const OG_STORAGE_MODE = process.env.OG_STORAGE_MODE || 'manual';
const OG_STORAGE_RPC = process.env.OG_STORAGE_RPC || process.env.RPC_ENDPOINT || 'https://evmrpc.0g.ai';
const OG_STORAGE_PRIVATE_KEY = process.env.OG_STORAGE_PRIVATE_KEY || process.env.PRIVATE_KEY || '';

console.log('=== 0G Storage Mainnet Test (Official API) ===');
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
      chainId: 16661,
      api: "Official API from docs.0g.ai"
    });
    await writeFile('test_0g_storage_mainnet.json', testData);
    console.log('✅ Test file created: test_0g_storage_mainnet.json');

    // Read and hash file
    const fileBuffer = await readFile('test_0g_storage_mainnet.json');
    const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
    console.log(`✅ File hash: 0x${fileHash}`);
    console.log(`✅ File size: ${fileBuffer.length} bytes`);

    if (OG_STORAGE_MODE === '0g-storage') {
      console.log('\n📤 Testing 0G Storage SDK upload (Official API)...');
      
      try {
        // Import official API from docs: https://docs.0g.ai/developer-hub/building-on-0g/storage/sdk
        const { ZgFile, Indexer } = await import('@0glabs/0g-ts-sdk');
        
        console.log('✅ 0G Storage SDK imported successfully');

        // Initialize provider and signer (official API from docs)
        const provider = new ethers.JsonRpcProvider(OG_STORAGE_RPC, {
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
        const signer = new ethers.Wallet(OG_STORAGE_PRIVATE_KEY, provider);
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

        // Initialize indexer (official API from docs)
        const indexerRpc = 'https://indexer-storage-turbo.0g.ai';
        const indexer = new Indexer(indexerRpc);
        console.log('✅ Indexer initialized');

        // Create file from file path (official API from docs: ZgFile.fromFilePath)
        const filePath = 'test_0g_storage_mainnet.json';
        const file = await ZgFile.fromFilePath(filePath);
        console.log('✅ ZgFile created from file path');

        // Generate Merkle tree for verification (official API from docs)
        console.log('\n📊 Generating Merkle tree...');
        const [tree, treeErr] = await file.merkleTree();
        if (treeErr !== null) {
          throw new Error(`Error generating Merkle tree: ${treeErr}`);
        }
        const rootHash = tree?.rootHash();
        console.log(`✅ Merkle tree generated. Root hash: ${rootHash}`);

        // Attempt upload using indexer (official API from docs: indexer.upload)
        console.log('\n📤 Uploading to 0G Storage...');
        console.log('   This may take a few seconds...');
        
        const [tx, uploadErr] = await indexer.upload(file, OG_STORAGE_RPC, signer);
        
        if (uploadErr !== null) {
          console.error(`❌ Upload failed: ${uploadErr}`);
          throw new Error(`0G Storage upload failed: ${uploadErr}`);
        }

        // Close file when done (official API from docs)
        await file.close();

        if (!rootHash) {
          console.error('❌ Upload failed: No root hash returned');
          throw new Error('Upload returned no root hash');
        }

        console.log('\n✅ Upload successful!');
        console.log(`   Root Hash (CID): ${rootHash}`);
        console.log(`   Transaction: ${tx}`);
        console.log(`   URL: 0g://${rootHash}`);
        console.log(`   Verify on: https://indexer-storage-turbo.0g.ai/search?cid=${rootHash}`);

        // Save upload info
        const uploadInfo = {
          success: true,
          rootHash: rootHash,
          txHash: tx,
          url: `0g://${rootHash}`,
          fileHash: `0x${fileHash}`,
          fileSize: fileBuffer.length,
          timestamp: new Date().toISOString(),
          network: "0G Mainnet",
          chainId: 16661,
          api: "Official API from docs.0g.ai"
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