/* Download Verification Script
 * Downloads files from storage and verifies integrity
 * Supports IPFS, 0G Storage, and dry-run CIDs
 */

import { StorageManager } from './storage_manager.js';
import { readFile } from 'node:fs/promises';

async function verifyDownload(cid, expectedHash, outputPath = null) {
  const storage = new StorageManager();
  
  try {
    console.error(`[verify] Verifying download for CID: ${cid}`);
    
    if (cid.startsWith('sha256:')) {
      console.error(`[verify] Dry-run CID detected, skipping download`);
      return {
        cid,
        verified: false,
        reason: 'dry-run-cid',
        message: 'Cannot verify dry-run CID'
      };
    }

    // Generate output path if not provided
    if (!outputPath) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      outputPath = `downloaded_${timestamp}.bin`;
    }

    // Download and verify
    const result = await storage.downloadFile(cid, outputPath, {
      verifyHash: !!expectedHash,
      expectedHash: expectedHash
    });

    console.error(`[verify] Download successful: ${result.path}`);
    console.error(`[verify] File size: ${result.size} bytes`);
    console.error(`[verify] Hash: ${result.hash}`);

    return {
      cid,
      verified: true,
      path: result.path,
      size: result.size,
      hash: result.hash,
      url: result.url
    };

  } catch (error) {
    console.error(`[verify] Verification failed:`, error.message);
    return {
      cid,
      verified: false,
      reason: 'download-failed',
      error: error.message
    };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const cid = args[0];
  const expectedHash = args[1];
  const outputPath = args[2];

  if (!cid) {
    console.error('Usage: node verify_download.js <cid> [expected-hash] [output-path]');
    process.exit(2);
  }

  const result = await verifyDownload(cid, expectedHash, outputPath);
  console.log(JSON.stringify(result, null, 2));
  
  // Exit with error code if verification failed
  if (!result.verified) {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}

export { verifyDownload };
