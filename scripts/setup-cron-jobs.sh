#!/bin/bash

# ===================================================================
# Cron Jobs Setup Script for cPanel
# ===================================================================
# This script helps configure cron jobs for Laravel scheduler
# Usage: bash scripts/setup-cron-jobs.sh
# ===================================================================

echo "╔════════════════════════════════════════════════════════╗"
echo "║           Cron Jobs Setup for KEOHAMS                  ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Detect PHP path
PHP_PATH=$(which php)
if [ -z "$PHP_PATH" ]; then
    PHP_PATH="/usr/bin/php"
fi

# Detect project path
PROJECT_PATH=$(pwd)
if [ ! -f "$PROJECT_PATH/artisan" ]; then
    echo "Error: Not in Laravel project root!"
    exit 1
fi

echo "PHP Path: $PHP_PATH"
echo "Project Path: $PROJECT_PATH"
echo ""

# ===================================================================
# Laravel Scheduler (Required)
# ===================================================================
echo "Laravel Scheduler Cron Job:"
echo "----------------------------"
echo "This runs every minute and executes scheduled tasks."
echo ""
echo "Cron Expression:"
echo "  * * * * * cd $PROJECT_PATH && $PHP_PATH artisan schedule:run >> /dev/null 2>&1"
echo ""

# ===================================================================
# Queue Worker (Recommended)
# ===================================================================
echo "Queue Worker Cron Job (Recommended):"
echo "-------------------------------------"
echo "This ensures queue workers are always running."
echo ""
echo "Cron Expression (every 5 minutes):"
echo "  */5 * * * * cd $PROJECT_PATH && $PHP_PATH artisan queue:restart >> /dev/null 2>&1"
echo ""

# ===================================================================
# Backup Jobs (Optional)
# ===================================================================
echo "Daily Backup Cron Job (Optional):"
echo "----------------------------------"
echo "Daily database backup at 2:00 AM"
echo ""
echo "Cron Expression:"
echo "  0 2 * * * cd $PROJECT_PATH && $PHP_PATH scripts/backup-database.php >> /dev/null 2>&1"
echo ""

# ===================================================================
# Cache Warmup (Optional)
# ===================================================================
echo "Cache Warmup Cron Job (Optional):"
echo "----------------------------------"
echo "Warm up caches every hour"
echo ""
echo "Cron Expression:"
echo "  0 * * * * cd $PROJECT_PATH && $PHP_PATH artisan cache:warmup >> /dev/null 2>&1"
echo ""

# ===================================================================
# Database Optimization (Optional)
# ===================================================================
echo "Database Optimization Cron Job (Optional):"
echo "-------------------------------------------"
echo "Optimize database weekly (Sunday at 3:00 AM)"
echo ""
echo "Cron Expression:"
echo "  0 3 * * 0 cd $PROJECT_PATH && $PHP_PATH artisan db:optimize >> /dev/null 2>&1"
echo ""

# ===================================================================
# Setup Instructions
# ===================================================================
echo "╔════════════════════════════════════════════════════════╗"
echo "║              How to Add Cron Jobs in cPanel            ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "1. Login to cPanel"
echo "2. Navigate to 'Cron Jobs' under 'Advanced' section"
echo "3. Add the cron job expressions above"
echo ""
echo "OR use the following command to edit crontab directly:"
echo "  crontab -e"
echo ""
echo "Then add these lines:"
echo ""
cat << 'EOF'
# Laravel Scheduler (Required)
* * * * * cd /home/ngfaczol/public_html && /usr/bin/php artisan schedule:run >> /dev/null 2>&1

# Queue Worker Restart (Recommended)
*/5 * * * * cd /home/ngfaczol/public_html && /usr/bin/php artisan queue:restart >> /dev/null 2>&1

# Daily Database Backup (Optional)
0 2 * * * cd /home/ngfaczol/public_html && /usr/bin/php scripts/backup-database.php >> /dev/null 2>&1

# Hourly Cache Warmup (Optional)
0 * * * * cd /home/ngfaczol/public_html && /usr/bin/php artisan cache:warmup >> /dev/null 2>&1

# Weekly Database Optimization (Optional)
0 3 * * 0 cd /home/ngfaczol/public_html && /usr/bin/php artisan db:optimize >> /dev/null 2>&1
EOF

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║            Queue Worker Setup (Supervisor)             ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "For better queue management, use Supervisor (if available):"
echo ""
echo "1. Create supervisor config: /etc/supervisor/conf.d/keohams-worker.conf"
echo ""
cat << 'EOF'
[program:keohams-worker]
process_name=%(program_name)s_%(process_num)02d
command=/usr/bin/php /home/ngfaczol/public_html/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=ngfaczol
numprocs=2
redirect_stderr=true
stdout_logfile=/home/ngfaczol/public_html/storage/logs/worker.log
stopwaitsecs=3600
EOF

echo ""
echo "2. Update supervisor:"
echo "  sudo supervisorctl reread"
echo "  sudo supervisorctl update"
echo "  sudo supervisorctl start keohams-worker:*"
echo ""
echo "✓ Cron jobs setup guide completed!"
echo ""
