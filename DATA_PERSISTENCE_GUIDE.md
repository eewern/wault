# Data Persistence & Deployment Strategy

## 🔴 The Problem

Every redeploy, your data disappears because:
1. **Data file location** - `workspace-api-store.json` is in the project directory
2. **Deployment overwrites** - When you redeploy, files get replaced
3. **No backup** - Previous deployment data is lost
4. **Fresh state** - App starts with empty JSON

---

## ✅ Solutions

### Solution 1: Store Data OUTSIDE Project Directory (Recommended)

**Why**: Survives redeployment because it's not part of project files

#### Step 1: Create a Data Directory (Outside Project)
```bash
mkdir -p ~/Notion_Data
```

#### Step 2: Move Data File There
```bash
cp "/Users/eewern/Desktop/Notion design/workspace-api-store.json" ~/Notion_Data/
```

#### Step 3: Point API to External Location

**When starting the API server**:
```bash
WORKSPACE_API_STORE=~/Notion_Data/workspace-api-store.json \
node workspace-api-server.mjs
```

**Or create a startup script** (`start-api.sh`):
```bash
#!/bin/bash
export WORKSPACE_API_STORE=~/Notion_Data/workspace-api-store.json
export WORKSPACE_API_PORT=3334
node "/Users/eewern/Desktop/Notion design/workspace-api-server.mjs"
```

Run it:
```bash
chmod +x start-api.sh
./start-api.sh
```

---

### Solution 2: Version Control (Git)

**Why**: Track data changes + backup on GitHub

#### Setup
```bash
cd "/Users/eewern/Desktop/Notion design"
git init
```

#### Add to `.gitignore` (sensitive files only):
```bash
# .gitignore
node_modules/
.env
*.backup.json
```

#### Commit your data
```bash
git add workspace-api-store.json
git commit -m "Save workspace data before deployment"
git push origin main
```

#### After redeploy, restore:
```bash
git pull
```

---

### Solution 3: Automated Backups (Best Practice)

**Create automatic backups before each deployment**

#### Backup Script (`backup-data.sh`):
```bash
#!/bin/bash

# Create backups directory
mkdir -p ~/Notion_Data/backups

# Backup with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cp "/Users/eewern/Desktop/Notion design/workspace-api-store.json" \
   ~/Notion_Data/backups/workspace-api-store_$TIMESTAMP.json

# Keep only last 30 backups
find ~/Notion_Data/backups -type f -name "*.json" | \
  sort -r | tail -n +31 | xargs -r rm

echo "✓ Backup created: workspace-api-store_$TIMESTAMP.json"
```

**Make it executable**:
```bash
chmod +x backup-data.sh
```

**Run before deployment**:
```bash
./backup-data.sh
```

---

### Solution 4: Cloud Storage (For Team)

**If working with team, use cloud storage**

#### Option A: Dropbox
```bash
ln -s ~/Dropbox/Notion_Data/workspace-api-store.json \
     "/Users/eewern/Desktop/Notion design/workspace-api-store.json"
```

#### Option B: Google Drive
```bash
# Mount Google Drive
# Then link the file:
ln -s ~/GoogleDrive/Notion_Data/workspace-api-store.json \
     "/Users/eewern/Desktop/Notion design/workspace-api-store.json"
```

#### Option C: iCloud
```bash
ln -s ~/Library/Mobile\ Documents/com~apple~CloudDocs/Notion_Data/workspace-api-store.json \
     "/Users/eewern/Desktop/Notion design/workspace-api-store.json"
```

---

## 🎯 Recommended Setup (Complete)

### Step 1: Create External Data Directory
```bash
mkdir -p ~/Notion_Data/backups
```

### Step 2: Move Data There
```bash
mv "/Users/eewern/Desktop/Notion design/workspace-api-store.json" \
   ~/Notion_Data/workspace-api-store.json
```

