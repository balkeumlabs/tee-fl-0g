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

// Cache for latest epoch (to avoid expensive searches)
let latestEpochCache = {
    epochId: null,
    timestamp: 0,
    ttl: 30000 // Cache for 30 seconds
};

// Demo mode state (for testing without blockchain)
let demoMode = {
    enabled: false,
    currentEpoch: null,
    epochData: null,
    startTime: null
};

// Helper to get cached latest epoch or null if expired
function getCachedLatestEpoch() {
    if (latestEpochCache.epochId && (Date.now() - latestEpochCache.timestamp) < latestEpochCache.ttl) {
        return latestEpochCache.epochId;
    }
    return null;
}

// Helper to update cache
function updateLatestEpochCache(epochId) {
    latestEpochCache.epochId = epochId;
    latestEpochCache.timestamp = Date.now();
}

// Initialize Express app
const app = express();

// Async error wrapper for routes
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Middleware
app.use(cors());
app.use(express.json());

// Logging middleware for API routes
app.use('/api', (req, res, next) => {
    console.log(`[API] ${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});

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

// Get latest epoch data (MUST be before /api/epoch/:epochNumber to avoid route conflict)
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
        
        // Check demo mode first (if enabled, return demo data)
        if (demoMode.enabled && demoMode.epochData) {
            console.log(`[Latest Epoch] Returning demo epoch ${demoMode.epochData.epochId}`);
            return res.json(demoMode.epochData);
        }
        
        // Check cache first (fast path)
        let latestEpoch = getCachedLatestEpoch();
        if (latestEpoch !== null) {
            console.log(`[Latest Epoch] Using cached value: ${latestEpoch}`);
        } else {
            // Find latest epoch - optimized search with timeout protection
            // Strategy: Check small range around likely latest epoch, then expand if needed
            latestEpoch = 0;
            const SEARCH_TIMEOUT = 8000; // 8 second max for entire search
            
            // Start search with timeout
            const searchPromise = (async () => {
                // Step 1: Try event query first (fastest if events are indexed)
                // This is the most reliable way to find the latest epoch
                try {
                    const epochStartedFilter = epochManager.filters.EpochStarted();
                    const eventQueryPromise = epochManager.queryFilter(epochStartedFilter);
                    const eventTimeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Event query timeout')), 4000)
                    );
                    
                    const allEpochStartedEvents = await Promise.race([eventQueryPromise, eventTimeoutPromise]);
                    
                    if (allEpochStartedEvents && allEpochStartedEvents.length > 0) {
                        const epochIds = allEpochStartedEvents.map(e => {
                            const epochId = e.args.epochId;
                            return typeof epochId === 'bigint' ? Number(epochId) : parseInt(epochId.toString());
                        });
                        latestEpoch = Math.max(...epochIds);
                        console.log(`[Latest Epoch] Found ${allEpochStartedEvents.length} events, highest: ${latestEpoch}`);
                    }
                } catch (e) {
                    console.warn('[Latest Epoch] Event query failed, falling back to direct search:', e.message);
                }
                
                // Step 2: If events didn't work, check recent epochs in parallel batches
                if (latestEpoch === 0) {
                    // Check from epoch 30 down to 1 (covers most realistic scenarios)
                    const checkStart = 30;
                    const checkCount = 20; // Check 20 epochs
                    
                    // Check in batches of 5 in parallel for speed
                    for (let batchStart = checkStart; batchStart >= Math.max(1, checkStart - checkCount); batchStart -= 5) {
                        const batchEnd = Math.max(1, batchStart - 4);
                        const batchPromises = [];
                        
                        for (let i = batchStart; i >= batchEnd; i--) {
                            batchPromises.push(
                                epochManager.epochs(i)
                                    .then(info => {
                                        if (info.modelHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                                            return i;
                                        }
                                        return 0;
                                    })
                                    .catch(() => 0)
                            );
                        }
                        
                        const batchResults = await Promise.all(batchPromises);
                        const foundEpoch = Math.max(...batchResults);
                        
                        if (foundEpoch > 0) {
                            latestEpoch = foundEpoch;
                            console.log(`[Latest Epoch] Found epoch ${foundEpoch} via parallel batch search`);
                            break;
                        }
                    }
                }
                
                return latestEpoch;
            })();
            
            // Race search against timeout
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Epoch search timeout')), SEARCH_TIMEOUT)
            );
            
            try {
                latestEpoch = await Promise.race([searchPromise, timeoutPromise]);
            } catch (e) {
                console.error('[Latest Epoch] Search timed out or failed:', e.message);
                // If search fails, try to use training status endpoint's latest epoch
                // (it has a simpler search that might work)
                latestEpoch = 0;
            }
            
            // Update cache if we found something
            if (latestEpoch > 0) {
                updateLatestEpochCache(latestEpoch);
            }
        }
        
        if (latestEpoch === 0) {
            return res.status(404).json({ error: 'No epochs found' });
        }
        
        // Fetch epoch data using the existing endpoint logic
        const epochInfo = await epochManager.epochs(latestEpoch);
        
        // Fetch all events for this epoch
        const epochStartedFilter = epochManager.filters.EpochStarted(latestEpoch);
        const updateSubmittedFilter = epochManager.filters.UpdateSubmitted(latestEpoch);
        const scoresPostedFilter = epochManager.filters.ScoresRootPosted(latestEpoch);
        const modelPublishedFilter = epochManager.filters.ModelPublished(latestEpoch);
        
        const [epochStartedEvents, updateEvents, scoresEvents, publishedEvents] = await Promise.all([
            epochManager.queryFilter(epochStartedFilter).catch(() => []),
            epochManager.queryFilter(updateSubmittedFilter).catch(() => []),
            epochManager.queryFilter(scoresPostedFilter).catch(() => []),
            epochManager.queryFilter(modelPublishedFilter).catch(() => [])
        ]);
        
        // Structure data to match frontend expectations
        const epochData = {
            epochId: latestEpoch,
            modelHash: epochInfo.modelHash,
            scoresRoot: epochInfo.scoresRoot !== '0x0000000000000000000000000000000000000000000000000000000000000000' ? epochInfo.scoresRoot : null,
            globalModelCid: epochInfo.globalModelCid || null,
            globalModelHash: epochInfo.globalModelHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' ? epochInfo.globalModelHash : null,
            published: epochInfo.published,
            events: {
                epochStarted: epochStartedEvents.map(e => ({
                    epochId: e.args.epochId.toString(),
                    modelHash: e.args.modelHash,
                    blockNumber: e.blockNumber,
                    transactionHash: e.transactionHash
                })),
                updatesSubmitted: updateEvents.map(e => ({
                    epochId: e.args.epochId.toString(),
                    submitter: e.args.submitter,
                    updateCid: e.args.updateCid,
                    updateHash: e.args.updateHash,
                    blockNumber: e.blockNumber,
                    transactionHash: e.transactionHash
                })),
                scoresPosted: scoresEvents.map(e => ({
                    epochId: e.args.epochId.toString(),
                    scoresRoot: e.args.scoresRoot,
                    blockNumber: e.blockNumber,
                    transactionHash: e.transactionHash
                })),
                modelPublished: publishedEvents.map(e => ({
                    epochId: e.args.epochId.toString(),
                    globalModelCid: e.args.globalModelCid,
                    globalModelHash: e.args.globalModelHash,
                    blockNumber: e.blockNumber,
                    transactionHash: e.transactionHash
                }))
            }
        };
        
        res.json(epochData);
    } catch (error) {
        console.error('Error fetching latest epoch:', error);
        res.status(500).json({ error: 'Failed to fetch latest epoch', message: error.message });
    }
});

// Get epoch data (from JSON file or blockchain)
app.get('/api/epoch/:epochNumber', asyncHandler(async (req, res) => {
    try {
        const epochNumber = req.params.epochNumber;
        
        // Prevent "latest" from being treated as an epoch number
        if (epochNumber === 'latest') {
            return res.status(400).json({ error: 'Use /api/epoch/latest endpoint instead' });
        }
        
        // Validate epoch number is numeric
        const epochNum = parseInt(epochNumber);
        if (isNaN(epochNum) || epochNum <= 0) {
            return res.status(400).json({ error: 'Invalid epoch number' });
        }
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
        
        // Get epoch info from blockchain (use validated numeric value)
        const epochInfo = await epochManager.epochs(epochNum);
        
        // Fetch all events for this epoch
        const epochStartedFilter = epochManager.filters.EpochStarted(epochNum);
        const updateSubmittedFilter = epochManager.filters.UpdateSubmitted(epochNum);
        const scoresPostedFilter = epochManager.filters.ScoresRootPosted(epochNum);
        const modelPublishedFilter = epochManager.filters.ModelPublished(epochNum);
        
        const [epochStartedEvents, updateEvents, scoresEvents, publishedEvents] = await Promise.all([
            epochManager.queryFilter(epochStartedFilter).catch(() => []),
            epochManager.queryFilter(updateSubmittedFilter).catch(() => []),
            epochManager.queryFilter(scoresPostedFilter).catch(() => []),
            epochManager.queryFilter(modelPublishedFilter).catch(() => [])
        ]);
        
        // Build epoch data structure to match frontend expectations
        const epochData = {
            epochId: epochNum,
            modelHash: epochInfo.modelHash,
            scoresRoot: epochInfo.scoresRoot !== '0x0000000000000000000000000000000000000000000000000000000000000000' ? epochInfo.scoresRoot : null,
            globalModelCid: epochInfo.globalModelCid || null,
            globalModelHash: epochInfo.globalModelHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' ? epochInfo.globalModelHash : null,
            published: epochInfo.published,
            events: {
                epochStarted: epochStartedEvents.map(e => ({
                    epochId: e.args.epochId.toString(),
                    modelHash: e.args.modelHash,
                    blockNumber: e.blockNumber,
                    transactionHash: e.transactionHash
                })),
                updatesSubmitted: updateEvents.map(e => ({
                    epochId: e.args.epochId.toString(),
                    submitter: e.args.submitter,
                    updateCid: e.args.updateCid,
                    updateHash: e.args.updateHash,
                    blockNumber: e.blockNumber,
                    transactionHash: e.transactionHash
                })),
                scoresPosted: scoresEvents.map(e => ({
                    epochId: e.args.epochId.toString(),
                    scoresRoot: e.args.scoresRoot,
                    blockNumber: e.blockNumber,
                    transactionHash: e.transactionHash
                })),
                modelPublished: publishedEvents.map(e => ({
                    epochId: e.args.epochId.toString(),
                    globalModelCid: e.args.globalModelCid,
                    globalModelHash: e.args.globalModelHash,
                    blockNumber: e.blockNumber,
                    transactionHash: e.transactionHash
                }))
            }
        };
        
        res.json(epochData);
    } catch (error) {
        console.error(`Error loading epoch ${req.params.epochNumber} data:`, error);
        res.status(500).json({ error: `Failed to load epoch ${req.params.epochNumber} data`, message: error.message });
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
app.get('/api/training/status', asyncHandler(async (req, res) => {
    try {
        // Check demo mode first
        if (demoMode.enabled && demoMode.currentEpoch) {
            const updateCount = demoMode.epochData?.events?.updateSubmitted?.length || 0;
            const isActive = !demoMode.currentEpoch.published;
            
            return res.json({
                status: isActive ? 'active' : 'inactive',
                currentRound: demoMode.currentEpoch.epochId,
                totalRounds: null,
                connectedClients: updateCount,
                updateCount: updateCount,
                epochId: demoMode.currentEpoch.epochId,
                published: demoMode.currentEpoch.published,
                demo: true
            });
        }
        
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
        
        // Check latest epoch (try epochs 1-100, starting from highest)
        let latestEpoch = 0;
        let epochInfo = null;
        
        for (let i = 100; i >= 1; i--) {
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
                console.log(`[Status] Epoch ${latestEpoch}: Found ${updateCount} updates from ${connectedClients} unique clients`);
            } catch (e) {
                console.error('Error fetching updates:', e);
            }
        }
        
        const isActive = latestEpoch > 0 && epochInfo && !epochInfo.published;
        
        // Always show latest epoch data, even if published (for display purposes)
        res.json({
            status: isActive ? 'active' : 'inactive',
            currentRound: latestEpoch, // Always show latest epoch number, even if published
            totalRounds: null, // No limit - epochs can continue indefinitely
            connectedClients: updateCount > 0 ? updateCount : connectedClients, // Show update count for demo (all from same wallet)
            updateCount: updateCount, // Total number of updates submitted
            epochId: latestEpoch,
            published: epochInfo ? epochInfo.published : false
        });
    } catch (error) {
        console.error('Error fetching training status:', error);
        res.status(500).json({ error: 'Failed to fetch training status', message: error.message });
    }
});

// Start training (start new epoch)
app.post('/api/training/start', asyncHandler(async (req, res) => {
    console.log('[Training Start] Request received:', {
        method: req.method,
        path: req.path,
        body: req.body,
        headers: req.headers['content-type']
    });
    
    try {
        const { numRounds, minClients, localEpochs, batchSize, learningRate, model } = req.body;
        console.log('[Training Start] Parsed body:', { numRounds, minClients, localEpochs, batchSize, learningRate, model });
        
        // Validate required fields
        if (!numRounds || !minClients) {
            return res.status(400).json({ error: 'Number of rounds and minimum clients are required' });
        }
        
        // Load deployment info
        const deployDataPath = path.join(FRONTEND_PATH, 'data', 'deploy.mainnet.json');
        const fs = await import('fs/promises');
        
        let deployData;
        try {
            const deployDataContent = await fs.readFile(deployDataPath, 'utf-8');
            deployData = JSON.parse(deployDataContent);
        } catch (fileError) {
            console.error(`[Training Start] Failed to read deploy.mainnet.json:`, fileError);
            return res.status(500).json({ 
                error: 'Deployment configuration not found', 
                message: `Could not read ${deployDataPath}: ${fileError.message}` 
            });
        }
        
        if (!deployData.addresses || !deployData.addresses.EpochManager) {
            return res.status(500).json({ 
                error: 'Invalid deployment configuration', 
                message: 'EpochManager address not found in deployment data' 
            });
        }
        
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
        
        // Invalidate cache since we just created a new epoch
        latestEpochCache.epochId = null;
        latestEpochCache.timestamp = 0;
        console.log(`[Cache] Invalidated latest epoch cache (new epoch ${nextEpochId} created)`);
        
        // AUTOMATIC DEMO: Simulate clients and complete pipeline
        console.log(`[Demo] Starting automatic demo simulation for epoch ${nextEpochId}...`);
        const demoResults = {
            clientsSubmitted: 0,
            scoresPosted: false,
            modelPublished: false
        };
        
        // Step 1: Submit client updates (use minClients from form, default to 5)
        const numClients = minClients || 5;
        for (let i = 1; i <= numClients; i++) {
            try {
                const clientUpdate = {
                    epoch: nextEpochId,
                    clientId: `client-${i}`,
                    timestamp: Math.floor(Date.now() / 1000),
                    modelWeights: Array.from({ length: 10 }, () => Math.random()),
                    loss: 0.5 - (i * 0.05),
                    accuracy: 0.6 + (i * 0.04),
                    round: nextEpochId
                };
                
                const updateCid = `demo-client${i}-epoch${nextEpochId}-${Date.now()}`;
                const updateHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(clientUpdate)));
                
                console.log(`[Demo] Submitting client ${i}/${numClients} update...`);
                const updateTx = await epochManager.submitUpdate(nextEpochId, updateCid, updateHash);
                console.log(`[Demo] Client ${i} transaction sent: ${updateTx.hash}`);
                const receipt = await updateTx.wait();
                console.log(`[Demo] Client ${i} transaction confirmed in block ${receipt.blockNumber}`);
                demoResults.clientsSubmitted++;
                
                // Small delay between submissions
                if (i < numClients) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                console.error(`[Demo] Failed to submit client ${i} update:`, error.message);
                console.error(`[Demo] Error details:`, error);
            }
        }
        
        // Wait a bit for events to be indexed
        console.log(`[Demo] Waiting for events to be indexed...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 2: Post scores root
        try {
            // Retry mechanism to wait for events to be indexed
            let events = [];
            let retries = 5;
            while (events.length === 0 && retries > 0) {
                const filter = epochManager.filters.UpdateSubmitted(nextEpochId);
                events = await epochManager.queryFilter(filter);
                if (events.length === 0) {
                    console.log(`[Demo] No events found yet, retrying... (${retries} retries left)`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    retries--;
                } else {
                    console.log(`[Demo] Found ${events.length} UpdateSubmitted events`);
                }
            }
            
            if (events.length > 0) {
                const scores = events.map((e, idx) => ({
                    submitter: e.args.submitter,
                    score: 0.75 + (idx * 0.04)
                }));
                
                const scoresData = scores.map(s => `${s.submitter}-${s.score.toFixed(4)}`).join('|');
                const scoresRoot = ethers.keccak256(ethers.toUtf8Bytes(scoresData));
                
                const scoresTx = await epochManager.postScoresRoot(nextEpochId, scoresRoot);
                await scoresTx.wait();
                demoResults.scoresPosted = true;
            }
        } catch (error) {
            console.error(`[Demo] Failed to post scores root:`, error.message);
        }
        
        // Step 3: Publish aggregated model
        try {
            const globalModelCid = `aggregated-model-epoch${nextEpochId}-${Date.now()}`;
            const globalModelData = {
                epoch: nextEpochId,
                aggregated: true,
                timestamp: Math.floor(Date.now() / 1000),
                participants: demoResults.clientsSubmitted,
                avgLoss: 0.35,
                avgAccuracy: 0.82,
                modelVersion: `v1.${nextEpochId}`
            };
            const globalModelHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(globalModelData)));
            
            const publishTx = await epochManager.publishModel(nextEpochId, globalModelCid, globalModelHash);
            await publishTx.wait();
            demoResults.modelPublished = true;
        } catch (error) {
            console.error(`[Demo] Failed to publish model:`, error.message);
        }
        
        console.log(`[Demo] Completed: ${demoResults.clientsSubmitted} clients, scores: ${demoResults.scoresPosted}, published: ${demoResults.modelPublished}`);
        
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
            config: trainingConfig,
            demo: demoResults
        });
    } catch (error) {
        console.error('Error starting training:', error);
        console.error('Error stack:', error.stack);
        // Always return JSON, never HTML
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Failed to start training', 
                message: error.message || 'Unknown error',
                details: error.reason || error.code || 'No additional details'
            });
        }
    }
}));

