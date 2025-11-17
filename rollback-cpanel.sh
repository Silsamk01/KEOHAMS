#!/bin/bash

# ===================================================================
# cPanel Rollback Script for KEOHAMS Laravel Application
# ===================================================================
# This script rolls back to a previous deployment
# Usage: bash rollback-cpanel.sh [timestamp]
# Example: bash rollback-cpanel.sh 20250116_143022
# ===================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TIMESTAMP=$1
CPANEL_USER="ngfaczol"
CPANEL_HOME="/home/$CPANEL_USER"
APP_DIR="$CPANEL_HOME/public_html"
BACKUP_DIR="$CPANEL_HOME/backups"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          cPanel Rollback Script - KEOHAMS              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# ===================================================================
# Validation
# ===================================================================
if [ -z "$TIMESTAMP" ]; then
    echo -e "${RED}✗ Error: Timestamp not provided!${NC}"
    echo ""
    echo -e "${YELLOW}Usage: bash rollback-cpanel.sh [timestamp]${NC}"
    echo -e "${YELLOW}Example: bash rollback-cpanel.sh 20250116_143022${NC}"
    echo ""
    echo -e "${GREEN}Available backups:${NC}"
    ssh $CPANEL_USER@server.keohams.com "ls -lh $BACKUP_DIR/app_backup_*.tar.gz 2>/dev/null | tail -5" || echo "No backups found"
    exit 1
fi

# Check if backup exists
ssh $CPANEL_USER@server.keohams.com "test -f $BACKUP_DIR/app_backup_$TIMESTAMP.tar.gz" || {
    echo -e "${RED}✗ Error: Backup not found for timestamp: $TIMESTAMP${NC}"
    echo ""
    echo -e "${GREEN}Available backups:${NC}"
    ssh $CPANEL_USER@server.keohams.com "ls -lh $BACKUP_DIR/app_backup_*.tar.gz 2>/dev/null | tail -5"
    exit 1
}

# ===================================================================
# Confirmation
# ===================================================================
echo -e "${YELLOW}⚠ WARNING: This will restore the application to timestamp: $TIMESTAMP${NC}"
echo -e "${YELLOW}Current deployment will be backed up before rollback.${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${YELLOW}Rollback cancelled.${NC}"
    exit 0
fi

echo ""

# ===================================================================
# Step 1: Backup Current State
# ===================================================================
echo -e "${YELLOW}[1/5] Backing up current state...${NC}"

ROLLBACK_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ssh $CPANEL_USER@server.keohams.com "tar -czf $BACKUP_DIR/pre_rollback_$ROLLBACK_TIMESTAMP.tar.gz -C $APP_DIR ."

echo -e "${GREEN}✓ Current state backed up: pre_rollback_$ROLLBACK_TIMESTAMP.tar.gz${NC}"
echo ""

# ===================================================================
# Step 2: Put Application in Maintenance Mode
# ===================================================================
echo -e "${YELLOW}[2/5] Enabling maintenance mode...${NC}"

ssh $CPANEL_USER@server.keohams.com "cd $APP_DIR && php artisan down --message='Application is being restored. Please wait...' --retry=60"

echo -e "${GREEN}✓ Maintenance mode enabled${NC}"
echo ""

# ===================================================================
# Step 3: Restore Application Files
# ===================================================================
echo -e "${YELLOW}[3/5] Restoring application files...${NC}"

ssh $CPANEL_USER@server.keohams.com << ENDSSH
cd $APP_DIR

# Remove current files (except storage)
find . -maxdepth 1 ! -name 'storage' ! -name '.' ! -name '..' -exec rm -rf {} + 2>/dev/null || true

# Extract backup
tar -xzf $BACKUP_DIR/app_backup_$TIMESTAMP.tar.gz -C $APP_DIR

# Set permissions
chmod -R 755 storage bootstrap/cache
chmod 600 .env

ENDSSH

echo -e "${GREEN}✓ Application files restored${NC}"
echo ""

# ===================================================================
# Step 4: Restore Database (Optional)
# ===================================================================
echo -e "${YELLOW}[4/5] Database restoration...${NC}"
read -p "Do you want to restore the database? (yes/no): " RESTORE_DB

if [ "$RESTORE_DB" == "yes" ]; then
    ssh $CPANEL_USER@server.keohams.com << ENDSSH
    
    # Create backup of current database before restore
    mysqldump -u ngfaczol_keohams -p'optimusprime708' ngfaczol_keohams > $BACKUP_DIR/pre_rollback_db_$ROLLBACK_TIMESTAMP.sql
    
    # Restore database
    mysql -u ngfaczol_keohams -p'optimusprime708' ngfaczol_keohams < $BACKUP_DIR/db_backup_$TIMESTAMP.sql
    
ENDSSH
    echo -e "${GREEN}✓ Database restored${NC}"
else
    echo -e "${YELLOW}⊘ Database restoration skipped${NC}"
fi
echo ""

# ===================================================================
# Step 5: Optimize and Bring Application Back Online
# ===================================================================
echo -e "${YELLOW}[5/5] Optimizing and bringing application online...${NC}"

ssh $CPANEL_USER@server.keohams.com << 'ENDSSH'
cd $APP_DIR

# Clear caches
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear

# Optimize
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Reset OPcache
php -r "if (function_exists('opcache_reset')) opcache_reset();"

# Disable maintenance mode
php artisan up

ENDSSH

echo -e "${GREEN}✓ Application is back online${NC}"
echo ""

# ===================================================================
# Verification
# ===================================================================
echo -e "${YELLOW}Verifying rollback...${NC}"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://keohams.com)

if [ "$HTTP_STATUS" == "200" ]; then
    echo -e "${GREEN}✓ Application is accessible (HTTP $HTTP_STATUS)${NC}"
else
    echo -e "${RED}⚠ Application returned HTTP $HTTP_STATUS${NC}"
fi

echo ""

# ===================================================================
# Rollback Summary
# ===================================================================
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Rollback Completed Successfully             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Rollback Details:${NC}"
echo -e "  Restored to: $TIMESTAMP"
echo -e "  Pre-rollback backup: pre_rollback_$ROLLBACK_TIMESTAMP.tar.gz"
if [ "$RESTORE_DB" == "yes" ]; then
    echo -e "  Pre-rollback DB: pre_rollback_db_$ROLLBACK_TIMESTAMP.sql"
fi
echo ""
echo -e "${GREEN}Next Steps:${NC}"
echo -e "  1. Verify application at: ${BLUE}https://keohams.com${NC}"
echo -e "  2. Check logs for any errors"
echo -e "  3. Test critical functionality"
echo ""
