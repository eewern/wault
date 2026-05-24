#!/bin/bash

# Notion Workspace Backup Script
# Runs hourly via macOS LaunchAgent

DATA_DIR="$HOME/Notion_Data"
BACKUPS_DIR="$DATA_DIR/backups"
STORE_FILE="$DATA_DIR/workspace-api-store.json"
LOG_FILE="$BACKUPS_DIR/backup.log"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Create directories if they don't exist
mkdir -p "$BACKUPS_DIR"

# Create backup with timestamp
TIMESTAMP=$(date +%s)
BACKUP_FILE="$BACKUPS_DIR/workspace-api-store.backup.$TIMESTAMP.json"

# Perform backup
if [ -f "$STORE_FILE" ]; then
    cp "$STORE_FILE" "$BACKUP_FILE"
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

    # Log the backup
    {
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Backup created: $BACKUP_FILE ($BACKUP_SIZE)"
    } >> "$LOG_FILE"

    # Clean old backups (keep last 30)
    BACKUP_COUNT=$(ls -1 "$BACKUPS_DIR"/workspace-api-store.backup.*.json 2>/dev/null | wc -l)
    if [ $BACKUP_COUNT -gt 30 ]; then
        OLDEST=$(ls -1t "$BACKUPS_DIR"/workspace-api-store.backup.*.json | tail -1)
        rm -f "$OLDEST"
        {
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🗑️  Deleted old backup: $(basename $OLDEST)"
        } >> "$LOG_FILE"
    fi

    # Log summary
    {
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📊 Active backups: $((BACKUP_COUNT - 1))/30"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📁 Store file: $(du -h $STORE_FILE | cut -f1)"
        echo ""
    } >> "$LOG_FILE"
else
    {
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ ERROR: Store file not found at $STORE_FILE"
    } >> "$LOG_FILE"
    exit 1
fi
