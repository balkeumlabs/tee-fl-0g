// scripts/simple_0g_upload.js
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

const OG_STORAGE_RPC = process.env.OG_STORAGE_RPC || 'https://evmrpc-testnet.0g.ai';
const OG_STORAGE_PRIVATE_KEY = process.env.OG_STORAGE_PRIVATE_KEY;

async function simpleUpload() {
  try {
    console.log('=== Simple 0G Storage Upload ===');
    
    if (!OG_STORAGE_PRIVATE_KEY) {
      console.error('❌ OG_STORAGE_PRIVATE_KEY not set');
      return;
    }

    // Read test file
    const fileBuffer = await readFile('test_file.txt');
    const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
    console.log(`✅ File read: ${fileBuffer.length} bytes`);
    console.log(`✅ File hash: 0x${fileHash}`);

    // Import 0G Storage SDK
    const { StorageNode, Uploader, ZgFile, getFlowContract } = await import('@0glabs/0g-ts-sdk');
    const { JsonRpcProvider, Wallet } = await import('ethers');
    
    console.log('✅ 0G Storage SDK imported');
    
    // Create provider with ENS disabled
    const provider = new JsonRpcProvider(OG_STORAGE_RPC, {
      name: "0g-galileo",
      chainId: 16602,
      ensAddress: null
    });
    
    const signer = new Wallet(OG_STORAGE_PRIVATE_KEY, provider);
    console.log(`✅ Signer: ${await signer.getAddress()}`);
    
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
    const zgFile = new ZgFile(fileBuffer, 'test_file.txt');
    console.log('✅ ZgFile created');
    
    // Upload using uploadFile method
    console.log('📤 Attempting upload with uploadFile()...');
    
    try {
      // Create a file descriptor for uploadFile
      const result = await uploader.uploadFile('test_file.txt');
      console.log('✅ Upload successful!');
      console.log('Result:', result);
      
      if (result.cid) {
        console.log(`🎯 CID: ${result.cid}`);
        console.log(`🔗 Gateway URL: https://ipfs.io/ipfs/${result.cid}`);
      }
      
    } catch (error) {
      console.log('❌ uploadFile() failed:', error.message);
      console.log('Error details:', error);
    }
    
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
  }
}

simpleUpload();
