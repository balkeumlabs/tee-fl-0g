# Front-end Deployment Guide

## Quick Start

This dashboard is automatically deployed to GitHub Pages when changes are pushed to the `main` branch.

## Manual Deployment

If automatic deployment doesn't work, follow these steps:

### 1. Enable GitHub Pages

1. Go to repository **Settings** → **Pages**
2. Under **Source**, select:
   - **Deploy from a branch**
   - **Branch**: `main`
   - **Folder**: `/frontend`
3. Click **Save**

### 2. Verify Deployment

After enabling, GitHub Pages will be available at:
- **URL**: `https://balkeumlabs.github.io/tee-fl-0g/`

### 3. Update Data Files

When new mainnet data is available, update these files:
- `frontend/data/deploy.mainnet.json`
- `frontend/data/epoch_1_mainnet_data.json`
- `frontend/data/0g_storage_upload_mainnet.json`

Then commit and push to `main` branch. GitHub Pages will automatically redeploy.

## Local Testing

### Option 1: Simple HTTP Server

```bash
cd frontend
python -m http.server 8000
# Open http://localhost:8000
```

### Option 2: Node.js HTTP Server

```bash
cd frontend
npx http-server -p 8000
# Open http://localhost:8000
```

### Option 3: VS Code Live Server

1. Install "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

## Troubleshooting

### Data Not Loading

- Check browser console for errors
- Verify data files exist in `frontend/data/` directory
- Check file paths in `app.js` (should be `./data/`)

### GitHub Pages Not Updating

- Wait 1-2 minutes after push
- Check GitHub Actions for deployment status
- Verify Pages is enabled in repository settings

### Styling Issues

- Clear browser cache
- Check CSS file is loading correctly
- Verify all paths are relative (not absolute)

## Customization

### Update Colors

Edit `frontend/css/style.css`:
- `--primary-color`: Main brand color
- `--success-color`: Success indicators
- `--text-primary`: Main text color

### Add New Sections

1. Add HTML in `index.html`
2. Add styles in `css/style.css`
3. Add JavaScript logic in `js/app.js`

## Support

For issues or questions, see the main repository README or open an issue on GitHub.
