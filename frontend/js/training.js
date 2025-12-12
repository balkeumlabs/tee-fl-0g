// Training Interface JavaScript
const API_BASE = window.location.origin;

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

// Modal functions
function openConfigModal() {
    document.getElementById('config-modal').classList.add('active');
}

function closeConfigModal() {
    document.getElementById('config-modal').classList.remove('active');
}

// Close modal on overlay click
document.getElementById('config-modal').addEventListener('click', (e) => {
    if (e.target.id === 'config-modal') {
        closeConfigModal();
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
        
        // Close modal immediately - don't wait for response (training happens in background)
        closeConfigModal();
        updateTrainingStatus('active', null); // Don't use numRounds - backend returns null for totalRounds
        
        // Send to backend API (fire and forget - don't block UI)
        fetch(`${API_BASE}/api/training/start`, {
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
                console.error('Training start failed:', result);
                updateTrainingStatus('inactive', null);
                alert(`Failed to start training: ${result.message || result.error || 'Unknown error'}`);
                return;
            }
            
            console.log('Training started successfully:', result);
            
            // Poll for completion (demo takes 60-90 seconds)
            let pollCount = 0;
            const maxPolls = 30; // 30 polls * 5 seconds = 150 seconds max
            
            const pollInterval = setInterval(async () => {
                pollCount++;
                await refreshTrainingStatus();
                
                const statusData = await fetch(`${API_BASE}/api/training/status`).then(r => r.json()).catch(() => null);
                
                // Check if new epoch is published (demo completed)
                if (statusData && statusData.epochId && statusData.epochId >= result.epochId && statusData.published) {
                    clearInterval(pollInterval);
                    console.log('Demo completed!');
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
                    console.log('Polling timeout - demo may still be processing');
                    // Start auto-refresh anyway (demo might still complete)
                    if (typeof window.startAutoRefresh === 'function') {
                        window.startAutoRefresh();
                    }
                }
            }, 5000); // Poll every 5 seconds
        }).catch((error) => {
            console.error('Error starting training:', error);
            updateTrainingStatus('inactive', null);
            alert(`Failed to start training: ${error.message}\n\nThe training may still be processing in the background. Please refresh the page in a few moments.`);
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
        // Show more informative message based on client count
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
        const messageEl = document.getElementById('status-message');
        if (messageEl && data.status === 'active') {
            if (data.connectedClients === 0) {
                messageEl.textContent = 'Epoch started. Waiting for clients to submit updates...';
            } else {
                messageEl.textContent = `Training in progress... ${data.connectedClients} client(s) connected`;
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

