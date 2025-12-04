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
    
    const formData = new FormData(e.target);
    const config = {
        numRounds: parseInt(formData.get('numRounds')),
        minClients: parseInt(formData.get('minClients')),
        localEpochs: parseInt(formData.get('localEpochs')),
        batchSize: parseInt(formData.get('batchSize')),
        learningRate: parseFloat(formData.get('learningRate')),
        model: formData.get('model')
    };
    
    // TODO: Send to backend API
    console.log('Training config:', config);
    
    // For now, just close modal and show message
    closeConfigModal();
    alert('Training configuration submitted. Backend API integration required to start actual training.');
    
    // Update UI to show training started (for demo)
    // updateTrainingStatus('active', config.numRounds);
});

// Training status
let trainingStatus = 'inactive';
let currentRound = 0;
let totalRounds = 10;
let connectedClients = 0;

function updateTrainingStatus(status, rounds = 10) {
    trainingStatus = status;
    totalRounds = rounds;
    
    const statusEl = document.getElementById('training-status');
    const messageEl = document.getElementById('status-message');
    const statsStatusEl = document.getElementById('stats-status');
    const statsRoundEl = document.getElementById('stats-round');
    
    if (status === 'active') {
        statusEl.textContent = 'Training Active';
        statusEl.className = 'training-status-large active';
        messageEl.textContent = 'Training in progress...';
        statsStatusEl.textContent = 'Active';
    } else {
        statusEl.textContent = 'Training Inactive';
        statusEl.className = 'training-status-large inactive';
        messageEl.textContent = 'Ready to start a new training session';
        statsStatusEl.textContent = 'Inactive';
    }
    
    statsRoundEl.textContent = `${currentRound}/${totalRounds}`;
}

function refreshTrainingStatus() {
    // TODO: Fetch from backend API
    // For now, just update display
    updateTrainingStatus(trainingStatus, totalRounds);
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
document.addEventListener('DOMContentLoaded', () => {
    updateTrainingStatus('inactive');
    
    // Initialize charts if metrics tab is active
    if (document.getElementById('metrics-tab').classList.contains('active')) {
        initializeCharts();
    }
});

