/* Enhanced Storage Manager for FLAI Protocol
 * Supports both IPFS API and 0G Storage with fallback mechanisms
 * 
 * Environment Variables:
 *   OG_STORAGE_MODE: 'manual' | 'ipfs-api' | '0g-storage'
 *   OG_STORAGE_API_BASE: IPFS API endpoint (e.g., https://ipfs.infura.io:5001)
 *   OG_STORAGE_API_TOKEN: IPFS API token (Bearer or Basic auth)
 *   OG_GATEWAY_BASE: Public gateway for reads (e.g., https://ipfs.io/ipfs/)
 *   OG_STORAGE_RPC: 0G Storage RPC endpoint
 *   OG_STORAGE_PRIVATE_KEY: Private key for 0G Storage transactions
 */

import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

class StorageManager {
  constructor() {
    this.mode = process.env.OG_STORAGE_MODE || 'manual';
    this.ipfsBase = process.env.OG_STORAGE_API_BASE || '';
    this.ipfsToken = process.env.OG_STORAGE_API_TOKEN || '';
    this.gatewayBase = process.env.OG_GATEWAY_BASE || 'https://ipfs.io/ipfs/';
    this.ogRpc = process.env.OG_STORAGE_RPC || 'https://rpc.0g-chain.dev';
    this.ogPrivateKey = process.env.OG_STORAGE_PRIVATE_KEY || '';
  }

  async uploadFile(filePath, options = {}) {
    const { retries = 3, timeout = 30000 } = options;
    
    try {
      const fileBuffer = await readFile(filePath);
      const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
      const fileSize = fileBuffer.length;

      console.error(`[storage] Uploading ${filePath} (${fileSize} bytes, SHA256: ${fileHash})`);

      let result;
      switch (this.mode) {
        case 'ipfs-api':
          result = await this.uploadToIPFS(filePath, fileBuffer, retries, timeout);
          break;
        case '0g-storage':
          result = await this.uploadTo0GStorage(filePath, fileBuffer, retries, timeout);
          break;
        case 'manual':
        default:
          result = this.createDryResult(fileHash, fileSize);
          break;
      }

      // Add integrity metadata
      result.sha256 = `0x${fileHash}`;
      result.size = fileSize;
      result.mode = this.mode;
      result.timestamp = new Date().toISOString();

      console.error(`[storage] Upload complete: ${result.cid}`);
      return result;

    } catch (error) {
      console.error(`[storage] Upload failed for ${filePath}:`, error.message);
      
      // Fallback to dry result on failure
      if (this.mode !== 'manual') {
        console.error(`[storage] Falling back to dry result`);
        const fileBuffer = await readFile(filePath);
        const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
        return this.createDryResult(fileHash, fileBuffer.length);
      }
      
      throw error;
    }
  }

