/* Simple Storage Test - CommonJS version for better compatibility */

const { readFile, writeFile, unlink } = require('node:fs/promises');
const { createHash } = require('node:crypto');

async function testStorage() {
  console.log('Testing storage integration...');
  
  const testData = { test: 'storage', timestamp: new Date().toISOString() };
  const testFile = 'test_storage.json';
  
  try {
    // Create test file
    await writeFile(testFile, JSON.stringify(testData, null, 2));
    console.log(`Created test file: ${testFile}`);
    
    // Test file integrity
    const content = await readFile(testFile, 'utf8');
    const hash = createHash('sha256').update(content).digest('hex');
    console.log(`File hash: 0x${hash}`);
    
    // Test storage mode
    const mode = process.env.OG_STORAGE_MODE || 'manual';
    console.log(`Storage mode: ${mode}`);
    
    // Test configuration
    const config = {
      mode,
      ipfsBase: process.env.OG_STORAGE_API_BASE || 'not-set',
      gatewayBase: process.env.OG_GATEWAY_BASE || 'not-set',
      ogRpc: process.env.OG_STORAGE_RPC || 'not-set',
      hasOgKey: !!process.env.OG_STORAGE_PRIVATE_KEY
    };
    
    console.log('Configuration:', JSON.stringify(config, null, 2));
    
    // Cleanup
    await unlink(testFile);
    console.log('Test completed successfully');
    
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

testStorage();
