// scripts/upload_to_0g_storage.js
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

const OG_STORAGE_RPC = process.env.OG_STORAGE_RPC || 'https://evmrpc-testnet.0g.ai';
const OG_STORAGE_PRIVATE_KEY = process.env.OG_STORAGE_PRIVATE_KEY;

async function uploadTo0GStorage() {
  try {
    console.log('=== 0G Storage Upload Test ===');
    
    if (!OG_STORAGE_PRIVATE_KEY) {
      console.error('❌ OG_STORAGE_PRIVATE_KEY not set');
      return;
    }

    // Create test file
    const testData = JSON.stringify({ 
      test: "0G Storage upload", 
      timestamp: new Date().toISOString(),
      message: "This is a test file for 0G Storage integration"
    });
    
    await writeFile('test_upload.json', testData);
    console.log('✅ Test file created');

    // Get file hash
    const fileBuffer = await readFile('test_upload.json');
    const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
    console.log(`✅ File hash: 0x${fileHash}`);
    console.log(`✅ File size: ${fileBuffer.length} bytes`);

    // Import 0G Storage SDK
    const { StorageNode, Uploader, defaultUploadOption, ZgFile, getFlowContract } = await import('@0glabs/0g-ts-sdk');
    const { JsonRpcProvider, Wallet } = await import('ethers');
    
    console.log('✅ 0G Storage SDK imported successfully');
    
    // Create provider with ENS disabled
    const provider = new JsonRpcProvider(OG_STORAGE_RPC, {
      name: "0g-galileo",
      chainId: 16602,
      ensAddress: null
    });
    
    const signer = new Wallet(OG_STORAGE_PRIVATE_KEY, provider);
    console.log(`✅ Signer address: ${await signer.getAddress()}`);
    
    // Create storage nodes
    const nodes = [
      new StorageNode('https://node1.storage.0g.ai'),
      new StorageNode('https://node2.storage.0g.ai')
    ];
    console.log('✅ Storage nodes created');
    
    // Create flow contract
    const flow = await getFlowContract(OG_STORAGE_RPC, signer);
    console.log('✅ Flow contract created');
    
    // Create uploader
    const uploader = new Uploader(nodes, OG_STORAGE_RPC, flow);
    console.log('✅ Uploader created');
    
    // Create ZgFile
    const zgFile = new ZgFile(fileBuffer, 'test_upload.json');
    console.log('✅ ZgFile created');
    
    // Upload file
    console.log('📤 Starting upload...');
    const uploadResult = await uploader.upload(zgFile, defaultUploadOption);
    
    console.log('✅ Upload successful!');
    console.log(`📋 Upload result:`, uploadResult);
    
    if (uploadResult.cid) {
      console.log(`🎯 CID: ${uploadResult.cid}`);
      console.log(`🔗 Gateway URL: https://ipfs.io/ipfs/${uploadResult.cid}`);
      
      // Save CID to file for later use
      await writeFile('upload_result.json', JSON.stringify({
        cid: uploadResult.cid,
        hash: `0x${fileHash}`,
        size: fileBuffer.length,
        timestamp: new Date().toISOString(),
        gateway: `https://ipfs.io/ipfs/${uploadResult.cid}`
      }, null, 2));
      
      console.log('✅ Upload result saved to upload_result.json');
    }
    
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

uploadTo0GStorage();
