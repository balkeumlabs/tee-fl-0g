// Training Interface JavaScript
const API_BASE = window.location.origin;

// Global error display system (same as dashboard)
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

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Initialize charts if switching to metrics tab
        if (tabName === 'metrics') {
            initializeCharts();
        }
    });
});

// Modal functions (make them globally available)
window.openConfigModal = function() {
    document.getElementById('config-modal').classList.add('active');
};

window.closeConfigModal = function() {
    document.getElementById('config-modal').classList.remove('active');
};

// Close modal on overlay click
document.getElementById('config-modal').addEventListener('click', (e) => {
    if (e.target.id === 'config-modal') {
        closeConfigModal();
    }
});

// Check if demo mode is enabled
function isDemoModeEnabled() {
    const toggle = document.getElementById('demo-mode-toggle');
    return toggle ? toggle.checked : false;
}

// Update demo mode indicator
function updateDemoModeIndicator() {
    const indicator = document.getElementById('demo-mode-indicator');
    const isDemo = isDemoModeEnabled();
    if (indicator) {
        if (isDemo) {
            indicator.textContent = '(Testing without blockchain)';
            indicator.style.color = '#10b981';
        } else {
            indicator.textContent = '(Real blockchain training)';
            indicator.style.color = '#9333ea';
        }
    }
}

