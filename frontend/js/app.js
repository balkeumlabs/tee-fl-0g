// Configuration
const BLOCK_EXPLORER_BASE = 'https://chainscan.0g.ai';
const API_BASE = window.location.origin; // Use same origin (works for both local and AWS)

// Global error display system
function showGlobalError(message, details = '', errorCode = '') {
    const banner = document.getElementById('global-error-banner');
    const messageEl = document.getElementById('global-error-message');
    const detailsEl = document.getElementById('global-error-details');
    
    if (banner && messageEl) {
        messageEl.textContent = message;
        if (detailsEl) {
            detailsEl.textContent = details ? `Details: ${details}` : '';
            if (errorCode) {
                detailsEl.textContent += ` | Error Code: ${errorCode}`;
            }
        }
        banner.style.display = 'block';
        
        // Log to console with clear marker
        console.error('═══════════════════════════════════════════════════════════');
        console.error('🚨 GLOBAL ERROR DISPLAYED TO USER');
        console.error('Message:', message);
        if (details) console.error('Details:', details);
        if (errorCode) console.error('Error Code:', errorCode);
        console.error('═══════════════════════════════════════════════════════════');
    }
}

function hideGlobalError() {
    const banner = document.getElementById('global-error-banner');
    if (banner) {
        banner.style.display = 'none';
    }
}

// Polling intervals (in milliseconds)
// Set to null to disable auto-polling (only refresh manually)
// Recommended: 5-10 minutes for cost efficiency, or null for manual-only
const NETWORK_HEALTH_POLL_INTERVAL = null; // null = disabled, or set to milliseconds (e.g., 300000 for 5 minutes)
const BLOCK_NUMBER_POLL_INTERVAL = null; // null = disabled, or set to milliseconds (e.g., 300000 for 5 minutes)

let networkHealthInterval = null;
let blockNumberInterval = null;
let dashboardAutoRefreshInterval = null;
let trainingStatusMonitorInterval = null; // Monitor training status continuously
let autoRefreshEndTime = null; // Timestamp when auto-refresh should stop

