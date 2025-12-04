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

// Get epoch data (from JSON file or blockchain)
app.get('/api/epoch/:epochNumber', async (req, res) => {
    try {
        const epochNumber = req.params.epochNumber;
        const epochDataPath = path.join(FRONTEND_PATH, 'data', `epoch_${epochNumber}_mainnet_data.json`);
        const fs = await import('fs/promises');
        
        // Try to load from JSON file first
        try {
            const epochData = JSON.parse(await fs.readFile(epochDataPath, 'utf-8'));
            res.json(epochData);
            return;
        } catch (fileError) {
            // If file doesn't exist, fetch from blockchain
            console.log(`Epoch ${epochNumber} JSON file not found, fetching from blockchain...`);
        }
        
        // Fetch from blockchain
        const deployDataPath = path.join(FRONTEND_PATH, 'data', 'deploy.mainnet.json');
        const deployData = JSON.parse(await fs.readFile(deployDataPath, 'utf-8'));
        const epochManagerAddress = deployData.addresses.EpochManager;
        
        // Load contract ABI
        const epochManagerArtPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'EpochManager.sol', 'EpochManager.json');
        let epochManagerArt;
        try {
            epochManagerArt = JSON.parse(await fs.readFile(epochManagerArtPath, 'utf-8'));
        } catch (e) {
            const altPath = path.join(FRONTEND_PATH, '..', 'artifacts', 'contracts', 'EpochManager.sol', 'EpochManager.json');
            epochManagerArt = JSON.parse(await fs.readFile(altPath, 'utf-8'));
        }
        const epochManager = new ethers.Contract(epochManagerAddress, epochManagerArt.abi, provider);
        
        // Get epoch info from blockchain
        const epochInfo = await epochManager.epochs(epochNumber);
        
        // Get update events
        const filter = epochManager.filters.UpdateSubmitted(epochNumber);
        const events = await epochManager.queryFilter(filter);
        
        // Build epoch data structure
        const epochData = {
            epochId: parseInt(epochNumber),
            modelHash: epochInfo.modelHash,
            scoresRoot: epochInfo.scoresRoot !== '0x0000000000000000000000000000000000000000000000000000000000000000' ? epochInfo.scoresRoot : null,
            globalModelCid: epochInfo.globalModelCid || null,
            globalModelHash: epochInfo.globalModelHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' ? epochInfo.globalModelHash : null,
            published: epochInfo.published,
            updates: events.map(e => ({
                submitter: e.args.submitter,
                updateCid: e.args.updateCid,
                updateHash: e.args.updateHash,
                blockNumber: e.blockNumber,
                transactionHash: e.transactionHash
            }))
        };
        
        res.json(epochData);
    } catch (error) {
        console.error(`Error loading epoch ${req.params.epochNumber} data:`, error);
        res.status(500).json({ error: `Failed to load epoch ${req.params.epochNumber} data`, message: error.message });
    }
});