// Initialize demo mode toggle
document.addEventListener('DOMContentLoaded', async () => {
    const toggle = document.getElementById('demo-mode-toggle');
    if (toggle) {
        // Load current demo mode state from backend
        try {
            const response = await fetch(`${API_BASE}/api/training/demo-status`);
            if (response.ok) {
                const data = await response.json();
                toggle.checked = data.demoMode || false;
                updateDemoModeIndicator();
            }
        } catch (error) {
            console.warn('Could not load demo mode status:', error);
        }
        
        // Handle toggle changes - sync with backend
        toggle.addEventListener('change', async (e) => {
            const isEnabled = e.target.checked;
            updateDemoModeIndicator();
            
            // Sync with backend
            try {
                const endpoint = isEnabled ? '/api/training/enable-demo' : '/api/training/disable-demo';
                const response = await fetch(`${API_BASE}${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    console.log(`Demo mode ${isEnabled ? 'enabled' : 'disabled'}:`, data.message);
                    
                    // If dashboard is open, refresh it to show correct data
                    if (typeof window.refreshDashboard === 'function') {
                        setTimeout(() => {
                            window.refreshDashboard();
                        }, 500);
                    }
                } else {
                    console.error('Failed to sync demo mode with backend');
                    // Revert toggle if backend call failed
                    toggle.checked = !isEnabled;
                    updateDemoModeIndicator();
                }
            } catch (error) {
                console.error('Error syncing demo mode:', error);
                // Revert toggle if backend call failed
                toggle.checked = !isEnabled;
                updateDemoModeIndicator();
            }
        });
    }
});

// Form submission
document.getElementById('config-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳</span> <span>Starting...</span>';
    
    try {
        const formData = new FormData(e.target);
        const config = {
            numRounds: parseInt(formData.get('numRounds')),
            minClients: parseInt(formData.get('minClients')),
            localEpochs: parseInt(formData.get('localEpochs')),
            batchSize: parseInt(formData.get('batchSize')),
            learningRate: parseFloat(formData.get('learningRate')),
            model: formData.get('model')
        };
        
        // Check if demo mode is enabled
        const isDemo = isDemoModeEnabled();
        const apiEndpoint = isDemo ? '/api/training/start-demo' : '/api/training/start';
        
        // Close modal immediately - don't wait for response (training happens in background)
        closeConfigModal();
        updateTrainingStatus('active', null); // Don't use numRounds - backend returns null for totalRounds
        
        // Show mode indicator in status message
        const statusMessage = document.getElementById('status-message');
        if (statusMessage) {
            statusMessage.textContent = isDemo 
                ? 'Starting demo training (simulating pipeline...)' 
                : 'Starting training on blockchain...';
        }
        
        // Send to backend API (fire and forget - don't block UI)
        fetch(`${API_BASE}${apiEndpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        }).then(async (response) => {
            // Check if response is actually JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Non-JSON response received:', text.substring(0, 200));
                throw new Error(`Server returned ${contentType} instead of JSON`);
            }
            
            const result = await response.json();
            
            if (!response.ok) {
                console.error('═══════════════════════════════════════════════════════════');
                console.error('🚨 TRAINING START FAILED');
                console.error('Response:', result);
                console.error('═══════════════════════════════════════════════════════════');
                
                updateTrainingStatus('inactive', null);
                
                // Show detailed error message
                const errorMsg = result.message || result.error || 'Unknown error';
                const errorDetails = result.details || result.suggestion || '';
                const errorCode = result.code || 'TRAINING_START_FAILED';
                
                // Use global error display if available, otherwise use alert
                if (typeof showGlobalError === 'function') {
                    showGlobalError(
                        `Failed to start training: ${errorMsg}`,
                        errorDetails,
                        errorCode
                    );
                } else {
                    alert(`Failed to start training:\n\n${errorMsg}\n\n${errorDetails ? `Details: ${errorDetails}` : ''}\n\nError Code: ${errorCode}`);
                }
                return;
            }
            
            console.log('Training started successfully:', result);
            const newEpochId = result.epochId || result.currentRound;
            console.log(`[Training Start] New epoch ID: ${newEpochId}`);
            
            // REASON 2 FIX: Reset lastKnownEpochId to force dashboard to detect new epoch
            if (typeof window !== 'undefined' && window.lastKnownEpochId !== undefined) {
                console.log(`[Fix] Resetting lastKnownEpochId from ${window.lastKnownEpochId} to null to force update`);
                window.lastKnownEpochId = null;
            }
            
            // REASON 11 FIX: Dispatch custom event so dashboard can listen and react immediately
            if (typeof window !== 'undefined') {
                const trainingStartEvent = new CustomEvent('trainingStarted', { 
                    detail: { epochId: newEpochId, timestamp: Date.now() } 
                });
                window.dispatchEvent(trainingStartEvent);
                console.log(`[Fix] Dispatched trainingStarted event with epoch ${newEpochId}`);
            }
            
            // REASON 3 FIX: Immediately refresh dashboard with error handling and retry logic
            const refreshDashboardWithRetry = async (attempt = 1, maxAttempts = 5) => {
                try {
                    if (typeof window.refreshDashboard === 'function') {
                        console.log(`[Fix] Refreshing dashboard (attempt ${attempt}/${maxAttempts})...`);
                        await window.refreshDashboard();
                        console.log(`[Fix] Dashboard refresh successful (attempt ${attempt})`);
                    } else {
                        console.warn('[Fix] refreshDashboard function not available');
                    }
                } catch (error) {
                    console.error(`[Fix] Dashboard refresh failed (attempt ${attempt}):`, error);
                    if (attempt < maxAttempts) {
                        setTimeout(() => refreshDashboardWithRetry(attempt + 1, maxAttempts), 1000 * attempt);
                    }
                }
            };
            
            // REASON 6 FIX: Multiple refresh attempts with exponential backoff to handle race conditions
            console.log('🔄 Immediately refreshing dashboard to show new epoch...');
            setTimeout(() => refreshDashboardWithRetry(1, 5), 200);   // 200ms
            setTimeout(() => refreshDashboardWithRetry(2, 5), 500);   // 500ms
            setTimeout(() => refreshDashboardWithRetry(3, 5), 1000); // 1s
            setTimeout(() => refreshDashboardWithRetry(4, 5), 2000); // 2s
            setTimeout(() => refreshDashboardWithRetry(5, 5), 3000); // 3s
            
            // STAY ON TRAINING PAGE - Never navigate away or reload
            // Just refresh the training status to show the new epoch
            console.log('Training started - staying on training page and updating status...');
            console.log('Current page:', window.location.pathname);
            
            // Refresh training status immediately and periodically to show progress
            await refreshTrainingStatus();
            setTimeout(async () => {
                await refreshTrainingStatus();
            }, 2000);
            setTimeout(async () => {
                await refreshTrainingStatus();
            }, 5000);
            
            // DO NOT open dashboard automatically - user can open it manually if needed
            // This prevents any unwanted navigation or tab opening
            
            // Poll for completion (demo is faster, real training takes longer)
            let pollCount = 0;
            const maxPolls = isDemo ? 40 : 30; // Demo: 40 polls * 2s = 80s, Real: 30 polls * 5s = 150s
            const pollDelay = isDemo ? 2000 : 5000; // Demo polls every 2s, real every 5s
            
            const pollInterval = setInterval(async () => {
                pollCount++;
                await refreshTrainingStatus();
                
                const statusData = await fetch(`${API_BASE}/api/training/status`).then(r => r.json()).catch(() => null);
                
                // Check if new epoch is published (demo completed)
                if (statusData && statusData.epochId && statusData.epochId >= result.epochId && statusData.published) {
                    clearInterval(pollInterval);
                    console.log('Training completed!');
                    // Start auto-refresh on dashboard for 5 minutes
                    if (typeof window.startAutoRefresh === 'function') {
                        window.startAutoRefresh();
                    }
                    // Refresh dashboard if we're on the dashboard page
                    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
                        if (typeof window.refreshDashboard === 'function') {
                            await window.refreshDashboard();
                        } else {
                            window.location.reload();
                        }
                    }
                } else if (pollCount >= maxPolls) {
                    clearInterval(pollInterval);
                    console.log('Polling timeout - training may still be processing');
                    // Start auto-refresh anyway (training might still complete)
                    if (typeof window.startAutoRefresh === 'function') {
                        window.startAutoRefresh();
                    }
                }
            }, pollDelay);
        }).catch((error) => {
            console.error('═══════════════════════════════════════════════════════════');
            console.error('🚨 ERROR STARTING TRAINING (NETWORK/EXCEPTION)');
            console.error('Error:', error.message);
            console.error('Stack:', error.stack);
            console.error('═══════════════════════════════════════════════════════════');
            
            updateTrainingStatus('inactive', null);
            
            const errorMsg = error.message || 'Network error or exception occurred';
            const errorDetails = 'The training request may have been sent but the response was not received. Please check the dashboard to see if training started.';
            
            // Use global error display if available, otherwise use alert
            if (typeof showGlobalError === 'function') {
                showGlobalError(
                    `Failed to start training: ${errorMsg}`,
                    errorDetails,
                    'TRAINING_NETWORK_ERROR'
                );
            } else {
                alert(`Failed to start training:\n\n${errorMsg}\n\n${errorDetails}`);
            }
        });
        
    } catch (error) {
        console.error('Error starting training:', error);
        alert(`Failed to start training: ${error.message}\n\nNote: Make sure PRIVATE_KEY is configured in backend .env file.`);
    } finally {
        // Re-enable button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

// Training status
let trainingStatus = 'inactive';
let currentRound = 0;
let totalRounds = null; // Can be null (no limit)
let connectedClients = 0;

function updateTrainingStatus(status, rounds = null) {
    trainingStatus = status;
    totalRounds = rounds;
    
    const statusEl = document.getElementById('training-status');
    const messageEl = document.getElementById('status-message');
    const statsStatusEl = document.getElementById('stats-status');
    const statsRoundEl = document.getElementById('stats-round');
    
    if (status === 'active') {
        statusEl.textContent = 'Training Active';
        statusEl.className = 'training-status-large active';
        // Show more informative message based on update count
        // FIX: Check updateCount to match dashboard logic (events.updatesSubmitted.length)
        // Note: updateCount is not available in updateTrainingStatus, so we check connectedClients
        // The refreshTrainingStatus function will update this with actual updateCount
        if (connectedClients === 0) {
            messageEl.textContent = 'Epoch started. Waiting for clients to submit updates...';
        } else {
            messageEl.textContent = `Training in progress... ${connectedClients} client(s) connected`;
        }
        statsStatusEl.textContent = 'Active';
    } else {
        statusEl.textContent = 'Training Inactive';
        statusEl.className = 'training-status-large inactive';
        messageEl.textContent = 'Ready to start a new training session';
        statsStatusEl.textContent = 'Inactive';
    }
    
        // Show epoch number without limit if totalRounds is null
        if (totalRounds === null || totalRounds === undefined) {
            statsRoundEl.textContent = `Epoch ${currentRound}`;
        } else {
            statsRoundEl.textContent = `${currentRound}/${totalRounds}`;
        }
}

async function refreshTrainingStatus() {
    try {
        const response = await fetch(`${API_BASE}/api/training/status`);
        if (!response.ok) {
            throw new Error('Failed to fetch training status');
        }
        
        const data = await response.json();
        
        // Update training status
        trainingStatus = data.status;
        currentRound = data.currentRound || 0;
        totalRounds = data.totalRounds; // Can be null (no limit)
        connectedClients = data.connectedClients || 0;
        
        // Update UI (pass totalRounds, can be null)
        updateTrainingStatus(data.status, data.totalRounds);
        
        // Update statistics
        const statsStatusEl = document.getElementById('stats-status');
        const statsClientsEl = document.getElementById('stats-clients');
        const statsRoundEl = document.getElementById('stats-round');
        
        if (statsStatusEl) statsStatusEl.textContent = data.status === 'active' ? 'Active' : 'Inactive';
        if (statsClientsEl) statsClientsEl.textContent = data.connectedClients || 0;
        if (statsRoundEl) {
            // Show epoch number without limit if totalRounds is null
            // Always show the epoch number, even if 0 (means no epochs yet)
            const epochNum = data.currentRound || data.epochId || 0;
            if (data.totalRounds === null || data.totalRounds === undefined) {
                statsRoundEl.textContent = epochNum > 0 ? `Epoch ${epochNum}` : 'Epoch 0';
            } else {
                statsRoundEl.textContent = `${epochNum}/${data.totalRounds || 10}`;
            }
        }
        
        // Update message with connected clients info
        // FIX: Check updateCount (actual updates submitted) not just connectedClients
        // This ensures consistency with dashboard which checks events.updatesSubmitted.length
        const messageEl = document.getElementById('status-message');
        if (messageEl && data.status === 'active') {
            const hasUpdates = (data.updateCount && data.updateCount > 0) || (data.connectedClients && data.connectedClients > 0);
            if (!hasUpdates) {
                messageEl.textContent = 'Epoch started. Waiting for clients to submit updates...';
            } else {
                const updateText = data.updateCount > 0 
                    ? `${data.updateCount} update(s) submitted`
                    : `${data.connectedClients} client(s) connected`;
                messageEl.textContent = `Training in progress... ${updateText}`;
            }
        }
        
    } catch (error) {
        console.error('Error refreshing training status:', error);
        // Keep current display on error
    }
}

// Chart initialization
let lossChart, accuracyChart, aurocChart;

function initializeCharts() {
    if (lossChart && accuracyChart && aurocChart) {
        return; // Charts already initialized
    }
    
    // Sample data matching the images
    const epochs = Array.from({ length: 10 }, (_, i) => i + 1);
    
    // Training & Validation Loss
    const lossCtx = document.getElementById('loss-chart').getContext('2d');
    lossChart = new Chart(lossCtx, {
        type: 'line',
        data: {
            labels: epochs,
            datasets: [
                {
                    label: 'Train Loss',
                    data: [0.8, 0.65, 0.55, 0.45, 0.38, 0.32, 0.28, 0.25, 0.22, 0.2],
                    borderColor: '#9333ea',
                    backgroundColor: 'rgba(147, 51, 234, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Validation Loss',
                    data: [0.85, 0.7, 0.6, 0.5, 0.43, 0.38, 0.35, 0.32, 0.3, 0.35],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 1,
                    ticks: {
                        stepSize: 0.25
                    }
                },
                x: {
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
    
    // Training & Validation Accuracy
    const accuracyCtx = document.getElementById('accuracy-chart').getContext('2d');
    accuracyChart = new Chart(accuracyCtx, {
        type: 'line',
        data: {
            labels: epochs,
            datasets: [
                {
                    label: 'Train Accuracy',
                    data: [0.5, 0.6, 0.68, 0.75, 0.8, 0.84, 0.87, 0.89, 0.9, 0.9],
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Validation Accuracy',
                    data: [0.55, 0.65, 0.73, 0.8, 0.85, 0.88, 0.91, 0.93, 0.94, 0.95],
                    borderColor: '#fbbf24',
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 1,
                    ticks: {
                        stepSize: 0.25
                    }
                },
                x: {
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
    
    // AUROC Score
    const aurocCtx = document.getElementById('auroc-chart').getContext('2d');
    aurocChart = new Chart(aurocCtx, {
        type: 'line',
        data: {
            labels: epochs,
            datasets: [
                {
                    label: 'AUROC Score',
                    data: [0.65, 0.72, 0.78, 0.84, 0.88, 0.91, 0.94, 0.96, 0.98, 1.0],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 1,
                    ticks: {
                        stepSize: 0.25
                    }
                },
                x: {
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
}

// Demo mode: Start training without blockchain
async function startDemoTraining() {
    const numClients = 5; // Default demo clients
    
    if (!confirm(`Start demo training with ${numClients} simulated clients?\n\nThis will simulate the full pipeline without using any blockchain tokens.`)) {
        return;
    }
    
    const statusMessage = document.getElementById('status-message');
    if (statusMessage) {
        statusMessage.textContent = 'Starting demo training (simulating pipeline...)';
    }
    
    updateTrainingStatus('active', null);
    
    try {
        const response = await fetch(`${API_BASE}/api/training/start-demo`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                numRounds: 1,
                minClients: numClients,
                localEpochs: 1,
                batchSize: 32,
                learningRate: 0.01,
                model: 'demo-model'
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || error.error || 'Failed to start demo');
        }
        
        const result = await response.json();
        console.log('Demo training started:', result);
        
        // Poll for completion
        let pollCount = 0;
        const maxPolls = 40; // 40 polls * 2 seconds = 80 seconds max
        
        const pollInterval = setInterval(async () => {
            pollCount++;
            await refreshTrainingStatus();
            
            const statusData = await fetch(`${API_BASE}/api/training/status`).then(r => r.json()).catch(() => null);
            
            if (statusData && statusData.demo && statusData.published) {
                clearInterval(pollInterval);
                console.log('Demo completed!');
                if (statusMessage) {
                    statusMessage.textContent = `Demo completed! Epoch ${statusData.epochId} published.`;
                }
                // Refresh dashboard if on dashboard page
                if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
                    if (typeof window.refreshDashboard === 'function') {
                        await window.refreshDashboard();
                    } else {
                        window.location.reload();
                    }
                }
            } else if (pollCount >= maxPolls) {
                clearInterval(pollInterval);
                console.log('Polling timeout');
            }
        }, 2000); // Poll every 2 seconds (demo is faster)
        
    } catch (error) {
        console.error('Demo training failed:', error);
        updateTrainingStatus('inactive', null);
        if (statusMessage) {
            statusMessage.textContent = `Demo failed: ${error.message}`;
        }
        alert(`Failed to start demo: ${error.message}`);
    }
}

// Export chart data
function exportChartData(type) {
    let data, filename;
    
    if (type === 'loss') {
        data = {
            epochs: Array.from({ length: 10 }, (_, i) => i + 1),
            trainLoss: [0.8, 0.65, 0.55, 0.45, 0.38, 0.32, 0.28, 0.25, 0.22, 0.2],
            validationLoss: [0.85, 0.7, 0.6, 0.5, 0.43, 0.38, 0.35, 0.32, 0.3, 0.35]
        };
        filename = 'training_validation_loss.json';
    } else if (type === 'accuracy') {
        data = {
            epochs: Array.from({ length: 10 }, (_, i) => i + 1),
            trainAccuracy: [0.5, 0.6, 0.68, 0.75, 0.8, 0.84, 0.87, 0.89, 0.9, 0.9],
            validationAccuracy: [0.55, 0.65, 0.73, 0.8, 0.85, 0.88, 0.91, 0.93, 0.94, 0.95]
        };
        filename = 'training_validation_accuracy.json';
    } else if (type === 'auroc') {
        data = {
            epochs: Array.from({ length: 10 }, (_, i) => i + 1),
            aurocScore: [0.65, 0.72, 0.78, 0.84, 0.88, 0.91, 0.94, 0.96, 0.98, 1.0]
        };
        filename = 'auroc_score.json';
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Load initial training status
    await refreshTrainingStatus();
    
    // Initialize charts if metrics tab is active
    if (document.getElementById('metrics-tab').classList.contains('active')) {
        initializeCharts();
    }
    
    // Auto-refresh status every 10 seconds
    setInterval(refreshTrainingStatus, 10000);
});

