# How to Open the Dashboard

## Problem: Opening index.html shows Google search results

This happens when Windows opens the file with the wrong program. Here's how to fix it:

## Solution 1: Open with Browser (Recommended)

1. **Right-click** on `index.html`
2. Select **"Open with"**
3. Choose your browser (Chrome, Edge, Firefox, etc.)
4. The dashboard should load correctly

## Solution 2: Use Local Server (Best for Testing)

### Option A: Python (if installed)
```powershell
cd frontend
python -m http.server 8000
```
Then open: http://localhost:8000

### Option B: Node.js (if installed)
```powershell
cd frontend
npx http-server -p 8000
```
Then open: http://localhost:8000

### Option C: Use the test script
```powershell
cd frontend
.\test-local.ps1
```

## Solution 3: Set Default Program

1. Right-click on `index.html`
2. Select **"Open with"** → **"Choose another app"**
3. Select your browser
4. Check **"Always use this app to open .html files"**
5. Click **OK**

## Solution 4: Drag and Drop

1. Open your browser (Chrome, Edge, Firefox, etc.)
2. Drag `index.html` into the browser window
3. The dashboard should load

## Verify It's Working

When opened correctly, you should see:
- ✅ "TEE-FL-0G" title at the top
- ✅ "Mainnet Active" status badge
- ✅ Network information card
- ✅ Contract addresses
- ✅ Pipeline visualization
- ✅ Transaction history

If you see "Loading..." everywhere, check the browser console (F12) for errors.

## Still Not Working?

1. Check browser console (Press F12 → Console tab)
2. Look for errors about missing files
3. Verify all files exist:
   - `css/style.css`
   - `js/app.js`
   - `data/deploy.mainnet.json`
   - `data/epoch_1_mainnet_data.json`
   - `data/0g_storage_upload_mainnet.json`
