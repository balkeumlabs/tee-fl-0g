# Quick Deploy Commands

## After Making Changes

### Windows PowerShell (Local):
```powershell
git add .; git commit -m "Fix: [describe your fix]"; git push origin main
```

### EC2 (SSH - Bash):
```bash
cd /home/ec2-user/apps/tee-fl-0g && git pull origin main && npm install --legacy-peer-deps && pm2 restart tee-fl-0g-api
```

## After Frontend Changes Only

### Windows PowerShell:
```powershell
git add frontend/; git commit -m "Fix: [describe]"; git push origin main
```

### EC2:
```bash
cd /home/ec2-user/apps/tee-fl-0g && git pull origin main && pm2 restart tee-fl-0g-api
```
**Note:** After frontend changes, also do a **hard refresh** in browser: `Ctrl + Shift + R`

## After Backend Changes Only

### Windows PowerShell:
```powershell
git add server/; git commit -m "Fix: [describe]"; git push origin main
```

### EC2:
```bash
cd /home/ec2-user/apps/tee-fl-0g && git pull origin main && npm install --legacy-peer-deps && pm2 restart tee-fl-0g-api
```

