// scripts/test_real_0g_upload.js
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const OG_STORAGE_MODE = process.env.OG_STORAGE_MODE || 'manual';
const OG_STORAGE_RPC = process.env.OG_STORAGE_RPC || '';
const OG_STORAGE_PRIVATE_KEY = process.env.OG_STORAGE_PRIVATE_KEY || '';

console.log('=== Real 0G Storage Upload Test ===');

async function testRealUpload() {
  try {
    // Create test file
    const testData = JSON.stringify({ 
      test: "Real 0G Storage upload", 
      timestamp: new Date().toISOString(),
      data: "This is a test file for 0G Storage integration"
    });
    await writeFile('real_upload_test.json', testData);
    console.log('✅ Test file created');

    const fileBuffer = await readFile('real_upload_test.json');
    const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
    console.log(`✅ File hash: 0x${fileHash}`);
    console.log(`✅ File size: ${fileBuffer.length} bytes`);

    if (OG_STORAGE_MODE === '0g-storage') {
      console.log('Starting real 0G Storage upload...');
      
      try {
        // Import 0G Storage SDK
        const { StorageNode, Uploader, defaultUploadOption, ZgFile, getFlowContract } = await import('@0glabs/0g-ts-sdk');
        const { JsonRpcProvider, Wallet } = await import('ethers');
        
        // Create provider with ENS disabled
        const provider = new JsonRpcProvider(OG_STORAGE_RPC, {
          name: "0g-galileo",
          chainId: 16601,
          ensAddress: null // Disable ENS
        });
        
        const signer = new Wallet(OG_STORAGE_PRIVATE_KEY, provider);
        console.log(`✅ Signer: ${await signer.getAddress()}`);
        
        // Create storage nodes
        const nodes = [
          new StorageNode('https://node1.storage.0g.ai'),
          new StorageNode('https://node2.storage.0g.ai')
        ];
        
        // Create flow contract and uploader
        const flow = await getFlowContract(OG_STORAGE_RPC, signer);
        const uploader = new Uploader(nodes, OG_STORAGE_RPC, flow);
        
        // Create ZgFile from file path instead of buffer
        const zgFile = new ZgFile('real_upload_test.json');
        
        console.log('Uploading to 0G Storage...');
        
        // Perform upload
        const [rootHash, error] = await uploader.uploadFile(zgFile, defaultUploadOption);
        
        if (error) {
          console.error(`❌ Upload failed: ${error}`);
          return;
        }
        
        console.log(`🎉 SUCCESS! File uploaded to 0G Storage!`);
        console.log(`✅ Root Hash: ${rootHash}`);
        console.log(`✅ URL: 0g://${rootHash}`);
        console.log(`✅ File Size: ${fileBuffer.length} bytes`);
        console.log(`✅ SHA256: 0x${fileHash}`);
        
        // Save result
        const result = {
          cid: rootHash,
          url: `0g://${rootHash}`,
          size: fileBuffer.length,
          sha256: `0x${fileHash}`,
          provider: '0g-storage',
          timestamp: new Date().toISOString()
        };
        
        await writeFile('upload_result.json', JSON.stringify(result, null, 2));
        console.log('✅ Upload result saved to upload_result.json');
        
      } catch (error) {
        console.error(`❌ Upload error: ${error.message}`);
        console.error(`Stack: ${error.stack}`);
      }
    }

  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
  }
}

testRealUpload().then(() => {
  console.log('Upload test completed');
}).catch(error => {
  console.error(`Test error: ${error.message}`);
});