// Load data from backend API with timeout and optimized retry logic
async function loadData(retries = 3) {
    const REQUEST_TIMEOUT = 15000; // 15 second timeout per request (increased for slow networks/blockchain queries)
    
    // Create abort controller for timeout
    const createTimeoutController = () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, REQUEST_TIMEOUT);
        return { controller, timeoutId };
    };
    
    for (let i = 0; i < retries; i++) {
        try {
            const deployController = createTimeoutController();
            const epochController = createTimeoutController();
            
            const [deployData, epochData] = await Promise.all([
                fetch(`${API_BASE}/api/deployment`, { 
                    cache: 'no-cache',
                    signal: deployController.controller.signal
                })
                    .then(async r => {
                        clearTimeout(deployController.timeoutId);
                        if (!r.ok) {
                            const errorText = await r.text().catch(() => 'Unknown error');
                            throw new Error(`Deployment API failed: HTTP ${r.status} - ${errorText.substring(0, 100)}`);
                        }
                        return r.json();
                    })
                    .catch(err => {
                        if (err.name === 'AbortError') {
                            throw new Error('Deployment API request timed out after 15 seconds');
                        }
                        throw err;
                    }),
                fetch(`${API_BASE}/api/epoch/latest`, { 
                    cache: 'no-cache',
                    signal: epochController.controller.signal
                })
                    .then(async r => {
                        clearTimeout(epochController.timeoutId);
                        if (!r.ok) {
                            // Don't fallback to epoch 1 - if latest fails, return error
                            // The monitoring will retry on next cycle
                            const errorText = await r.text().catch(() => 'Unknown error');
                            throw new Error(`Latest epoch API failed: HTTP ${r.status} - ${errorText.substring(0, 100)}`);
                        }
                        return r.json();
                    })
                    .catch(err => {
                        if (err.name === 'AbortError') {
                            throw new Error('Latest epoch API request timed out after 15 seconds');
                        }
                        throw err;
                    })
            ]);

            return { deployData, epochData };
        } catch (error) {
            const errorMsg = error.message || error.toString();
            console.error(`[LoadData] Error loading data (attempt ${i + 1}/${retries}):`, errorMsg);
            
            if (i === retries - 1) {
                // Last attempt failed - return null but log clearly
                console.error('[LoadData] All retry attempts failed. Dashboard will show error state.');
                showGlobalError(
                    'Failed to load dashboard data after multiple attempts',
                    errorMsg,
                    'API_LOAD_FAILED'
                );
                return null;
            }
            
            // Wait before retry (exponential backoff: 500ms, 1000ms)
            const waitTime = 500 * (i + 1);
            console.log(`[LoadData] Retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    return null;
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    });
}

// Format address (truncate)
function formatAddress(address) {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Format hash (truncate)
function formatHash(hash) {
    if (!hash) return 'N/A';
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

// Create block explorer link
function createExplorerLink(type, value) {
    if (type === 'address') {
        return `${BLOCK_EXPLORER_BASE}/address/${value}`;
    } else if (type === 'tx') {
        return `${BLOCK_EXPLORER_BASE}/tx/${value}`;
    }
    return '#';
}

// Display deployment info
function displayDeploymentInfo(deployData) {
    if (!deployData) return;

    // Deployment date
    const deploymentDate = document.getElementById('deployment-date');
    if (deploymentDate) {
        deploymentDate.textContent = formatDate(deployData.generatedAtUtc);
    }

    // Contract addresses
    const accessRegistryAddress = deployData.addresses.AccessRegistry;
    const epochManagerAddress = deployData.addresses.EpochManager;

    const accessRegistryEl = document.getElementById('access-registry-address');
    const epochManagerEl = document.getElementById('epoch-manager-address');
    const accessRegistryLink = document.getElementById('access-registry-link');
    const epochManagerLink = document.getElementById('epoch-manager-link');

    if (accessRegistryEl) {
        accessRegistryEl.textContent = accessRegistryAddress;
    }
    if (epochManagerEl) {
        epochManagerEl.textContent = epochManagerAddress;
    }
    if (accessRegistryLink) {
        accessRegistryLink.href = createExplorerLink('address', accessRegistryAddress);
    }
    if (epochManagerLink) {
        epochManagerLink.href = createExplorerLink('address', epochManagerAddress);
    }
}

// Display pipeline steps
function displayPipelineSteps(epochData) {
    if (!epochData || !epochData.events) {
        // If no events, mark all steps as pending
        updatePipelineStepStatus(1, false);
        updatePipelineStepStatus(2, false);
        updatePipelineStepStatus(3, false);
        updatePipelineStepStatus(4, false);
        return;
    }

    const events = epochData.events;
    const currentEpochId = epochData.epochId;

    // CRITICAL FIX: Validate that events belong to the current epoch
    // This prevents showing events from previous epochs when a new epoch starts
    const validateEventEpoch = (event) => {
        // If no epochId in event, reject it (don't assume valid - be strict)
        if (!event || event.epochId === undefined || event.epochId === null) {
            console.warn('[Pipeline] Event missing epochId, rejecting:', event);
            return false;
        }
        // Ensure currentEpochId is valid
        if (!currentEpochId || currentEpochId <= 0) {
            console.warn('[Pipeline] Invalid currentEpochId:', currentEpochId);
            return false;
        }
        // Normalize both to numbers for comparison
        const eventEpochId = typeof event.epochId === 'string' ? parseInt(event.epochId, 10) : Number(event.epochId);
        const normalizedCurrentEpochId = typeof currentEpochId === 'string' ? parseInt(currentEpochId, 10) : Number(currentEpochId);
        
        const isValid = eventEpochId === normalizedCurrentEpochId;
        if (!isValid) {
            console.log(`[Pipeline] Event epoch ${eventEpochId} doesn't match current epoch ${normalizedCurrentEpochId}, filtering out`);
        }
        return isValid;
    };

    // Step 1: Start Epoch - Update status and details
    // Filter events to only include those for the current epoch
    const epochStartedEvents = (events.epochStarted || []).filter(validateEventEpoch);
    const step1Completed = epochStartedEvents.length > 0;
    updatePipelineStepStatus(1, step1Completed);
    const step1 = document.getElementById('step-1-details');
    if (step1 && step1Completed) {
        const event = epochStartedEvents[0];
        step1.innerHTML = `
            <div>Block: ${event.blockNumber}</div>
            <div>Hash: ${formatHash(event.modelHash)}</div>
            <a href="${createExplorerLink('tx', event.transactionHash)}" target="_blank" class="explorer-link" style="font-size: 0.75rem;">View TX →</a>
        `;
    } else if (step1 && !step1Completed) {
        step1.innerHTML = '<div style="color: var(--text-secondary);">Waiting for epoch to start...</div>';
    }

    // Step 2: Submit Update - Update status and details
    // CRITICAL FIX: Only mark as completed if there are updates for THIS epoch
    const updatesSubmittedEvents = (events.updatesSubmitted || []).filter(validateEventEpoch);
    const step2Completed = updatesSubmittedEvents.length > 0;
    updatePipelineStepStatus(2, step2Completed);
    const step2 = document.getElementById('step-2-details');
    if (step2 && step2Completed) {
        const event = updatesSubmittedEvents[0];
        const updateCount = updatesSubmittedEvents.length;
        step2.innerHTML = `
            <div>Block: ${event.blockNumber}</div>
            <div>Updates: ${updateCount} submitted</div>
            <div>CID: ${event.updateCid}</div>
            <a href="${createExplorerLink('tx', event.transactionHash)}" target="_blank" class="explorer-link" style="font-size: 0.75rem;">View TX →</a>
        `;
    } else if (step2 && !step2Completed) {
        step2.innerHTML = '<div style="color: var(--text-secondary);">Waiting for client updates...</div>';
    }

    // Step 3: Compute Scores - Update status and details
    const scoresPostedEvents = (events.scoresPosted || []).filter(validateEventEpoch);
    const step3Completed = scoresPostedEvents.length > 0;
    updatePipelineStepStatus(3, step3Completed);
    const step3 = document.getElementById('step-3-details');
    if (step3 && step3Completed) {
        const event = scoresPostedEvents[0];
        step3.innerHTML = `
            <div>Block: ${event.blockNumber}</div>
            <div>Root: ${formatHash(event.scoresRoot)}</div>
            <a href="${createExplorerLink('tx', event.transactionHash)}" target="_blank" class="explorer-link" style="font-size: 0.75rem;">View TX →</a>
        `;
    } else if (step3 && !step3Completed) {
        step3.innerHTML = '<div style="color: var(--text-secondary);">Waiting for scores computation...</div>';
    }

    // Step 4: Publish Model - Update status and details
    const modelPublishedEvents = (events.modelPublished || []).filter(validateEventEpoch);
    const step4Completed = modelPublishedEvents.length > 0;
    updatePipelineStepStatus(4, step4Completed);
    const step4 = document.getElementById('step-4-details');
    if (step4 && step4Completed) {
        const event = modelPublishedEvents[0];
        step4.innerHTML = `
            <div>Block: ${event.blockNumber}</div>
            <div>CID: ${event.globalModelCid}</div>
            <a href="${createExplorerLink('tx', event.transactionHash)}" target="_blank" class="explorer-link" style="font-size: 0.75rem;">View TX →</a>
        `;
    } else if (step4 && !step4Completed) {
        step4.innerHTML = '<div style="color: var(--text-secondary);">Waiting for model publication...</div>';
    }
}