// Demo mode: Start training without blockchain (for testing)
app.post('/api/training/start-demo', asyncHandler(async (req, res) => {
    console.log('[Demo Mode] Starting demo training (no blockchain)...');
    
    try {
        const { numRounds, minClients, localEpochs, batchSize, learningRate, model } = req.body;
        const numClients = minClients || 5;
        
        // Generate demo epoch data
        const demoEpochId = demoMode.currentEpoch ? demoMode.currentEpoch.epochId + 1 : 1;
        const now = Date.now();
        
        // Simulate epoch start
        const modelHash = ethers.keccak256(ethers.toUtf8Bytes(`demo-epoch-${demoEpochId}-${now}`));
        const globalModelCid = `aggregated-model-epoch${demoEpochId}-${now}`;
        const globalModelHash = ethers.keccak256(ethers.toUtf8Bytes(globalModelCid));
        const scoresRoot = ethers.keccak256(ethers.toUtf8Bytes(`scores-epoch-${demoEpochId}-${now}`));
        
        // Create demo epoch data structure
        const epochData = {
            epochId: demoEpochId,
            modelHash: modelHash,
            scoresRoot: scoresRoot,
            globalModelCid: globalModelCid,
            globalModelHash: globalModelHash,
            published: false,
            startTime: now,
            events: {
                epochStarted: [{
                    args: {
                        epochId: demoEpochId,
                        modelHash: modelHash,
                        timestamp: Math.floor(now / 1000)
                    },
                    blockNumber: 1000000 + demoEpochId,
                    transactionHash: `0x${'0'.repeat(64)}`
                }],
                updateSubmitted: [],
                scoresRootPosted: [],
                modelPublished: []
            }
        };
        
        // Enable demo mode
        demoMode.enabled = true;
        demoMode.currentEpoch = {
            epochId: demoEpochId,
            published: false,
            startTime: now
        };
        demoMode.epochData = epochData;
        demoMode.startTime = now;
        
        console.log(`[Demo Mode] Created demo epoch ${demoEpochId} with ${numClients} clients`);
        
        // Return immediately, then simulate pipeline steps asynchronously
        res.json({
            success: true,
            epochId: demoEpochId,
            message: 'Demo training started (simulating pipeline steps...)',
            demo: true
        });
        
        // Simulate pipeline steps with delays (async, doesn't block response)
        setTimeout(async () => {
            console.log(`[Demo Mode] Simulating ${numClients} client updates...`);
            
            // Step 1: Simulate client updates
            for (let i = 1; i <= numClients; i++) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const updateCid = `demo-client${i}-epoch${demoEpochId}-${now}`;
                const updateHash = ethers.keccak256(ethers.toUtf8Bytes(updateCid));
                
                epochData.events.updateSubmitted.push({
                    args: {
                        epochId: demoEpochId,
                        submitter: `0x${'1'.repeat(40)}`,
                        updateCid: updateCid,
                        updateHash: updateHash
                    },
                    blockNumber: 1000000 + demoEpochId + i,
                    transactionHash: `0x${i.toString().padStart(64, '0')}`
                });
                
                console.log(`[Demo Mode] Client ${i}/${numClients} update simulated`);
            }
            
            // Step 2: Simulate scores root posted
            await new Promise(resolve => setTimeout(resolve, 2000));
            epochData.events.scoresRootPosted.push({
                args: {
                    epochId: demoEpochId,
                    scoresRoot: scoresRoot
                },
                blockNumber: 1000000 + demoEpochId + numClients + 1,
                transactionHash: `0x${'2'.repeat(64)}`
            });
            console.log(`[Demo Mode] Scores root posted`);
            
            // Step 3: Simulate model published
            await new Promise(resolve => setTimeout(resolve, 2000));
            epochData.events.modelPublished.push({
                args: {
                    epochId: demoEpochId,
                    globalModelCid: globalModelCid,
                    globalModelHash: globalModelHash
                },
                blockNumber: 1000000 + demoEpochId + numClients + 2,
                transactionHash: `0x${'3'.repeat(64)}`
            });
            
            // Mark as published
            epochData.published = true;
            demoMode.currentEpoch.published = true;
            
            console.log(`[Demo Mode] Model published - demo epoch ${demoEpochId} complete!`);
        }, 100);
        
    } catch (error) {
        console.error('[Demo Mode] Error starting demo:', error);
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Failed to start demo training', 
                message: error.message 
            });
        }
    }
}));

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

