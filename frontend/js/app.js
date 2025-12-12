// Configuration
const BLOCK_EXPLORER_BASE = 'https://chainscan.0g.ai';
const API_BASE = window.location.origin; // Use same origin (works for both local and AWS)

// Polling intervals (in milliseconds)
// Set to null to disable auto-polling (only refresh manually)
// Recommended: 5-10 minutes for cost efficiency, or null for manual-only
const NETWORK_HEALTH_POLL_INTERVAL = null; // null = disabled, or set to milliseconds (e.g., 300000 for 5 minutes)
const BLOCK_NUMBER_POLL_INTERVAL = null; // null = disabled, or set to milliseconds (e.g., 300000 for 5 minutes)

let networkHealthInterval = null;
let blockNumberInterval = null;
let dashboardAutoRefreshInterval = null;
let autoRefreshEndTime = null; // Timestamp when auto-refresh should stop

// Load data from backend API with retry logic
async function loadData(retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const [deployData, epochData] = await Promise.all([
                fetch(`${API_BASE}/api/deployment`, { cache: 'no-cache' })
                    .then(r => {
                        if (!r.ok) throw new Error(`HTTP ${r.status}`);
                        return r.json();
                    }),
                fetch(`${API_BASE}/api/epoch/latest`, { cache: 'no-cache' })
                    .then(r => {
                        if (!r.ok) {
                            // Fallback to epoch 1 if latest fails
                            return fetch(`${API_BASE}/api/epoch/1`, { cache: 'no-cache' })
                                .then(r2 => {
                                    if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
                                    return r2.json();
                                });
                        }
                        return r.json();
                    })
            ]);

            return { deployData, epochData };
        } catch (error) {
            console.error(`Error loading data (attempt ${i + 1}/${retries}):`, error);
            if (i === retries - 1) {
                return null;
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
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
    if (!epochData || !epochData.events) return;

    const events = epochData.events;

    // Step 1: Start Epoch
    const step1 = document.getElementById('step-1-details');
    if (step1 && events.epochStarted && events.epochStarted.length > 0) {
        const event = events.epochStarted[0];
        step1.innerHTML = `
            <div>Block: ${event.blockNumber}</div>
            <div>Hash: ${formatHash(event.modelHash)}</div>
            <a href="${createExplorerLink('tx', event.transactionHash)}" target="_blank" class="explorer-link" style="font-size: 0.75rem;">View TX →</a>
        `;
    }

    // Step 2: Submit Update
    const step2 = document.getElementById('step-2-details');
    if (step2 && events.updatesSubmitted && events.updatesSubmitted.length > 0) {
        const event = events.updatesSubmitted[0];
        step2.innerHTML = `
            <div>Block: ${event.blockNumber}</div>
            <div>CID: ${event.updateCid}</div>
            <a href="${createExplorerLink('tx', event.transactionHash)}" target="_blank" class="explorer-link" style="font-size: 0.75rem;">View TX →</a>
        `;
    }

    // Step 3: Compute Scores
    const step3 = document.getElementById('step-3-details');
    if (step3 && events.scoresPosted && events.scoresPosted.length > 0) {
        const event = events.scoresPosted[0];
        step3.innerHTML = `
            <div>Block: ${event.blockNumber}</div>
            <div>Root: ${formatHash(event.scoresRoot)}</div>
            <a href="${createExplorerLink('tx', event.transactionHash)}" target="_blank" class="explorer-link" style="font-size: 0.75rem;">View TX →</a>
        `;
    }

    // Step 4: Publish Model
    const step4 = document.getElementById('step-4-details');
    if (step4 && events.modelPublished && events.modelPublished.length > 0) {
        const event = events.modelPublished[0];
        step4.innerHTML = `
            <div>Block: ${event.blockNumber}</div>
            <div>CID: ${event.globalModelCid}</div>
            <a href="${createExplorerLink('tx', event.transactionHash)}" target="_blank" class="explorer-link" style="font-size: 0.75rem;">View TX →</a>
        `;
    }
}

// Fetch gas cost for a transaction (via backend API) with retry logic
async function fetchGasCost(txHash, retries = 3) {
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
                    // Transaction not found - don't retry
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
            console.error(`Error fetching gas for ${txHash} (attempt ${i + 1}/${retries}):`, error);
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

    // Check if published (handle boolean true, string "true", BigNumber, or check for published events/model data)
    const hasPublishedEvents = epochData.events && epochData.events.modelPublished && epochData.events.modelPublished.length > 0;
    const hasGlobalModel = epochInfo.globalModelCid || epochInfo.globalModelHash;
    const publishedFlag = epochInfo.published === true || 
                          epochInfo.published === 'true' || 
                          epochInfo.published === 1 ||
                          String(epochInfo.published) === 'true';
    
    const isPublished = publishedFlag || hasPublishedEvents || (hasGlobalModel && epochInfo.scoresRoot);
    
    console.log('[Progress] Epoch published check:', {
        publishedFlag,
        hasPublishedEvents,
        hasGlobalModel,
        scoresRoot: !!epochInfo.scoresRoot,
        isPublished,
        publishedValue: epochInfo.published,
        publishedType: typeof epochInfo.published
    });

    if (isPublished) {
        if (progressFill) {
            progressFill.style.width = '100%';
        }
        if (progressText) {
            progressText.textContent = '100% Complete';
        }
    } else {
        // Epoch is active but not published yet
        // Calculate progress based on completed steps
        let progress = 0;
        if (epochData.events) {
            if (epochData.events.epochStarted && epochData.events.epochStarted.length > 0) progress += 25;
            if (epochData.events.updatesSubmitted && epochData.events.updatesSubmitted.length > 0) progress += 25;
            if (epochData.events.scoresPosted && epochData.events.scoresPosted.length > 0) progress += 25;
            if (epochData.events.modelPublished && epochData.events.modelPublished.length > 0) progress += 25;
        }
        
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
        if (progressText) {
            progressText.textContent = progress === 100 ? '100% Complete' : 'In Progress';
        }
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

// Initialize dashboard
async function initDashboard() {
    const data = await loadData();

    if (!data) {
        console.error('Failed to load data');
        return;
    }

    const { deployData, epochData } = data;

    // Update epoch ID in UI
    updateEpochId(epochData.epochId || 1);

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
}

// Start auto-refresh for 5 minutes after training starts
function startAutoRefresh() {
    // Clear any existing auto-refresh
    if (dashboardAutoRefreshInterval) {
        clearInterval(dashboardAutoRefreshInterval);
    }
    
    // Set end time to 5 minutes from now
    autoRefreshEndTime = Date.now() + (5 * 60 * 1000); // 5 minutes
    
    // Refresh every 10 seconds
    dashboardAutoRefreshInterval = setInterval(async () => {
        // Check if 5 minutes have passed
        if (Date.now() >= autoRefreshEndTime) {
            clearInterval(dashboardAutoRefreshInterval);
            dashboardAutoRefreshInterval = null;
            console.log('Auto-refresh stopped after 5 minutes');
            return;
        }
        
        // Refresh dashboard
        await refreshDashboard();
        
        // Check if progress is 100% (epoch published) - if so, stop auto-refresh
        const progressText = document.getElementById('epoch-progress-text');
        if (progressText && progressText.textContent.includes('100% Complete')) {
            clearInterval(dashboardAutoRefreshInterval);
            dashboardAutoRefreshInterval = null;
            console.log('Auto-refresh stopped - epoch completed (100% progress)');
            return;
        }
    }, 10000); // Every 10 seconds
    
    console.log('Auto-refresh started for 5 minutes');
}

// Refresh dashboard data
async function refreshDashboard() {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.classList.add('loading');
        refreshBtn.disabled = true;
    }

    try {
        const data = await loadData();
        if (!data) {
            console.error('Failed to refresh data');
            if (refreshBtn) {
                refreshBtn.classList.remove('loading');
                refreshBtn.disabled = false;
            }
            return;
        }

        const { deployData, epochData } = data;

        // Update epoch ID in UI
        updateEpochId(epochData.epochId || 1);

        // Update sections that might have changed
        displayDeploymentInfo(deployData);
        displayPipelineSteps(epochData);
        await displayTransactions(epochData);
        displayEpochSummary(epochData);
        updateLastUpdated();
        calculateStatistics(epochData);
        updateEpochProgress(epochData); // Update progress bar
        updateFullHashes(epochData);
        
        // Also refresh network health
        await fetchNetworkHealth();
    } catch (error) {
        console.error('Error refreshing dashboard:', error);
    } finally {
        if (refreshBtn) {
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
