#!/bin/bash

# ===================================================================
# cPanel Deployment Script for KEOHAMS Laravel Application
# ===================================================================
# This script automates the deployment process to cPanel hosting
# Usage: bash deploy-cpanel.sh [environment]
# Example: bash deploy-cpanel.sh production
# ===================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
CPANEL_USER="ngfaczol"
CPANEL_HOME="/home/$CPANEL_USER"
APP_DIR="$CPANEL_HOME/public_html"
BACKUP_DIR="$CPANEL_HOME/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       cPanel Deployment Script - KEOHAMS              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Environment: ${ENVIRONMENT}${NC}"
echo -e "${GREEN}Timestamp: ${TIMESTAMP}${NC}"
echo ""

# ===================================================================
# Step 1: Pre-deployment Checks
# ===================================================================
echo -e "${YELLOW}[1/10] Running pre-deployment checks...${NC}"

# Check if .env file exists
if [ ! -f ".env.${ENVIRONMENT}" ]; then
    echo -e "${RED}✗ Error: .env.${ENVIRONMENT} file not found!${NC}"
    exit 1
fi

# Check if required directories exist
if [ ! -d "app" ] || [ ! -d "config" ] || [ ! -f "artisan" ]; then
    echo -e "${RED}✗ Error: Not in Laravel root directory!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Pre-deployment checks passed${NC}"
echo ""

# ===================================================================
# Step 2: Backup Current Deployment
# ===================================================================
echo -e "${YELLOW}[2/10] Creating backup of current deployment...${NC}"

# Create backup directory if it doesn't exist
ssh $CPANEL_USER@server.keohams.com "mkdir -p $BACKUP_DIR"

# Backup application files
ssh $CPANEL_USER@server.keohams.com "tar -czf $BACKUP_DIR/app_backup_$TIMESTAMP.tar.gz -C $APP_DIR . 2>/dev/null || true"

# Backup database
echo -e "${YELLOW}Creating database backup...${NC}"
ssh $CPANEL_USER@server.keohams.com "mysqldump -u ngfaczol_keohams -p'optimusprime708' ngfaczol_keohams > $BACKUP_DIR/db_backup_$TIMESTAMP.sql 2>/dev/null"

# Keep only last 5 backups
ssh $CPANEL_USER@server.keohams.com "cd $BACKUP_DIR && ls -t app_backup_*.tar.gz | tail -n +6 | xargs -r rm"
ssh $CPANEL_USER@server.keohams.com "cd $BACKUP_DIR && ls -t db_backup_*.sql | tail -n +6 | xargs -r rm"

echo -e "${GREEN}✓ Backup created: app_backup_$TIMESTAMP.tar.gz${NC}"
echo ""

# ===================================================================
# Step 3: Run Local Tests
# ===================================================================
echo -e "${YELLOW}[3/10] Running tests locally...${NC}"

if [ -f "vendor/bin/phpunit" ]; then
    php vendor/bin/phpunit --testsuite Unit --stop-on-failure || {
        echo -e "${RED}✗ Tests failed! Deployment aborted.${NC}"
        exit 1
    }
    echo -e "${GREEN}✓ Tests passed${NC}"
else
    echo -e "${YELLOW}⚠ PHPUnit not found, skipping tests${NC}"
fi
echo ""

# ===================================================================
# Step 4: Build Assets
# ===================================================================
echo -e "${YELLOW}[4/10] Building production assets...${NC}"

if [ -f "package.json" ]; then
    npm ci --production
    npm run prod
    echo -e "${GREEN}✓ Assets built successfully${NC}"
else
    echo -e "${YELLOW}⚠ No package.json found, skipping asset build${NC}"
fi
echo ""

# ===================================================================
# Step 5: Install Dependencies
# ===================================================================
echo -e "${YELLOW}[5/10] Installing production dependencies...${NC}"

composer install --no-dev --optimize-autoloader --no-interaction

echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# ===================================================================
# Step 6: Upload Files to cPanel
# ===================================================================
echo -e "${YELLOW}[6/10] Uploading files to cPanel...${NC}"