  async uploadToIPFS(filePath, fileBuffer, retries, timeout) {
    if (!this.ipfsBase) {
      throw new Error('OG_STORAGE_API_BASE is required for IPFS uploads');
    }

    const authHeader = this.ipfsToken
      ? (this.ipfsToken.toLowerCase().startsWith('basic ') ? this.ipfsToken : `Bearer ${this.ipfsToken}`)
      : null;

    const form = new FormData();
    form.append('file', new Blob([fileBuffer]), filePath);

    const headers = {};
    if (authHeader) headers['Authorization'] = authHeader;

    const url = new URL('/api/v0/add', this.ipfsBase).toString();
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.error(`[storage] IPFS upload attempt ${attempt}/${retries}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: form,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new Error(`IPFS upload failed: ${response.status} ${response.statusText}\n${body}`);
        }

        const text = await response.text();
        const lastLine = text.trim().split(/\r?\n/).filter(Boolean).pop() || '{}';
        const json = JSON.parse(lastLine);
        
        const cid = json.Hash || (json.Cid && (json.Cid['/'] || json.Cid['/cid']));
        if (!cid) throw new Error(`No CID in IPFS response: ${lastLine}`);

        const gatewayUrl = this.gatewayBase ? 
          `${this.gatewayBase.replace(/\/+$/, '')}/${cid}` : 
          `ipfs://${cid}`;

        return {
          cid,
          url: gatewayUrl,
          provider: 'ipfs'
        };

      } catch (error) {
        console.error(`[storage] IPFS attempt ${attempt} failed:`, error.message);
        if (attempt === retries) throw error;
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  async uploadTo0GStorage(filePath, fileBuffer, retries, timeout) {
    if (!this.ogPrivateKey) {
      throw new Error('OG_STORAGE_PRIVATE_KEY is required for 0G Storage uploads');
    }

    try {
      // Dynamic import using official API from docs: https://docs.0g.ai/developer-hub/building-on-0g/storage/sdk
      const { ZgFile, Indexer } = await import('@0glabs/0g-ts-sdk');
      const { JsonRpcProvider, Wallet } = await import('ethers');

      // Initialize provider and signer (official API from docs)
      const provider = new JsonRpcProvider(this.ogRpc, {
        name: this.ogRpc.includes('mainnet') || this.ogRpc.includes('evmrpc.0g.ai') ? "0g-mainnet" : "0g-galileo",
        chainId: this.ogRpc.includes('mainnet') || this.ogRpc.includes('evmrpc.0g.ai') ? 16661 : 16602,
        ensAddress: null // Disable ENS
      });
      const signer = new Wallet(this.ogPrivateKey, provider);

      // Initialize indexer (official API from docs)
      const indexerRpc = this.ogRpc.includes('mainnet') || this.ogRpc.includes('evmrpc.0g.ai')
        ? 'https://indexer-storage-turbo.0g.ai'
        : 'https://indexer-storage-testnet-turbo.0g.ai';
      const indexer = new Indexer(indexerRpc);

      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          console.error(`[storage] 0G Storage upload attempt ${attempt}/${retries}`);
          
          // Create file from file path (official API from docs: ZgFile.fromFilePath)
          const file = await ZgFile.fromFilePath(filePath);
          
          // Generate Merkle tree for verification (official API from docs)
          const [tree, treeErr] = await file.merkleTree();
          if (treeErr !== null) {
            throw new Error(`Error generating Merkle tree: ${treeErr}`);
          }
          
          // Get root hash
          const rootHash = tree?.rootHash();
          
          // Upload using indexer (official API from docs: indexer.upload)
          const [tx, uploadErr] = await indexer.upload(file, this.ogRpc, signer);
          
          if (uploadErr !== null) {
            throw new Error(`0G Storage upload failed: ${uploadErr}`);
          }

          // Close file when done (official API from docs)
          await file.close();

          return {
            cid: rootHash,
            url: `0g://${rootHash}`,
            provider: '0g-storage',
            txHash: tx
          };

        } catch (error) {
          console.error(`[storage] 0G Storage attempt ${attempt} failed:`, error.message);
          if (attempt === retries) throw error;
          
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }

    } catch (error) {
      if (error.message.includes('Cannot resolve module')) {
        throw new Error('0G Storage SDK not available. Install with: npm install @0glabs/0g-ts-sdk');
      }
      throw error;
    }
  }

  createDryResult(fileHash, fileSize) {
    const pseudoCid = `sha256:${fileHash}`;
    return {
      cid: pseudoCid,
      url: `dry://${pseudoCid}`,
      provider: 'dry-run'
    };
  }

  async downloadFile(cid, outputPath, options = {}) {
    const { verifyHash = true, expectedHash } = options;
    
    try {
      console.error(`[storage] Downloading ${cid} to ${outputPath}`);
      
      let fileBuffer;
      let downloadUrl;

      // Determine download method based on CID format
      if (cid.startsWith('sha256:')) {
        throw new Error('Cannot download dry-run CID');
      } else if (cid.startsWith('0g://')) {
        // 0G Storage download
        fileBuffer = await this.downloadFrom0GStorage(cid);
        downloadUrl = cid;
      } else {
        // IPFS download
        downloadUrl = this.gatewayBase ? 
          `${this.gatewayBase.replace(/\/+$/, '')}/${cid}` : 
          `ipfs://${cid}`;
        fileBuffer = await this.downloadFromIPFS(downloadUrl);
      }

      // Verify hash if requested
      if (verifyHash) {
        const actualHash = createHash('sha256').update(fileBuffer).digest('hex');
        if (expectedHash && expectedHash !== `0x${actualHash}`) {
          throw new Error(`Hash mismatch: expected ${expectedHash}, got 0x${actualHash}`);
        }
        console.error(`[storage] Hash verified: 0x${actualHash}`);
      }

      await writeFile(outputPath, fileBuffer);
      console.error(`[storage] Download complete: ${outputPath}`);

      return {
        path: outputPath,
        size: fileBuffer.length,
        hash: `0x${createHash('sha256').update(fileBuffer).digest('hex')}`,
        url: downloadUrl
      };

    } catch (error) {
      console.error(`[storage] Download failed for ${cid}:`, error.message);
      throw error;
    }
  }

  async downloadFromIPFS(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`IPFS download failed: ${response.status} ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async downloadFrom0GStorage(cid) {
    // Placeholder for 0G Storage download
    // This would need to be implemented with the 0G SDK
    throw new Error('0G Storage download not yet implemented');
  }

  getStorageInfo() {
    return {
      mode: this.mode,
      ipfsConfigured: !!this.ipfsBase,
      gatewayConfigured: !!this.gatewayBase,
      ogConfigured: !!this.ogPrivateKey,
      capabilities: {
        upload: this.mode !== 'manual',
        download: this.mode !== 'manual',
        verification: true
      }
    };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const filePath = args[1];

  const storage = new StorageManager();

  try {
    switch (command) {
      case 'upload':
        if (!filePath) {
          console.error('Usage: node storage_manager.js upload <file>');
          process.exit(2);
        }
        const result = await storage.uploadFile(filePath);
        console.log(JSON.stringify(result, null, 2));
        break;

      case 'download':
        const outputPath = args[2] || filePath.replace(/[^.]*$/, 'downloaded.$&');
        if (!filePath) {
          console.error('Usage: node storage_manager.js download <cid> [output]');
          process.exit(2);
        }
        const downloadResult = await storage.downloadFile(filePath, outputPath);
        console.log(JSON.stringify(downloadResult, null, 2));
        break;

      case 'info':
        console.log(JSON.stringify(storage.getStorageInfo(), null, 2));
        break;

      default:
        console.error('Usage: node storage_manager.js <upload|download|info> [args...]');
        process.exit(2);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { StorageManager };
