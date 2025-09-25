/* Enhanced CI Storage Integration
 * Replaces the basic IPFS upload with comprehensive storage management
 * Supports IPFS API, 0G Storage, and dry-run modes
 */

import { StorageManager } from './storage_manager.js';
import { readFile } from 'node:fs/promises';

async function uploadForCI(filePath) {
  const storage = new StorageManager();
  
  try {
    // Upload the file
    const result = await storage.uploadFile(filePath, {
      retries: 3,
      timeout: 60000 // 60 seconds for CI
    });

    // Create CI-compatible output
    const ciResult = {
      cid: result.cid,
      size: result.size,
      url: result.url,
      sha256: result.sha256,
      provider: result.provider,
      mode: result.mode,
      timestamp: result.timestamp
    };

    console.log(JSON.stringify(ciResult));
    return ciResult;

  } catch (error) {
    console.error(`[ci-storage] Upload failed:`, error.message);
    
    // Fallback to dry result
    const fileBuffer = await readFile(filePath);
    const crypto = await import('node:crypto');
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    
    const dryResult = {
      cid: `sha256:${fileHash}`,
      size: fileBuffer.length,
      url: `dry://sha256:${fileHash}`,
      sha256: `0x${fileHash}`,
      provider: 'dry-run',
      mode: 'manual',
      timestamp: new Date().toISOString(),
      error: error.message
    };

    console.log(JSON.stringify(dryResult));
    return dryResult;
  }
}

// CLI interface
async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node ci_storage_upload.js <file>');
    process.exit(2);
  }

  await uploadForCI(filePath);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}

export { uploadForCI };
