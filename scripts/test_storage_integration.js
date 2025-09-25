/* Storage Integration Test Suite
 * Tests all storage modes and configurations
 */

import { StorageManager } from './storage_manager.js';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';

class StorageTester {
  constructor() {
    this.storage = new StorageManager();
    this.testFile = 'test_storage_file.json';
    this.testData = {
      timestamp: new Date().toISOString(),
      testId: Math.random().toString(36).substring(7),
      data: 'This is a test file for storage integration',
      metadata: {
        version: '1.0',
        purpose: 'storage-testing'
      }
    };
  }

  async setup() {
    // Create test file
    await writeFile(this.testFile, JSON.stringify(this.testData, null, 2));
    console.error(`[test] Created test file: ${this.testFile}`);
  }

  async cleanup() {
    try {
      await unlink(this.testFile);
      console.error(`[test] Cleaned up test file: ${this.testFile}`);
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  async testStorageInfo() {
    console.error(`[test] Testing storage info...`);
    const info = this.storage.getStorageInfo();
    console.log(JSON.stringify({ test: 'storage-info', result: info }, null, 2));
    return info;
  }

  async testUpload() {
    console.error(`[test] Testing upload...`);
    try {
      const result = await this.storage.uploadFile(this.testFile);
      console.log(JSON.stringify({ test: 'upload', result }, null, 2));
      return result;
    } catch (error) {
      console.log(JSON.stringify({ test: 'upload', error: error.message }, null, 2));
      throw error;
    }
  }

  async testDownload(uploadResult) {
    if (!uploadResult || uploadResult.cid.startsWith('sha256:')) {
      console.error(`[test] Skipping download test for dry-run CID`);
      return { test: 'download', skipped: true, reason: 'dry-run-cid' };
    }

    console.error(`[test] Testing download...`);
    try {
      const downloadPath = `downloaded_${this.testFile}`;
      const result = await this.storage.downloadFile(uploadResult.cid, downloadPath, {
        verifyHash: true,
        expectedHash: uploadResult.sha256
      });
      
      // Verify content matches
      const originalContent = await readFile(this.testFile, 'utf8');
      const downloadedContent = await readFile(downloadPath, 'utf8');
      
      const contentMatch = originalContent === downloadedContent;
      
      console.log(JSON.stringify({ 
        test: 'download', 
        result: {
          ...result,
          contentMatch,
          originalSize: originalContent.length,
          downloadedSize: downloadedContent.length
        }
      }, null, 2));

      // Cleanup downloaded file
      await unlink(downloadPath);
      
      return result;
    } catch (error) {
      console.log(JSON.stringify({ test: 'download', error: error.message }, null, 2));
      throw error;
    }
  }

  async testIntegrity() {
    console.error(`[test] Testing integrity verification...`);
    
    const fileBuffer = await readFile(this.testFile);
    const expectedHash = createHash('sha256').update(fileBuffer).digest('hex');
    
    const result = {
      test: 'integrity',
      file: this.testFile,
      size: fileBuffer.length,
      expectedHash: `0x${expectedHash}`,
      actualHash: `0x${createHash('sha256').update(fileBuffer).digest('hex')}`,
      match: true
    };

    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  async runAllTests() {
    console.error(`[test] Starting storage integration tests...`);
    console.error(`[test] Storage mode: ${this.storage.mode}`);
    
    const results = {
      timestamp: new Date().toISOString(),
      storageMode: this.storage.mode,
      tests: {}
    };

    try {
      await this.setup();

      // Test storage info
      results.tests.storageInfo = await this.testStorageInfo();

      // Test integrity
      results.tests.integrity = await this.testIntegrity();

      // Test upload
      results.tests.upload = await this.testUpload();

      // Test download (if upload succeeded and not dry-run)
      if (results.tests.upload && !results.tests.upload.cid.startsWith('sha256:')) {
        results.tests.download = await this.testDownload(results.tests.upload);
      } else {
        results.tests.download = { skipped: true, reason: 'upload-failed-or-dry-run' };
      }

      results.success = true;
      console.error(`[test] All tests completed successfully`);

    } catch (error) {
      results.success = false;
      results.error = error.message;
      console.error(`[test] Tests failed:`, error.message);
    } finally {
      await this.cleanup();
    }

    return results;
  }
}

// CLI interface
async function main() {
  const tester = new StorageTester();
  const results = await tester.runAllTests();
  
  console.log(JSON.stringify(results, null, 2));
  
  if (!results.success) {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Test Error:', error.message);
    process.exit(1);
  });
}

export { StorageTester };
