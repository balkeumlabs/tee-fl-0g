/**
 * TEE-FL-0G Backend API Server
 * 
 * Express.js server that:
 * - Serves frontend static files
 * - Provides API endpoints for blockchain data
 * - Fetches data from 0G Mainnet RPC
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { ethers } from 'ethers';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://evmrpc.0g.ai';
const FRONTEND_PATH = process.env.FRONTEND_PATH || path.join(__dirname, '..', 'frontend');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Create ethers provider
const provider = new ethers.JsonRpcProvider(RPC_ENDPOINT);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        rpc: RPC_ENDPOINT
    });
});

// Get deployment information
app.get('/api/deployment', async (req, res) => {
    try {
        const deployDataPath = path.join(FRONTEND_PATH, 'data', 'deploy.mainnet.json');
        const fs = await import('fs/promises');
        const deployData = JSON.parse(await fs.readFile(deployDataPath, 'utf-8'));
        res.json(deployData);
    } catch (error) {
        console.error('Error loading deployment data:', error);
        res.status(500).json({ error: 'Failed to load deployment data' });
    }
});

// Get epoch data
app.get('/api/epoch/:epochNumber', async (req, res) => {
    try {
        const epochNumber = req.params.epochNumber;
        const epochDataPath = path.join(FRONTEND_PATH, 'data', `epoch_${epochNumber}_mainnet_data.json`);
        const fs = await import('fs/promises');
        const epochData = JSON.parse(await fs.readFile(epochDataPath, 'utf-8'));
        res.json(epochData);
    } catch (error) {
        console.error(`Error loading epoch ${req.params.epochNumber} data:`, error);
        res.status(500).json({ error: `Failed to load epoch ${req.params.epochNumber} data` });
    }
});

// Get storage upload data
app.get('/api/storage', async (req, res) => {
    try {
        const storageDataPath = path.join(FRONTEND_PATH, 'data', '0g_storage_upload_mainnet.json');
        const fs = await import('fs/promises');
        const storageData = JSON.parse(await fs.readFile(storageDataPath, 'utf-8'));
        res.json(storageData);
    } catch (error) {
        console.error('Error loading storage data:', error);
        res.status(500).json({ error: 'Failed to load storage data' });
    }
});

// Get transaction receipt (gas info)
app.post('/api/transaction/receipt', async (req, res) => {
    try {
        const { txHash } = req.body;
        if (!txHash) {
            return res.status(400).json({ error: 'Transaction hash required' });
        }

        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const gasUsed = receipt.gasUsed.toString();
        const effectiveGasPrice = receipt.gasPrice ? receipt.gasPrice.toString() : null;
        
        let tokenCostWei = null;
        if (effectiveGasPrice) {
            tokenCostWei = (BigInt(gasUsed) * BigInt(effectiveGasPrice)).toString();
        }

        res.json({
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber.toString(),
            gasUsed: gasUsed,
            effectiveGasPrice: effectiveGasPrice,
            tokenCostWei: tokenCostWei,
            status: receipt.status === 1 ? 'success' : 'failed'
        });
    } catch (error) {
        console.error('Error fetching transaction receipt:', error);
        res.status(500).json({ error: 'Failed to fetch transaction receipt' });
    }
});

// Get current block number
app.get('/api/network/blockNumber', async (req, res) => {
    try {
        const blockNumber = await provider.getBlockNumber();
        res.json({ blockNumber: blockNumber.toString() });
    } catch (error) {
        console.error('Error fetching block number:', error);
        res.status(500).json({ error: 'Failed to fetch block number' });
    }
});

// Get network health
app.get('/api/network/health', async (req, res) => {
    try {
        const blockNumber = await provider.getBlockNumber();
        const block = await provider.getBlock(blockNumber);
        const previousBlock = await provider.getBlock(blockNumber - 1);
        
        let blockTime = null;
        if (block && previousBlock && block.timestamp && previousBlock.timestamp) {
            blockTime = Number(block.timestamp - previousBlock.timestamp);
        }

        res.json({
            blockNumber: blockNumber.toString(),
            blockTime: blockTime ? `${blockTime}s` : null,
            status: 'healthy',
            rpc: RPC_ENDPOINT
        });
    } catch (error) {
        console.error('Error fetching network health:', error);
        res.status(500).json({ 
            error: 'Failed to fetch network health',
            status: 'unhealthy'
        });
    }
});

// Get contract information
app.get('/api/contracts', async (req, res) => {
    try {
        const deployDataPath = path.join(FRONTEND_PATH, 'data', 'deploy.mainnet.json');
        const fs = await import('fs/promises');
        const deployData = JSON.parse(await fs.readFile(deployDataPath, 'utf-8'));
        
        const contracts = {
            AccessRegistry: deployData.addresses.AccessRegistry,
            EpochManager: deployData.addresses.EpochManager,
            network: deployData.network,
            chainId: deployData.chainId,
            deployedAt: deployData.generatedAtUtc
        };

        res.json(contracts);
    } catch (error) {
        console.error('Error loading contract data:', error);
        res.status(500).json({ error: 'Failed to load contract data' });
    }
});

// Serve frontend static files
app.use(express.static(FRONTEND_PATH));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(FRONTEND_PATH, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
    console.log(`Frontend path: ${FRONTEND_PATH}`);
    console.log(`RPC endpoint: ${RPC_ENDPOINT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    process.exit(0);
});

