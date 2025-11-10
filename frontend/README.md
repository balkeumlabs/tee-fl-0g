# TEE-FL-0G Mainnet Dashboard

Professional front-end dashboard showcasing the federated learning pipeline deployment on 0G Mainnet.

## Features

- **Network Status**: Display 0G Mainnet connection and deployment information
- **Contract Addresses**: Show AccessRegistry and EpochManager contracts with block explorer links
- **Pipeline Visualization**: Visual representation of the complete FL pipeline execution
- **Transaction History**: Display all on-chain transactions with block explorer links
- **Epoch Summary**: Show epoch 1 details including model hashes and status
- **0G Storage Status**: Display storage integration status and upload information

## Deployment

This dashboard is automatically deployed to GitHub Pages when changes are pushed to the `main` branch.

**Live URL**: https://balkeumlabs.github.io/tee-fl-0g/

## Local Development

1. Open `index.html` in a web browser
2. Or use a local server:
   ```bash
   cd frontend
   python -m http.server 8000
   # Then open http://localhost:8000
   ```

## Data Files

The dashboard loads data from JSON files in the `data/` directory:
- `deploy.mainnet.json` - Deployment information
- `epoch_1_mainnet_data.json` - Epoch 1 execution data
- `0g_storage_upload_mainnet.json` - Storage upload information

## Structure

```
frontend/
├── index.html          # Main HTML file
├── css/
│   └── style.css      # Styling
├── js/
│   └── app.js         # JavaScript logic
└── data/              # JSON data files
```

## Manual GitHub Pages Setup

If automatic deployment doesn't work, you can manually enable GitHub Pages:

1. Go to repository Settings → Pages
2. Source: Deploy from a branch
3. Branch: `main` / `frontend` folder
4. Save

## License

MIT
