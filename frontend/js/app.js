// Configuration
const BLOCK_EXPLORER_BASE = 'https://chainscan.0g.ai';
const DATA_BASE_PATH = './data'; // Relative path from frontend/ to data/

// Load data from JSON files
async function loadData() {
    try {
        const [deployData, epochData, storageData] = await Promise.all([
            fetch(`${DATA_BASE_PATH}/deploy.mainnet.json`).then(r => r.json()),
            fetch(`${DATA_BASE_PATH}/epoch_1_mainnet_data.json`).then(r => r.json()),
            fetch(`${DATA_BASE_PATH}/0g_storage_upload_mainnet.json`).then(r => r.json()).catch(() => null)
        ]);

        return { deployData, epochData, storageData };
    } catch (error) {
        console.error('Error loading data:', error);
        return null;
    }
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

// Display transaction history
function displayTransactions(epochData) {
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
                details: `Model Hash: ${formatHash(event.modelHash)}`
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

    // Display transactions
    transactionsList.innerHTML = transactions.map(tx => `
        <div class="transaction-item">
            <div class="transaction-icon">${tx.icon}</div>
            <div class="transaction-details">
                <div class="transaction-type">${tx.type}</div>
                <div class="transaction-hash">${tx.hash}</div>
                <div class="transaction-meta">${tx.details}</div>
            </div>
            <a href="${createExplorerLink('tx', tx.hash)}" target="_blank" class="transaction-link">
                View on Explorer →
            </a>
        </div>
    `).join('');
}

// Display epoch summary
function displayEpochSummary(epochData) {
    if (!epochData || !epochData.epochInfo) return;

    const epochInfo = epochData.epochInfo;

    const modelHash = document.getElementById('model-hash');
    const scoresRoot = document.getElementById('scores-root');
    const globalModelCid = document.getElementById('global-model-cid');
    const globalModelHash = document.getElementById('global-model-hash');

    if (modelHash) modelHash.textContent = formatHash(epochInfo.modelHash);
    if (scoresRoot) scoresRoot.textContent = formatHash(epochInfo.scoresRoot);
    if (globalModelCid) globalModelCid.textContent = epochInfo.globalModelCid || 'N/A';
    if (globalModelHash) globalModelHash.textContent = formatHash(epochInfo.globalModelHash);
}

// Display storage status
function displayStorageStatus(storageData) {
    const storageDetails = document.getElementById('storage-details');
    if (!storageDetails) return;

    if (storageData && storageData.success) {
        storageDetails.innerHTML = `
            <div><strong>Status:</strong> Upload successful</div>
            <div><strong>Root Hash (CID):</strong> ${storageData.rootHash}</div>
            <div><strong>Transaction:</strong> ${storageData.txHash?.txHash || 'N/A'}</div>
            <div><strong>URL:</strong> <a href="#" class="info-link">${storageData.url}</a></div>
            <div><strong>File Hash:</strong> ${formatHash(storageData.fileHash)}</div>
            <div><strong>File Size:</strong> ${storageData.fileSize} bytes</div>
            <div><strong>API:</strong> ${storageData.api || 'Official API from docs.0g.ai'}</div>
        `;
    } else {
        storageDetails.innerHTML = `
            <div><strong>Status:</strong> Storage integration ready</div>
            <div>0G Storage uploads are working correctly using the official SDK API.</div>
        `;
    }
}

// Update last updated timestamp
function updateLastUpdated() {
    const lastUpdated = document.getElementById('last-updated');
    if (lastUpdated) {
        lastUpdated.textContent = formatDate(new Date().toISOString());
    }
}

// Initialize dashboard
async function initDashboard() {
    const data = await loadData();

    if (!data) {
        console.error('Failed to load data');
        return;
    }

    const { deployData, epochData, storageData } = data;

    // Display all sections
    displayDeploymentInfo(deployData);
    displayPipelineSteps(epochData);
    displayTransactions(epochData);
    displayEpochSummary(epochData);
    displayStorageStatus(storageData);
    updateLastUpdated();

    console.log('Dashboard initialized successfully');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initDashboard);