# Create temporary directory for deployment
TEMP_DIR=$(mktemp -d)
rsync -avz --exclude='.git' \
           --exclude='node_modules' \
           --exclude='tests' \
           --exclude='.env*' \
           --exclude='storage/logs/*' \
           --exclude='storage/framework/cache/*' \
           --exclude='storage/framework/sessions/*' \
           --exclude='storage/framework/views/*' \
           . $TEMP_DIR/

# Upload to cPanel
rsync -avz --delete $TEMP_DIR/ $CPANEL_USER@server.keohams.com:$APP_DIR/

# Upload environment file
scp .env.$ENVIRONMENT $CPANEL_USER@server.keohams.com:$APP_DIR/.env

# Cleanup
rm -rf $TEMP_DIR

echo -e "${GREEN}✓ Files uploaded successfully${NC}"
echo ""

# ===================================================================
# Step 7: Set Permissions
# ===================================================================
echo -e "${YELLOW}[7/10] Setting file permissions...${NC}"

ssh $CPANEL_USER@server.keohams.com << 'ENDSSH'
cd $APP_DIR

# Set directory permissions
find . -type d -exec chmod 755 {} \;

# Set file permissions
find . -type f -exec chmod 644 {} \;

# Set executable permissions
chmod 755 artisan

# Set writable permissions for storage and cache
chmod -R 775 storage bootstrap/cache
chown -R $CPANEL_USER:$CPANEL_USER storage bootstrap/cache

# Secure .env file
chmod 600 .env

ENDSSH

echo -e "${GREEN}✓ Permissions set successfully${NC}"
echo ""

# ===================================================================
# Step 8: Run Database Migrations
# ===================================================================
echo -e "${YELLOW}[8/10] Running database migrations...${NC}"

ssh $CPANEL_USER@server.keohams.com << 'ENDSSH'
cd $APP_DIR
php artisan migrate --force || {
    echo "Migration failed! Rolling back..."
    php artisan migrate:rollback --force
    exit 1
}
ENDSSH

echo -e "${GREEN}✓ Migrations completed${NC}"
echo ""

# ===================================================================
# Step 9: Optimize Application
# ===================================================================
echo -e "${YELLOW}[9/10] Optimizing application...${NC}"

ssh $CPANEL_USER@server.keohams.com << 'ENDSSH'
cd $APP_DIR

# Clear all caches
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear

# Optimize for production
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Warm up caches
php artisan cache:warmup

# Optimize database
php artisan db:optimize

# Reset OPcache
php -r "if (function_exists('opcache_reset')) { opcache_reset(); echo 'OPcache reset\n'; }"

ENDSSH

echo -e "${GREEN}✓ Application optimized${NC}"
echo ""

# ===================================================================
# Step 10: Post-Deployment Verification
# ===================================================================
echo -e "${YELLOW}[10/10] Running post-deployment verification...${NC}"

# Check if application is accessible
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://keohams.com)

if [ "$HTTP_STATUS" == "200" ]; then
    echo -e "${GREEN}✓ Application is accessible (HTTP $HTTP_STATUS)${NC}"
else
    echo -e "${RED}⚠ Application returned HTTP $HTTP_STATUS${NC}"
fi

# Verify database connection
ssh $CPANEL_USER@server.keohams.com << 'ENDSSH'
cd $APP_DIR
php artisan migrate:status > /dev/null 2>&1 && echo "✓ Database connection OK" || echo "✗ Database connection failed"
ENDSSH

echo ""

# ===================================================================
# Deployment Summary
# ===================================================================
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Deployment Completed Successfully           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Deployment Details:${NC}"
echo -e "  Environment: ${ENVIRONMENT}"
echo -e "  Timestamp: ${TIMESTAMP}"
echo -e "  Backup: $BACKUP_DIR/app_backup_$TIMESTAMP.tar.gz"
echo -e "  Database Backup: $BACKUP_DIR/db_backup_$TIMESTAMP.sql"
echo ""
echo -e "${GREEN}Next Steps:${NC}"
echo -e "  1. Verify application at: ${BLUE}https://keohams.com${NC}"
echo -e "  2. Check logs: ssh $CPANEL_USER@server.keohams.com 'tail -f $APP_DIR/storage/logs/laravel.log'"
echo -e "  3. Monitor performance: php artisan performance:report"
echo ""
echo -e "${YELLOW}Rollback Command:${NC}"
echo -e "  bash rollback-cpanel.sh $TIMESTAMP"
echo ""
