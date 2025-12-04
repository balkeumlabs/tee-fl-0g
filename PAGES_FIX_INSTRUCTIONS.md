# Fix GitHub Pages to Serve from /frontend

## Problem
GitHub Pages is currently set to "Deploy from a branch" which serves the root directory (showing README.md instead of the dashboard).

## Solution
Change the Pages source to "GitHub Actions" instead of "Deploy from a branch".

### Steps:
1. Go to **Settings** → **Pages**
2. Under **Source**, change from:
   - ❌ **Deploy from a branch** → `main` → `/ (root)`
   
   To:
   - ✅ **GitHub Actions**
3. Click **Save**

### What This Does:
- GitHub Pages will use our Actions workflow (`.github/workflows/deploy-pages.yml`)
- The workflow deploys from the `/frontend` folder
- The dashboard will be served correctly

### After Changing:
- The "Deploy to GitHub Pages" workflow will run automatically
- Wait 1-2 minutes for deployment
- Dashboard will be available at: `https://balkeumlabs.github.io/tee-fl-0g/`

## Alternative (If GitHub Actions option not available):
If "GitHub Actions" option doesn't appear, you may need to:
1. Keep "Deploy from a branch" but change folder to `/docs`
2. Move frontend files to `/docs` folder
3. Or use a different deployment method

But first, try changing to "GitHub Actions" - that should work.