// Complete demo - simulate full pipeline (for demo purposes)
app.post('/api/training/complete-demo', async (req, res) => {
    try {
        const { epochId } = req.body;
        
        if (!epochId) {
            return res.status(400).json({ error: 'Epoch ID is required' });
        }
        
        // Load deployment info
        const deployDataPath = path.join(FRONTEND_PATH, 'data', 'deploy.mainnet.json');
        const fs = await import('fs/promises');
        const deployData = JSON.parse(await fs.readFile(deployDataPath, 'utf-8'));
        const epochManagerAddress = deployData.addresses.EpochManager;
        
        // Check if PRIVATE_KEY is set
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            return res.status(500).json({ 
                error: 'PRIVATE_KEY not configured', 
                message: 'Backend requires PRIVATE_KEY in .env to complete demo' 
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
            const altPath = path.join(FRONTEND_PATH, '..', 'artifacts', 'contracts', 'EpochManager.sol', 'EpochManager.json');
            epochManagerArt = JSON.parse(await fs.readFile(altPath, 'utf-8'));
        }
        const epochManager = new ethers.Contract(epochManagerAddress, epochManagerArt.abi, wallet);
        
        // Check epoch exists
        const epochInfo = await epochManager.epochs(epochId);
        if (epochInfo.modelHash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            return res.status(404).json({ error: `Epoch ${epochId} not found or not started` });
        }
        
        const results = {
            epochId: epochId,
            steps: []
        };
        
        // Step 1: Submit client updates
        console.log(`[Demo] Submitting client updates for epoch ${epochId}...`);
        const numClients = 5;
        const updateHashes = [];
        
        for (let i = 1; i <= numClients; i++) {
            const clientUpdate = {
                epoch: epochId,
                clientId: `client-${i}`,
                timestamp: Math.floor(Date.now() / 1000),
                modelWeights: Array.from({ length: 10 }, () => Math.random()),
                loss: 0.5 - (i * 0.05),
                accuracy: 0.6 + (i * 0.04),
                round: epochId
            };
            
            const updateCid = `demo-client${i}-epoch${epochId}-${Date.now()}`;
            const updateHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(clientUpdate)));
            updateHashes.push(updateHash);
            
            try {
                const tx = await epochManager.submitUpdate(epochId, updateCid, updateHash);
                await tx.wait();
                results.steps.push({
                    step: 'submit_update',
                    client: i,
                    transactionHash: tx.hash,
                    success: true
                });
                
                // Small delay between submissions
                if (i < numClients) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                console.error(`[Demo] Failed to submit client ${i} update:`, error.message);
                results.steps.push({
                    step: 'submit_update',
                    client: i,
                    success: false,
                    error: error.message
                });
            }
        }
        
        // Step 2: Post scores root
        console.log(`[Demo] Posting scores root for epoch ${epochId}...`);
        try {
            // Get all submitted updates
            const filter = epochManager.filters.UpdateSubmitted(epochId);
            const events = await epochManager.queryFilter(filter);
            
            // Create dummy scores
            const scores = events.map((e, idx) => ({
                submitter: e.args.submitter,
                score: 0.75 + (idx * 0.04)
            }));
            
            // Compute Merkle root (simplified)
            const scoresData = scores.map(s => `${s.submitter}-${s.score.toFixed(4)}`).join('|');
            const scoresRoot = ethers.keccak256(ethers.toUtf8Bytes(scoresData));
            
            const tx = await epochManager.postScoresRoot(epochId, scoresRoot);
            await tx.wait();
            results.steps.push({
                step: 'post_scores',
                transactionHash: tx.hash,
                scoresRoot: scoresRoot,
                success: true
            });
        } catch (error) {
            console.error(`[Demo] Failed to post scores root:`, error.message);
            results.steps.push({
                step: 'post_scores',
                success: false,
                error: error.message
            });
        }
        
        // Step 3: Publish aggregated model
        console.log(`[Demo] Publishing aggregated model for epoch ${epochId}...`);
        try {
            const globalModelCid = `aggregated-model-epoch${epochId}-${Date.now()}`;
            const globalModelData = {
                epoch: epochId,
                aggregated: true,
                timestamp: Math.floor(Date.now() / 1000),
                participants: numClients,
                avgLoss: 0.35,
                avgAccuracy: 0.82,
                modelVersion: `v1.${epochId}`
            };
            const globalModelHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(globalModelData)));
            
            const tx = await epochManager.publishModel(epochId, globalModelCid, globalModelHash);
            await tx.wait();
            results.steps.push({
                step: 'publish_model',
                transactionHash: tx.hash,
                globalModelCid: globalModelCid,
                globalModelHash: globalModelHash,
                success: true
            });
        } catch (error) {
            console.error(`[Demo] Failed to publish model:`, error.message);
            results.steps.push({
                step: 'publish_model',
                success: false,
                error: error.message
            });
        }
        
        // Get final status
        const filter = epochManager.filters.UpdateSubmitted(epochId);
        const events = await epochManager.queryFilter(filter);
        const uniqueSubmitters = new Set(events.map(e => e.args.submitter));
        const finalEpochInfo = await epochManager.epochs(epochId);
        
        results.summary = {
            totalUpdates: events.length,
            uniqueClients: uniqueSubmitters.size,
            scoresPosted: finalEpochInfo.scoresRoot !== '0x0000000000000000000000000000000000000000000000000000000000000000',
            modelPublished: finalEpochInfo.published
        };
        
        res.json({
            success: true,
            ...results
        });
    } catch (error) {
        console.error('Error completing demo:', error);
        res.status(500).json({ 
            error: 'Failed to complete demo', 
            message: error.message
        });
    }
});

// Error handling middleware (MUST be before static file serving)
app.use((err, req, res, next) => {
    console.error('Error:', err);
    // Only send JSON for API routes
    if (req.path.startsWith('/api')) {
        res.status(500).json({ error: 'Internal server error', message: err.message });
    } else {
        res.status(500).send('Internal server error');
    }
});

// Serve frontend static files
app.use(express.static(FRONTEND_PATH));

// Fallback to index.html for SPA routing (only for GET requests that aren't API routes)
app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(FRONTEND_PATH, 'index.html'));
});

// Global error handlers for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
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