// Get latest epoch data
app.get('/api/epoch/latest', async (req, res) => {
    try {
        const deployDataPath = path.join(FRONTEND_PATH, 'data', 'deploy.mainnet.json');
        const fs = await import('fs/promises');
        const deployData = JSON.parse(await fs.readFile(deployDataPath, 'utf-8'));
        const epochManagerAddress = deployData.addresses.EpochManager;
        
        // Load contract ABI
        const epochManagerArtPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'EpochManager.sol', 'EpochManager.json');
        let epochManagerArt;
        try {
            epochManagerArt = JSON.parse(await fs.readFile(epochManagerArtPath, 'utf-8'));
        } catch (e) {
            const altPath = path.join(FRONTEND_PATH, '..', 'artifacts', 'contracts', 'EpochManager.sol', 'EpochManager.json');
            epochManagerArt = JSON.parse(await fs.readFile(altPath, 'utf-8'));
        }
        const epochManager = new ethers.Contract(epochManagerAddress, epochManagerArt.abi, provider);
        
        // Find latest epoch
        let latestEpoch = 0;
        for (let i = 10; i >= 1; i--) {
            try {
                const info = await epochManager.epochs(i);
                if (info.modelHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                    latestEpoch = i;
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (latestEpoch === 0) {
            return res.status(404).json({ error: 'No epochs found' });
        }
        
        // Fetch epoch data using the existing endpoint logic
        const epochInfo = await epochManager.epochs(latestEpoch);
        const filter = epochManager.filters.UpdateSubmitted(latestEpoch);
        const events = await epochManager.queryFilter(filter);
        
        const epochData = {
            epochId: latestEpoch,
            modelHash: epochInfo.modelHash,
            scoresRoot: epochInfo.scoresRoot !== '0x0000000000000000000000000000000000000000000000000000000000000000' ? epochInfo.scoresRoot : null,
            globalModelCid: epochInfo.globalModelCid || null,
            globalModelHash: epochInfo.globalModelHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' ? epochInfo.globalModelHash : null,
            published: epochInfo.published,
            updates: events.map(e => ({
                submitter: e.args.submitter,
                updateCid: e.args.updateCid,
                updateHash: e.args.updateHash,
                blockNumber: e.blockNumber,
                transactionHash: e.transactionHash
            }))
        };
        
        res.json(epochData);
    } catch (error) {
        console.error('Error fetching latest epoch:', error);
        res.status(500).json({ error: 'Failed to fetch latest epoch', message: error.message });
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

// Training API endpoints
// Get training status
app.get('/api/training/status', async (req, res) => {
    try {
        const deployDataPath = path.join(FRONTEND_PATH, 'data', 'deploy.mainnet.json');
        const fs = await import('fs/promises');
        const deployData = JSON.parse(await fs.readFile(deployDataPath, 'utf-8'));
        const epochManagerAddress = deployData.addresses.EpochManager;
        
        // Load contract ABI
        const epochManagerArtPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'EpochManager.sol', 'EpochManager.json');
        let epochManagerArt;
        try {
            epochManagerArt = JSON.parse(await fs.readFile(epochManagerArtPath, 'utf-8'));
        } catch (e) {
            // Fallback: try data directory
            const altPath = path.join(FRONTEND_PATH, '..', 'artifacts', 'contracts', 'EpochManager.sol', 'EpochManager.json');
            epochManagerArt = JSON.parse(await fs.readFile(altPath, 'utf-8'));
        }
        const epochManager = new ethers.Contract(epochManagerAddress, epochManagerArt.abi, provider);
        
        // Check latest epoch (try epochs 1-10)
        let latestEpoch = 0;
        let epochInfo = null;
        
        for (let i = 10; i >= 1; i--) {
            try {
                const info = await epochManager.epochs(i);
                if (info.modelHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                    latestEpoch = i;
                    epochInfo = info;
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        // Get update count for latest epoch
        let updateCount = 0;
        let connectedClients = 0;
        if (latestEpoch > 0) {
            try {
                const filter = epochManager.filters.UpdateSubmitted(latestEpoch);
                const events = await epochManager.queryFilter(filter);
                updateCount = events.length;
                // Count unique submitters
                const uniqueSubmitters = new Set(events.map(e => e.args.submitter));
                connectedClients = uniqueSubmitters.size;
            } catch (e) {
                console.error('Error fetching updates:', e);
            }
        }
        
        const isActive = latestEpoch > 0 && epochInfo && !epochInfo.published;
        
        res.json({
            status: isActive ? 'active' : 'inactive',
            currentRound: latestEpoch > 0 ? latestEpoch : 0,
            totalRounds: 10, // Default, can be configured
            connectedClients: connectedClients,
            epochId: latestEpoch,
            published: epochInfo ? epochInfo.published : false
        });
    } catch (error) {
        console.error('Error fetching training status:', error);
        res.status(500).json({ error: 'Failed to fetch training status', message: error.message });
    }
});

// Start training (start new epoch)
app.post('/api/training/start', async (req, res) => {
    try {
        const { numRounds, minClients, localEpochs, batchSize, learningRate, model } = req.body;
        
        // Validate required fields
        if (!numRounds || !minClients) {
            return res.status(400).json({ error: 'Number of rounds and minimum clients are required' });
        }
        
        // Load deployment info
        const deployDataPath = path.join(FRONTEND_PATH, 'data', 'deploy.mainnet.json');
        const fs = await import('fs/promises');
        const deployData = JSON.parse(await fs.readFile(deployDataPath, 'utf-8'));
        const epochManagerAddress = deployData.addresses.EpochManager;
        
        // Check if PRIVATE_KEY is set (required for transactions)
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            return res.status(500).json({ 
                error: 'PRIVATE_KEY not configured', 
                message: 'Backend requires PRIVATE_KEY in .env to start epochs' 
            });
        }
        
        // Create wallet
        const wallet = new ethers.Wallet(privateKey, provider);
        
        // Load contract ABI
        const epochManagerArtPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'EpochManager.sol', 'EpochManager.json');
        let epochManagerArt;
        try {
            epochManagerArt = JSON.parse(await fs.readFile(epochManagerArtPath, 'utf-8'));
        } catch (e) {
            // Fallback: try data directory
            const altPath = path.join(FRONTEND_PATH, '..', 'artifacts', 'contracts', 'EpochManager.sol', 'EpochManager.json');
            epochManagerArt = JSON.parse(await fs.readFile(altPath, 'utf-8'));
        }
        const epochManager = new ethers.Contract(epochManagerAddress, epochManagerArt.abi, wallet);
        
        // Find next available epoch ID
        let nextEpochId = 1;
        for (let i = 1; i <= 100; i++) {
            try {
                const info = await epochManager.epochs(i);
                if (info.modelHash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
                    nextEpochId = i;
                    break;
                }
            } catch (e) {
                nextEpochId = i;
                break;
            }
        }
        
        // Generate model hash for new epoch
        const modelHash = ethers.keccak256(ethers.toUtf8Bytes(`epoch-${nextEpochId}-${Date.now()}-${learningRate || '0.01'}`));
        
        // Start epoch on blockchain
        const tx = await epochManager.startEpoch(nextEpochId, modelHash);
        await tx.wait();
        
        // Save training config (optional, for reference)
        const trainingConfig = {
            epochId: nextEpochId,
            numRounds,
            minClients,
            localEpochs,
            batchSize,
            learningRate,
            model,
            startedAt: new Date().toISOString(),
            modelHash: modelHash
        };
        
        res.json({
            success: true,
            epochId: nextEpochId,
            modelHash: modelHash,
            transactionHash: tx.hash,
            config: trainingConfig
        });
    } catch (error) {
        console.error('Error starting training:', error);
        res.status(500).json({ 
            error: 'Failed to start training', 
            message: error.message,
            details: error.reason || error.code
        });
    }
});

// Stop training (not implemented in contract, but we can track status)
app.post('/api/training/stop', async (req, res) => {
    try {
        // Note: There's no "stop epoch" function in the contract
        // This would need to be implemented as a status tracking mechanism
        res.json({
            success: true,
            message: 'Training stop requested. Note: Epochs cannot be stopped on-chain, only completed.'
        });
    } catch (error) {
        console.error('Error stopping training:', error);
        res.status(500).json({ error: 'Failed to stop training', message: error.message });
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