### Step 3: Create Start Script (`~/Notion_Data/start.sh`)
```bash
#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔄 Starting Notion Workspace API & Server...${NC}"

# Backup data
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cp ~/Notion_Data/workspace-api-store.json \
   ~/Notion_Data/backups/workspace-api-store_$TIMESTAMP.json
echo -e "${GREEN}✓ Data backed up: workspace-api-store_$TIMESTAMP.json${NC}"

# Clean old backups (keep last 30)
find ~/Notion_Data/backups -type f -name "*.json" | \
  sort -r | tail -n +31 | xargs -r rm
echo -e "${GREEN}✓ Old backups cleaned${NC}"

# Start API Server (Terminal 1)
echo -e "${YELLOW}📡 Starting API Server on port 3334...${NC}"
WORKSPACE_API_STORE=~/Notion_Data/workspace-api-store.json \
WORKSPACE_API_PORT=3334 \
node "/Users/eewern/Desktop/Notion design/workspace-api-server.mjs" &
API_PID=$!

# Start Web Server (Terminal 2)
echo -e "${YELLOW}🌐 Starting Web Server on port 3333...${NC}"
cd "/Users/eewern/Desktop/Notion design"
python3 -m http.server 3333 &
WEB_PID=$!

# Display URLs
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Servers running!${NC}"
echo -e "${GREEN}========================================${NC}"
echo "📱 Web App:  http://127.0.0.1:3333"
echo "📡 API:      http://127.0.0.1:3334"
echo ""
echo "🔗 Open in browser with API:"
echo "   http://127.0.0.1:3333/?api=http://127.0.0.1:3334"
echo ""
echo "📁 Data Location: ~/Notion_Data/workspace-api-store.json"
echo "💾 Backups:       ~/Notion_Data/backups/"
echo ""
echo "To stop: kill $API_PID $WEB_PID"
echo -e "${GREEN}========================================${NC}"

# Keep script running
wait $API_PID $WEB_PID
```

### Step 4: Make Script Executable
```bash
chmod +x ~/Notion_Data/start.sh
```

### Step 5: Use the Script
```bash
~/Notion_Data/start.sh
```

---

## 📊 Current Data Status

**Location**: `/Users/eewern/Desktop/Notion design/workspace-api-store.json`  
**Size**: 301 KB  
**Lines**: 8,727  
**Last Modified**: May 23, 2026

**⚠️ Action Required**: This file will be lost on next redeploy unless you move it!

---

## 🔄 Deployment Workflow (Updated)

### Before Redeploy
```bash
# 1. Backup current data
./backup-data.sh

# 2. Commit if using git
git add workspace-api-store.json
git commit -m "Save data before deployment"

# 3. Copy to external location
cp workspace-api-store.json ~/Notion_Data/
```

### During Redeploy
```bash
# Redeploy your app code
# (data is safe in ~/Notion_Data/)
```

### After Redeploy
```bash
# 1. Restore data from external location
cp ~/Notion_Data/workspace-api-store.json \
   "/Users/eewern/Desktop/Notion design/"

# 2. Start API with external data path
WORKSPACE_API_STORE=~/Notion_Data/workspace-api-store.json \
node workspace-api-server.mjs
```

---

## 🛡️ Backup Verification

Check your backups exist:
```bash
ls -lh ~/Notion_Data/backups/
```

Expected output:
```
-rw-r--r--  workspace-api-store_20260524_154230.json
-rw-r--r--  workspace-api-store_20260524_153145.json
-rw-r--r--  workspace-api-store_20260524_152010.json
```

Restore from backup if needed:
```bash
cp ~/Notion_Data/backups/workspace-api-store_20260524_154230.json \
   ~/Notion_Data/workspace-api-store.json
```

---

## 💡 Quick Decision Tree

| Situation | Solution |
|---|---|
| Solo developer, single machine | Solution 1 (External directory) |
| Team collaboration | Solution 2 (Git) + Solution 1 |
| Want automatic backups | Solution 3 (Backup script) |
| Need cross-device sync | Solution 4 (Cloud storage) |
| All of above | Complete setup (recommended) |

---

## ✅ Implementation Checklist

- [ ] Create `~/Notion_Data` directory
- [ ] Move `workspace-api-store.json` there
- [ ] Create start script
- [ ] Make script executable
- [ ] Test it works: `~/Notion_Data/start.sh`
- [ ] Verify backups directory exists
- [ ] Set up git commits (optional)
- [ ] Document your backup location

---

**Recommended**: Go with **Solution 1 + Solution 3** = External directory + automatic backups = never lose data again

---

**Version**: 1.0 | **Created**: May 24, 2026