// Update pipeline step visual status (completed/pending)
function updatePipelineStepStatus(stepNumber, completed) {
    const stepElement = document.querySelector(`.pipeline-step[data-step="${stepNumber}"]`);
    if (!stepElement) return;

    if (completed) {
        stepElement.classList.add('completed');
        stepElement.classList.remove('pending');
    } else {
        stepElement.classList.remove('completed');
        stepElement.classList.add('pending');
    }
}

// Fetch gas cost for a transaction (via backend API) with retry logic
async function fetchGasCost(txHash, retries = 3) {
    // Skip if txHash is invalid, empty, or is a demo mode fake hash
    // Demo mode uses fake hashes like 0x0000..., 0x3333..., or 0x0001... (padded)
    if (!txHash || txHash === '0x' || txHash.length < 10) {
        return null;
    }
    
    // Check if this is a demo mode fake transaction hash
    // Demo hashes patterns:
    // - All zeros: 0x0000...0000
    // - All same character: 0x3333...3333
    // - Padded with zeros: 0x0000...0001 (starts with many zeros)
    const hashWithoutPrefix = txHash.slice(2);
    
    // Check if all zeros
    if (hashWithoutPrefix === '0'.repeat(64)) {
        return null; // Demo hash - skip
    }
    
    // Check if all same character (like 0x3333...)
    const firstChar = hashWithoutPrefix[0];
    if (hashWithoutPrefix === firstChar.repeat(64)) {
        return null; // Demo hash - skip
    }
    
    // Check if mostly zeros (padded pattern like 0x0000...0001)
    // If first 60 characters are zeros, it's likely a demo hash
    if (hashWithoutPrefix.slice(0, 60) === '0'.repeat(60)) {
        return null; // Demo hash - skip
    }
    
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(`${API_BASE}/api/transaction/receipt`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ txHash }),
                cache: 'no-cache'
            });

            if (!response.ok) {
                if (response.status === 404) {
                    // Transaction not found (likely demo mode or invalid hash) - don't retry, don't log
                    return null;
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            if (data.gasUsed) {
                return {
                    gasUsed: parseInt(data.gasUsed),
                    tokenCostWei: data.tokenCostWei ? BigInt(data.tokenCostWei) : null
                };
            }
            return null;
        } catch (error) {
            // Only log errors that aren't 404s (which are expected for demo mode)
            if (error.message && !error.message.includes('404')) {
                console.error(`Error fetching gas for ${txHash} (attempt ${i + 1}/${retries}):`, error);
            }
            if (i === retries - 1) {
                return null;
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    return null;
}

// Format gas cost
function formatGas(gas) {
    if (!gas) return 'N/A';
    if (gas >= 1000000) {
        return `${(gas / 1000000).toFixed(2)}M`;
    } else if (gas >= 1000) {
        return `${(gas / 1000).toFixed(2)}K`;
    }
    return gas.toLocaleString();
}

// Format token cost (from wei to 0G tokens)
function formatTokenCost(wei) {
    if (!wei) return 'N/A';
    // Convert wei to 0G (1 0G = 10^18 wei)
    // Handle BigInt properly
    const weiBigInt = typeof wei === 'bigint' ? wei : BigInt(wei);
    const divisor = BigInt(1e18);
    const tokens = Number(weiBigInt) / Number(divisor);
    
    // Always show in 0G format with appropriate decimal places
    if (tokens >= 1) {
        return `${tokens.toFixed(6)} 0G`;
    } else if (tokens >= 0.001) {
        return `${tokens.toFixed(7)} 0G`;
    } else if (tokens >= 0.000001) {
        return `${tokens.toFixed(9)} 0G`;
    } else {
        return `${tokens.toFixed(12)} 0G`;
    }
}

// Calculate time between blocks (assuming ~2s per block on 0G Mainnet)
function calculateTimeBetweenBlocks(block1, block2, blockTimeSeconds = 2) {
    const blockDiff = Math.abs(block2 - block1);
    const seconds = blockDiff * blockTimeSeconds;
    
    if (seconds < 60) {
        return `${seconds}s`;
    } else if (seconds < 3600) {
        return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }
}

// Display transaction history
async function displayTransactions(epochData) {
    if (!epochData || !epochData.events) return;

    const transactionsList = document.getElementById('transactions-list');
    if (!transactionsList) return;

    const transactions = [];

    // Collect all transactions
    if (epochData.events.epochStarted && epochData.events.epochStarted.length > 0) {
        epochData.events.epochStarted.forEach(event => {
            transactions.push({
                type: 'Start Epoch',
                hash: event.transactionHash,
                block: event.blockNumber,
                icon: '1',
                details: `Model Hash: ${formatHash(event.modelHash)}`,
                timestamp: epochData.timestamp
            });
        });
    }

    if (epochData.events.updatesSubmitted && epochData.events.updatesSubmitted.length > 0) {
        epochData.events.updatesSubmitted.forEach(event => {
            transactions.push({
                type: 'Submit Update',
                hash: event.transactionHash,
                block: event.blockNumber,
                icon: '2',
                details: `CID: ${event.updateCid} | Submitter: ${formatAddress(event.submitter)}`
            });
        });
    }

    if (epochData.events.scoresPosted && epochData.events.scoresPosted.length > 0) {
        epochData.events.scoresPosted.forEach(event => {
            transactions.push({
                type: 'Post Scores',
                hash: event.transactionHash,
                block: event.blockNumber,
                icon: '3',
                details: `Scores Root: ${formatHash(event.scoresRoot)}`
            });
        });
    }

    if (epochData.events.modelPublished && epochData.events.modelPublished.length > 0) {
        epochData.events.modelPublished.forEach(event => {
            transactions.push({
                type: 'Publish Model',
                hash: event.transactionHash,
                block: event.blockNumber,
                icon: '4',
                details: `Global Model CID: ${event.globalModelCid}`
            });
        });
    }

    // Sort by block number
    transactions.sort((a, b) => a.block - b.block);

    // Fetch gas costs for all transactions
    const gasPromises = transactions.map(tx => fetchGasCost(tx.hash));
    const gasData = await Promise.all(gasPromises);

    // Display transactions with gas costs
    transactionsList.innerHTML = transactions.map((tx, index) => {
        const gasInfo = gasData[index];
        const gasDisplay = gasInfo?.gasUsed ? formatGas(gasInfo.gasUsed) : 'Loading...';
        const tokenCostDisplay = gasInfo?.tokenCostWei ? formatTokenCost(gasInfo.tokenCostWei) : 'Loading...';
        
        return `
        <div class="transaction-item">
            <div class="transaction-icon">${tx.icon}</div>
            <div class="transaction-details">
                <div class="transaction-type">${tx.type}</div>
                <div class="transaction-hash">${tx.hash}</div>
                <div class="transaction-meta">${tx.details}</div>
                <div class="transaction-gas">Gas: ${gasDisplay} | Cost: ${tokenCostDisplay}</div>
            </div>
            <a href="${createExplorerLink('tx', tx.hash)}" target="_blank" class="transaction-link">
                View on Explorer →
            </a>
        </div>
        `;
    }).join('');

    // Update statistics with gas and token cost data
    updateStatisticsFromGasData(transactions, gasData);
}

// Update statistics from gas data
function updateStatisticsFromGasData(transactions, gasData) {
    const totalGas = gasData.reduce((sum, info) => sum + (info?.gasUsed || 0), 0);
    const totalTokenCost = gasData.reduce((sum, info) => {
        if (info?.tokenCostWei) {
            return sum + (typeof info.tokenCostWei === 'bigint' ? info.tokenCostWei : BigInt(info.tokenCostWei));
        }
        return sum;
    }, 0n);
    const avgGas = gasData.filter(g => g?.gasUsed).length > 0 
        ? Math.round(totalGas / gasData.filter(g => g?.gasUsed).length) 
        : 0;

    // Update statistics
    const totalGasEl = document.getElementById('stat-total-gas');
    if (totalGasEl) {
        totalGasEl.textContent = formatGas(totalGas);
    }

    const totalTokenCostEl = document.getElementById('stat-total-token-cost');
    if (totalTokenCostEl) {
        totalTokenCostEl.textContent = formatTokenCost(totalTokenCost);
    }

    const avgGasEl = document.getElementById('stat-avg-gas');
    if (avgGasEl) {
        avgGasEl.textContent = formatGas(avgGas);
    }
}

// Display epoch summary
function displayEpochSummary(epochData) {
    if (!epochData) return;

    // Handle both old format (epochData.epochInfo) and new format (direct properties)
    const epochInfo = epochData.epochInfo || epochData;

    const modelHash = document.getElementById('model-hash');
    const scoresRoot = document.getElementById('scores-root');
    const globalModelCid = document.getElementById('global-model-cid');
    const globalModelHash = document.getElementById('global-model-hash');

    if (modelHash) modelHash.textContent = epochInfo.modelHash ? formatHash(epochInfo.modelHash) : 'N/A';
    if (scoresRoot) scoresRoot.textContent = epochInfo.scoresRoot ? formatHash(epochInfo.scoresRoot) : 'Not set';
    if (globalModelCid) globalModelCid.textContent = epochInfo.globalModelCid || 'Not published';
    if (globalModelHash) globalModelHash.textContent = epochInfo.globalModelHash ? formatHash(epochInfo.globalModelHash) : 'Not published';
    
    // Update full hashes
    const fullModelHash = document.getElementById('full-model-hash');
    const fullScoresRoot = document.getElementById('full-scores-root');
    const fullGlobalModelCid = document.getElementById('full-global-model-cid');
    const fullGlobalModelHash = document.getElementById('full-global-model-hash');
    
    if (fullModelHash) fullModelHash.textContent = epochInfo.modelHash || 'N/A';
    if (fullScoresRoot) fullScoresRoot.textContent = epochInfo.scoresRoot || 'Not set';
    if (fullGlobalModelCid) fullGlobalModelCid.textContent = epochInfo.globalModelCid || 'Not published';
    if (fullGlobalModelHash) fullGlobalModelHash.textContent = epochInfo.globalModelHash || 'Not published';
    
    // Update status (Published/In Progress) based on actual state
    const statusEl = document.getElementById('epoch-status');
    if (statusEl) {
        const isPublished = epochInfo.published === true || 
                           epochInfo.published === 'true' || 
                           epochInfo.published === 1 ||
                           (epochData.events && epochData.events.modelPublished && epochData.events.modelPublished.length > 0) ||
                           (epochInfo.globalModelCid && epochInfo.scoresRoot);
        
        if (isPublished) {
            statusEl.textContent = 'Published';
            statusEl.className = 'summary-value status-published';
        } else {
            statusEl.textContent = 'In Progress';
            statusEl.className = 'summary-value status-active';
        }
    }
}

// Update epoch ID in UI
function updateEpochId(epochId) {
    const currentEpochId = document.getElementById('current-epoch-id');
    const progressEpochId = document.getElementById('progress-epoch-id');
    const summaryEpochId = document.getElementById('summary-epoch-id');
    
    if (currentEpochId) currentEpochId.textContent = epochId;
    if (progressEpochId) progressEpochId.textContent = epochId;
    if (summaryEpochId) summaryEpochId.textContent = epochId;
}

// Update last updated timestamp
function updateLastUpdated() {
    const lastUpdated = document.getElementById('last-updated');
    if (lastUpdated) {
        lastUpdated.textContent = formatDate(new Date().toISOString());
    }
}

// Toggle step details
function toggleStepDetails(stepNumber) {
    const stepDetails = document.getElementById(`step-${stepNumber}-details`);
    if (stepDetails) {
        stepDetails.classList.toggle('expanded');
        const button = stepDetails.previousElementSibling;
        if (button && button.classList.contains('step-toggle')) {
            button.textContent = stepDetails.classList.contains('expanded') ? 'Hide Details' : 'View Details';
        }
    }
}

// Toggle expandable cards
function toggleExpandable(card) {
    card.classList.toggle('expanded');
}

// Fetch network health (via backend API) with retry logic
async function fetchNetworkHealth(retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(`${API_BASE}/api/network/health`, {
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const currentBlock = parseInt(data.blockNumber);

            // Update current block
            const currentBlockEl = document.getElementById('current-block');
            if (currentBlockEl) {
                currentBlockEl.textContent = currentBlock.toLocaleString();
            }

            // Update block time
            const blockTimeEl = document.getElementById('block-time-value');
            if (blockTimeEl) {
                blockTimeEl.textContent = data.blockTime || '~2s (estimated)';
            }

            // Update network health
            const networkHealthEl = document.getElementById('network-health');
            if (networkHealthEl) {
                networkHealthEl.textContent = data.status === 'healthy' ? 'Healthy' : 'Unknown';
                networkHealthEl.className = data.status === 'healthy' ? 'info-value status-success' : 'info-value';
            }

            return currentBlock;
        } catch (error) {
            console.error(`Error fetching network health (attempt ${i + 1}/${retries}):`, error);
            if (i === retries - 1) {
                const networkHealthEl = document.getElementById('network-health');
                if (networkHealthEl) {
                    networkHealthEl.textContent = 'Error';
                    networkHealthEl.className = 'info-value';
                }
                return null;
            }
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    return null;
}

// Calculate statistics
function calculateStatistics(epochData) {
    if (!epochData || !epochData.events) return;

    const events = epochData.events;
    let totalTx = 0;

    if (events.epochStarted) totalTx += events.epochStarted.length;
    if (events.updatesSubmitted) totalTx += events.updatesSubmitted.length;
    if (events.scoresPosted) totalTx += events.scoresPosted.length;
    if (events.modelPublished) totalTx += events.modelPublished.length;

    // Update statistics
    const totalTxEl = document.getElementById('stat-total-tx');
    if (totalTxEl) {
        totalTxEl.textContent = totalTx;
    }

    const successRateEl = document.getElementById('stat-success-rate');
    if (successRateEl) {
        successRateEl.textContent = '100%';
    }

    const epochsEl = document.getElementById('stat-epochs');
    if (epochsEl) {
        epochsEl.textContent = epochData.epochId || 1;
    }

    const networkStatusEl = document.getElementById('stat-network-status');
    if (networkStatusEl) {
        networkStatusEl.textContent = 'Active';
    }
}

// Animate pipeline steps
function animatePipelineSteps() {
    const steps = document.querySelectorAll('.pipeline-step.animated');
    steps.forEach((step, index) => {
        step.style.setProperty('--step-index', index);
        step.style.animationDelay = `${index * 0.15}s`;
    });
}

// Update epoch progress
function updateEpochProgress(epochData) {
    if (!epochData) return;

    // Handle both old format (epochData.epochInfo) and new format (direct properties)
    const epochInfo = epochData.epochInfo || epochData;

    const progressFill = document.getElementById('epoch-progress-fill');
    const progressText = document.getElementById('epoch-progress-text');

    // Calculate progress based on completed steps (always use step-based calculation)
    let progress = 0;
    let completedSteps = 0;
    const totalSteps = 4;
    
    // CRITICAL FIX: Validate events belong to current epoch before counting them
    const currentEpochId = epochData.epochId;
    const validateEventEpoch = (event) => {
        // If no epochId in event, reject it (don't assume valid - be strict)
        if (!event || event.epochId === undefined || event.epochId === null) {
            return false;
        }
        // Ensure currentEpochId is valid
        if (!currentEpochId || currentEpochId <= 0) {
            return false;
        }
        // Normalize both to numbers for comparison
        const eventEpochId = typeof event.epochId === 'string' ? parseInt(event.epochId, 10) : Number(event.epochId);
        const normalizedCurrentEpochId = typeof currentEpochId === 'string' ? parseInt(currentEpochId, 10) : Number(currentEpochId);
        return eventEpochId === normalizedCurrentEpochId;
    };
    
    if (epochData.events) {
        // Step 1: Epoch Started
        const epochStartedEvents = (epochData.events.epochStarted || []).filter(validateEventEpoch);
        if (epochStartedEvents.length > 0) {
            progress += 25;
            completedSteps++;
        }
        
        // Step 2: Updates Submitted - CRITICAL: Only count updates for THIS epoch
        const updatesSubmittedEvents = (epochData.events.updatesSubmitted || []).filter(validateEventEpoch);
        if (updatesSubmittedEvents.length > 0) {
            progress += 25;
            completedSteps++;
        }
        
        // Step 3: Scores Posted
        const scoresPostedEvents = (epochData.events.scoresPosted || []).filter(validateEventEpoch);
        if (scoresPostedEvents.length > 0) {
            progress += 25;
            completedSteps++;
        }
        
        // Step 4: Model Published
        const modelPublishedEvents = (epochData.events.modelPublished || []).filter(validateEventEpoch);
        if (modelPublishedEvents.length > 0) {
            progress += 25;
            completedSteps++;
        }
    }
    
    // Only show 100% if ALL steps are completed
    const isComplete = completedSteps === totalSteps;
    
    if (progressFill) {
        progressFill.style.width = `${progress}%`;
    }
    if (progressText) {
        progressText.textContent = isComplete ? '100% Complete' : 'In Progress';
    }
}

// Update full hashes in expandable content
function updateFullHashes(epochData) {
    if (!epochData) return;

    // Handle both old format (epochData.epochInfo) and new format (direct properties)
    const epochInfo = epochData.epochInfo || epochData;

    const fullModelHash = document.getElementById('full-model-hash');
    if (fullModelHash) {
        fullModelHash.textContent = epochInfo.modelHash || 'N/A';
    }

    const fullScoresRoot = document.getElementById('full-scores-root');
    if (fullScoresRoot) {
        fullScoresRoot.textContent = epochInfo.scoresRoot || 'Not set';
    }

    const fullGlobalModelCid = document.getElementById('full-global-model-cid');
    if (fullGlobalModelCid) {
        fullGlobalModelCid.textContent = epochInfo.globalModelCid || 'Not published';
    }

    const fullGlobalModelHash = document.getElementById('full-global-model-hash');
    if (fullGlobalModelHash) {
        fullGlobalModelHash.textContent = epochInfo.globalModelHash || 'Not published';
    }
}

// Track last known epoch to detect new epochs
let lastKnownEpochId = null;

// REASON 11 FIX: Listen for training start events and immediately refresh
if (typeof window !== 'undefined') {
    window.addEventListener('trainingStarted', async (event) => {
        const epochId = event.detail?.epochId;
        console.log(`[Fix] ✅ Received trainingStarted event for epoch ${epochId} - forcing immediate refresh`);
        
        // REASON 2 FIX: Reset lastKnownEpochId to force detection
        lastKnownEpochId = null;
        
        // REASON 5 FIX: Force immediate refresh without waiting for monitoring
        if (typeof refreshDashboard === 'function') {
            try {
                await refreshDashboard(true);
                console.log(`[Fix] ✅ Dashboard refreshed immediately after training start event`);
            } catch (error) {
                console.error('[Fix] ❌ Error refreshing dashboard after training start:', error);
            }
        }
    });
    
    // Expose lastKnownEpochId to window for training.js to reset it
    Object.defineProperty(window, 'lastKnownEpochId', {
        get: () => lastKnownEpochId,
        set: (value) => { 
            console.log(`[Fix] lastKnownEpochId reset from ${lastKnownEpochId} to ${value}`);
            lastKnownEpochId = value; 
        }
    });
}

// Initialize dashboard
async function initDashboard() {
    // Show loading state immediately
    const currentEpochIdEl = document.getElementById('current-epoch-id');
    if (currentEpochIdEl) {
        currentEpochIdEl.textContent = 'Loading...';
    }
    
    const data = await loadData();

    if (!data) {
        console.error('[Init] Failed to load data - API may be slow or unavailable');
        if (currentEpochIdEl) {
            currentEpochIdEl.textContent = 'Error';
        }
        showGlobalError(
            'Failed to load dashboard data',
            'The API may be slow or unavailable. Please check your connection and try refreshing the page.',
            'DASHBOARD_LOAD_FAILED'
        );
        return;
    }

    const { deployData, epochData } = data;

    // Update epoch ID in UI
    const currentEpochId = epochData.epochId || 1;
    updateEpochId(currentEpochId);
    
    // Track epoch ID
    lastKnownEpochId = currentEpochId;

    // Display all sections
    displayDeploymentInfo(deployData);
    displayPipelineSteps(epochData);
    await displayTransactions(epochData);
    displayEpochSummary(epochData);
    updateLastUpdated();

    // Calculate and display statistics
    calculateStatistics(epochData);

    // Fetch network health
    await fetchNetworkHealth();

    // Start real-time polling for network health
    startNetworkHealthPolling();

    // Animate pipeline steps
    animatePipelineSteps();

    // Update epoch progress
    updateEpochProgress(epochData);

    // Update full hashes
    updateFullHashes(epochData);

    // Check if training is active and start auto-refresh
    const trainingActive = await isTrainingActive();
    if (trainingActive) {
        console.log('Training is active - starting real-time updates');
        startAutoRefresh();
    }

    // Start continuous training status monitoring (checks every 2 seconds)
    startTrainingStatusMonitoring();

    // Smooth scroll on load
    window.scrollTo({ top: 0, behavior: 'smooth' });

    console.log('Dashboard initialized successfully');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initDashboard);

// Start real-time polling for network health (only if intervals are configured)
function startNetworkHealthPolling() {
    // Clear any existing intervals
    if (networkHealthInterval) {
        clearInterval(networkHealthInterval);
        networkHealthInterval = null;
    }
    if (blockNumberInterval) {
        clearInterval(blockNumberInterval);
        blockNumberInterval = null;
    }

    // Poll network health (only if interval is set)
    if (NETWORK_HEALTH_POLL_INTERVAL !== null && NETWORK_HEALTH_POLL_INTERVAL > 0) {
        networkHealthInterval = setInterval(async () => {
            await fetchNetworkHealth(1); // Single retry for polling
        }, NETWORK_HEALTH_POLL_INTERVAL);
    }

    // Poll block number (only if interval is set)
    if (BLOCK_NUMBER_POLL_INTERVAL !== null && BLOCK_NUMBER_POLL_INTERVAL > 0) {
        blockNumberInterval = setInterval(async () => {
            try {
                const response = await fetch(`${API_BASE}/api/network/blockNumber`, { cache: 'no-cache' });
                if (response.ok) {
                    const data = await response.json();
                    const currentBlock = parseInt(data.blockNumber);
                    const currentBlockEl = document.getElementById('current-block');
                    if (currentBlockEl) {
                        currentBlockEl.textContent = currentBlock.toLocaleString();
                    }
                }
            } catch (error) {
                console.error('Error fetching block number:', error);
            }
        }, BLOCK_NUMBER_POLL_INTERVAL);
    }
}

// Stop real-time polling
function stopNetworkHealthPolling() {
    if (networkHealthInterval) {
        clearInterval(networkHealthInterval);
        networkHealthInterval = null;
    }
    if (blockNumberInterval) {
        clearInterval(blockNumberInterval);
        blockNumberInterval = null;
    }
    if (dashboardAutoRefreshInterval) {
        clearInterval(dashboardAutoRefreshInterval);
        dashboardAutoRefreshInterval = null;
    }
    stopTrainingStatusMonitoring();
}

// Track training state
let trainingActiveState = false;

// Check if training is active
async function isTrainingActive() {
    try {
        const response = await fetch(`${API_BASE}/api/training/status`, { cache: 'no-cache' });
        if (!response.ok) return false;
        const data = await response.json();
        const isActive = data.status === 'active';
        return isActive;
    } catch (error) {
        console.error('Error checking training status:', error);
        return false;
    }
}

// Start continuous monitoring of training status
function startTrainingStatusMonitoring() {
    // Clear any existing monitor
    if (trainingStatusMonitorInterval) {
        clearInterval(trainingStatusMonitorInterval);
    }
    
    // Track consecutive timeouts at function scope
    let consecutiveTimeouts = 0;
    
    // Check training status and latest epoch every 2 seconds
    trainingStatusMonitorInterval = setInterval(async () => {
        try {
            const isActive = await isTrainingActive();
        
        // REASON 5 FIX: Always check for new epochs, even if training is inactive
        // REASON 4 FIX: Reduced timeout to 8 seconds (was 15) for faster failure detection
        // REASON 9 FIX: Add retry logic for network failures
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout (reduced from 15)
            
            let response;
            let retryCount = 0;
            const maxRetries = 2;
            
            // REASON 9 FIX: Retry logic for network issues
            while (retryCount <= maxRetries) {
                try {
                    response = await fetch(`${API_BASE}/api/epoch/latest?t=${Date.now()}`, { 
                        cache: 'no-cache',
                        signal: controller.signal,
                        headers: {
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache'
                        }
                    });
                    break; // Success, exit retry loop
                } catch (fetchError) {
                    retryCount++;
                    if (retryCount > maxRetries) {
                        throw fetchError;
                    }
                    console.warn(`[Monitor] Fetch failed (attempt ${retryCount}/${maxRetries + 1}), retrying...`);
                    await new Promise(resolve => setTimeout(resolve, 500 * retryCount)); // Exponential backoff
                }
            }
            
            clearTimeout(timeoutId);
            
            if (response && response.ok) {
                consecutiveTimeouts = 0; // Reset timeout counter on success
                const epochData = await response.json();
                const currentEpochId = epochData.epochId || 1;
                
                // REASON 2 FIX: Always update if epoch changed, even if lastKnownEpochId is null
                // REASON 8 FIX: Better error handling - don't silently skip updates
                if (lastKnownEpochId === null) {
                    console.log(`[Monitor] Initial epoch detected: ${currentEpochId}`);
                    lastKnownEpochId = currentEpochId;
                    // Force refresh on initial detection
                    await refreshDashboard(true);
                } else if (currentEpochId > lastKnownEpochId) {
                    console.log(`🔄 Monitor detected new epoch: ${currentEpochId} (was ${lastKnownEpochId})`);
                    lastKnownEpochId = currentEpochId;
                    await refreshDashboard(true);
                } else if (currentEpochId !== lastKnownEpochId) {
                    // Epoch changed (could be lower or higher) - update it
                    console.log(`🔄 Monitor: Epoch changed from ${lastKnownEpochId} to ${currentEpochId}`);
                    lastKnownEpochId = currentEpochId;
                    await refreshDashboard(true);
                }
            } else if (response) {
                console.warn(`[Monitor] API returned ${response.status}, epoch check skipped this cycle`);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                consecutiveTimeouts++;
                // REASON 4 FIX: Log timeout more frequently to help debug
                if (!window._timeoutErrorCount) window._timeoutErrorCount = 0;
                window._timeoutErrorCount++;
                if (window._timeoutErrorCount % 5 === 0) { // Log every 5 timeouts (was 10)
                    console.warn(`[Monitor] Epoch check timed out (${window._timeoutErrorCount} times). This is normal if blockchain queries are slow. Will continue retrying.`);
                }
            } else {
                consecutiveTimeouts = 0; // Reset on non-timeout errors
                console.error('[Monitor] Error checking latest epoch:', error.message);
            }
            // REASON 10 FIX: Don't break monitoring on error - continue checking
        }
        
            // If training just became active and we're not already polling, start auto-refresh
            if (isActive && !trainingActiveState && !dashboardAutoRefreshInterval) {
                console.log('Training detected as active - starting real-time updates');
                trainingActiveState = true;
                startAutoRefresh();
                // Speed up monitoring to 1 second for step-by-step video recording
                clearInterval(trainingStatusMonitorInterval);
                trainingStatusMonitorInterval = setInterval(arguments.callee, 1000);
            } else if (!isActive && trainingActiveState) {
                // Training just became inactive
                trainingActiveState = false;
                console.log('Training became inactive');
                // Slow down monitoring back to 2 seconds
                clearInterval(trainingStatusMonitorInterval);
                trainingStatusMonitorInterval = setInterval(arguments.callee, 2000);
            }
        } catch (error) {
            console.error('[Monitor] Error in monitoring cycle:', error);
            // Continue monitoring even if one cycle fails
        }
    }, 2000); // Check every 2 seconds
    
    console.log('Training status monitoring started (checks for new epochs continuously)');
}

// Stop training status monitoring
function stopTrainingStatusMonitoring() {
    if (trainingStatusMonitorInterval) {
        clearInterval(trainingStatusMonitorInterval);
        trainingStatusMonitorInterval = null;
    }
}

// Start auto-refresh with intelligent polling
function startAutoRefresh() {
    // Clear any existing auto-refresh
    if (dashboardAutoRefreshInterval) {
        clearInterval(dashboardAutoRefreshInterval);
    }
    
    let isActive = false;
    let completedAt = null;
    const ACTIVE_POLL_INTERVAL = 1000; // 1 second during active training
    const POST_COMPLETION_POLL_INTERVAL = 1000; // 1 second for 1 minute after completion
    const POST_COMPLETION_DURATION = 60 * 1000; // 1 minute after completion
    
    // Refresh function
    const refresh = async () => {
        // Check training status
        const trainingActive = await isTrainingActive();
        const progressText = document.getElementById('epoch-progress-text');
        const isCompleted = progressText && progressText.textContent.includes('100% Complete');
        
        // Refresh dashboard (silent mode to avoid button flicker)
        await refreshDashboard(true);
        
        // Track state changes
        if (trainingActive && !isActive) {
            // Training just became active
            isActive = true;
            completedAt = null;
            console.log('✅ Training active - real-time updates at 1-second intervals');
        } else if (!trainingActive && isActive) {
            // Training just became inactive
            isActive = false;
            if (isCompleted) {
                completedAt = Date.now();
                console.log('✅ Training completed - continuing updates for 1 minute');
            }
        }
        
        // Stop conditions
        if (isCompleted && completedAt) {
            // If completed and 1 minute has passed, stop
            if (Date.now() >= completedAt + POST_COMPLETION_DURATION) {
                clearInterval(dashboardAutoRefreshInterval);
                dashboardAutoRefreshInterval = null;
                console.log('⏹️ Auto-refresh stopped - 1 minute after completion');
                return;
            }
        } else if (!trainingActive && !isCompleted && !completedAt) {
            // Training inactive and not completed - stop polling
            clearInterval(dashboardAutoRefreshInterval);
            dashboardAutoRefreshInterval = null;
            console.log('⏹️ Auto-refresh stopped - training inactive');
            return;
        }
    };
    
    // Start with 1-second polling (training is likely active when this is called)
    dashboardAutoRefreshInterval = setInterval(refresh, ACTIVE_POLL_INTERVAL);
    console.log('Auto-refresh started - polling every 1 second during training');
    
    // Initial refresh
    refresh();
}

// Refresh dashboard data
// REASON 8 FIX: Enhanced error handling to prevent silent failures
async function refreshDashboard(silent = false) {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn && !silent) {
        refreshBtn.classList.add('loading');
        refreshBtn.disabled = true;
    }

    try {
        console.log(`[RefreshDashboard] Starting refresh (silent: ${silent})...`);
        const data = await loadData();
        if (!data) {
            console.error('[RefreshDashboard] ❌ Failed to refresh data - loadData returned null');
            if (refreshBtn && !silent) {
                refreshBtn.classList.remove('loading');
                refreshBtn.disabled = false;
            }
            // REASON 8 FIX: Don't silently fail - show error if not silent
            if (!silent && typeof showGlobalError === 'function') {
                showGlobalError(
                    'Failed to refresh dashboard data',
                    'The dashboard could not load the latest epoch data. Please try again.',
                    'REFRESH_FAILED'
                );
            }
            return;
        }

        const { deployData, epochData } = data;
        const currentEpochId = epochData.epochId || 1;

        // Always update to show the latest epoch, even if it's the same
        // This ensures we're always showing the most current data
        if (lastKnownEpochId === null) {
            // First load
            lastKnownEpochId = currentEpochId;
        } else if (currentEpochId !== lastKnownEpochId) {
            // Epoch changed - update immediately
            if (currentEpochId > lastKnownEpochId) {
                console.log(`🔄 New epoch detected: ${currentEpochId} (was ${lastKnownEpochId}) - switching immediately`);
            } else {
                console.log(`🔄 Epoch changed: ${currentEpochId} (was ${lastKnownEpochId})`);
            }
            lastKnownEpochId = currentEpochId;
            
            // Start auto-refresh if not already running and training is active
            if (!dashboardAutoRefreshInterval) {
                const trainingActive = await isTrainingActive();
                if (trainingActive) {
                    startAutoRefresh();
                }
            }
        }
        
        // Always update epoch ID in UI to ensure it's current
        // Only update if we have a valid epoch ID (not 0 or null)
        if (currentEpochId && currentEpochId > 0) {
            updateEpochId(currentEpochId);
        } else {
            console.error('[Refresh] Invalid epoch ID received:', currentEpochId);
            // Don't update UI with invalid data - keep showing last known epoch
        }

        // Update sections that might have changed
        displayDeploymentInfo(deployData);
        displayPipelineSteps(epochData); // Always update pipeline steps to show real-time progress
        await displayTransactions(epochData);
        displayEpochSummary(epochData);
        
        console.log(`[RefreshDashboard] ✅ Successfully refreshed - epoch ${currentEpochId}`);
        updateLastUpdated();
        calculateStatistics(epochData);
        updateEpochProgress(epochData); // Update progress bar
        updateFullHashes(epochData);
        
        // Also refresh network health (but less frequently to avoid overload)
        // Only refresh network health every 10 seconds
        const now = Date.now();
        if (!window.lastNetworkHealthCheck || (now - window.lastNetworkHealthCheck) > 10000) {
            await fetchNetworkHealth();
            window.lastNetworkHealthCheck = now;
        }
    } catch (error) {
        // REASON 8 FIX: Enhanced error handling - don't silently fail
        console.error('[RefreshDashboard] ❌ Error refreshing dashboard:', error);
        console.error('[RefreshDashboard] Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        // Show error to user if not silent
        if (!silent && typeof showGlobalError === 'function') {
            showGlobalError(
                'Failed to refresh dashboard',
                error.message || 'An unexpected error occurred while refreshing the dashboard.',
                'REFRESH_ERROR'
            );
        }
    } finally {
        if (refreshBtn && !silent) {
            refreshBtn.classList.remove('loading');
            refreshBtn.disabled = false;
        }
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopNetworkHealthPolling();
});

// Make functions globally available for onclick handlers
window.toggleStepDetails = toggleStepDetails;
window.toggleExpandable = toggleExpandable;
window.refreshDashboard = refreshDashboard;
window.startAutoRefresh = startAutoRefresh;
