# cPanel Deployment Guide for KEOHAMS Laravel Application

**Complete guide for deploying the KEOHAMS e-commerce platform to cPanel hosting**

Version: 1.0  
Last Updated: November 16, 2025  
Laravel Version: 10.49.1  
PHP Version: 8.4.14

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Server Requirements](#server-requirements)
3. [Deployment Methods](#deployment-methods)
4. [Step-by-Step Deployment](#step-by-step-deployment)
5. [Environment Configuration](#environment-configuration)
6. [Database Setup](#database-setup)
7. [File Permissions](#file-permissions)
8. [Cron Jobs Configuration](#cron-jobs-configuration)
9. [Queue Workers Setup](#queue-workers-setup)
10. [SSL Configuration](#ssl-configuration)
11. [Post-Deployment Verification](#post-deployment-verification)
12. [Performance Optimization](#performance-optimization)
13. [Troubleshooting](#troubleshooting)
14. [Rollback Procedures](#rollback-procedures)
15. [Maintenance Mode](#maintenance-mode)

---

## Pre-Deployment Checklist
/home/ngfaczol/public_html/
├── .htaccess                    ← ROOT .htaccess (just created)
├── index.html                   ← Frontend landing page
├── pages/                       ← Frontend HTML pages
│   ├── dashboard.html
│   ├── shop.html
│   └── ...
├── js/                          ← Frontend JavaScript
│   └── api.js
├── css/                         ← Frontend CSS
├── public/                      ← Laravel public directory
│   ├── .htaccess               ← Laravel's .htaccess
│   └── index.php               ← Laravel entry point
├── app/                         ← Laravel app code
├── config/                      ← Laravel config
├── routes/                      ← Laravel routes
└── ... (all Laravel folders)
### ✅ Before You Deploy


Enable Git Version Control in cPanel:

Login to cPanel
Go to Git™ Version Control
Click Create to set up a repository
Or use SSH to initialize Git on server:

Or use SSH to initialize Git on server:

ssh -p 21098 ngfaczol@keohams.com
cd ~/keohams.com
git init
git remote add origin https://github.com/Silsamk01/KEOHAMS.git


Push from VS Code:
In VS Code terminal (PowerShell):


# Add server as remote
git remote add cpanel ssh://ngfaczol@keohams.com:21098/~/keohams.com

# Push to server
git push cpanel main



















**Local Testing:**
- [ ] All tests passing (`php vendor/bin/phpunit`)
- [ ] No errors in logs (`storage/logs/laravel.log`)
- [ ] Database migrations tested
- [ ] Assets compiled (`npm run production`)
- [ ] Environment variables configured

**Server Preparation:**
- [ ] SSH access confirmed
- [ ] PHP 8.1+ available
- [ ] Composer installed
- [ ] MySQL databases created
- [ ] Redis service available
- [ ] Domain DNS configured

**Credentials Ready:**
- [ ] cPanel username/password
- [ ] Database credentials
- [ ] Redis credentials
- [ ] SMTP credentials
- [ ] Paystack API keys

**Backup:**
- [ ] Current database backed up
- [ ] Current files backed up
- [ ] .env file saved securely

---

## Server Requirements

### Minimum Requirements

**PHP Version:**
- PHP 8.1 or higher (8.4.14 recommended)

**PHP Extensions Required:**
```
BCMath
Ctype
cURL
DOM
Fileinfo
JSON
Mbstring
OpenSSL
PDO
PDO_MySQL
Tokenizer
XML
Redis
GD or Imagick
```

**Server Resources:**
- **Memory:** 512MB minimum (2GB recommended)
- **Disk Space:** 1GB minimum
- **MySQL:** 8.0 or higher
- **Redis:** 7.0 or higher

**Web Server:**
- Apache 2.4+ with mod_rewrite enabled
- Or Nginx 1.18+

### Checking PHP Version

```bash
php -v
```

Expected output:
```
PHP 8.4.14 (cli) (built: Oct 23 2024 15:15:15) ( NTS )
```

### Checking PHP Extensions

```bash
php -m | grep -E "bcmath|ctype|curl|dom|fileinfo|json|mbstring|openssl|pdo|pdo_mysql|tokenizer|xml|redis"
```

### Verifying Composer

```bash
composer --version
```

Expected output:
```
Composer version 2.x.x
```

---

## Deployment Methods

### Method 1: Git-Based Deployment (Recommended)

**Pros:**
- Automated deployment
- Version control
- Easy rollback
- Minimal downtime

**Setup:**
1. Enable Git Version Control in cPanel
2. Add `.cpanel.yml` to repository
3. Push to deploy

**File: `.cpanel.yml`**
```yaml
---
deployment:
  tasks:
    - export DEPLOYPATH=/home/ngfaczol/
    - /bin/cp -R * $DEPLOYPATH
    - cd $DEPLOYPATH
    - composer install --no-dev --optimize-autoloader
    - php artisan migrate --force
    - php artisan config:cache
    - php artisan route:cache
    - php artisan view:cache
```

### Method 2: Automated SSH Deployment

**Pros:**
- Fully automated
- Pre-deployment checks
- Automatic backup
- Health verification

**Usage:**
```bash
bash deploy-cpanel.sh production
```

**Features:**
- ✅ Pre-deployment validation
- ✅ Automatic backup
- ✅ Code upload via rsync/scp
- ✅ Database migration
- ✅ Cache optimization
- ✅ Health check verification
- ✅ Rollback on failure

### Method 3: Manual FTP/File Manager

**Pros:**
- No SSH required
- Simple process
- Full control

**Cons:**
- More time-consuming
- Manual steps required
- Higher error risk

**Best for:**
- Initial deployment
- Small updates
- Emergency fixes

---

## Step-by-Step Deployment

### Automated Deployment (Recommended)

**1. Prepare Deployment Package:**

```bash
# On your local machine
cd /path/to/laravel

# Run deployment script
bash deploy-cpanel.sh production
```

The script will:
1. ✅ Validate environment
2. ✅ Run tests
3. ✅ Build assets
4. ✅ Create backup
5. ✅ Upload files
6. ✅ Install dependencies
7. ✅ Run migrations
8. ✅ Optimize caches
9. ✅ Verify deployment
10. ✅ Run health checks

**2. Monitor Deployment:**

The script provides real-time output:
```
[DEPLOY] Starting deployment to production...
[DEPLOY] ✓ Pre-deployment checks passed
[DEPLOY] ✓ Tests passed
[DEPLOY] ✓ Assets compiled
[DEPLOY] ✓ Backup created: backup-20251116-143022.tar.gz
[DEPLOY] ✓ Files uploaded
[DEPLOY] ✓ Dependencies installed
[DEPLOY] ✓ Migrations completed
[DEPLOY] ✓ Caches optimized
[DEPLOY] ✓ Health checks passed
[DEPLOY] Deployment completed successfully!
```

### Manual Deployment

**Step 1: Upload Files**

Using File Manager or FTP:

```
Source: /local/laravel/
Destination: /home/ngfaczol/public_html/
```

**Upload:**
- All files and folders
- **Exclude:** `node_modules/`, `.git/`, `.env`, `vendor/`

**Step 2: SSH into Server**

```bash
ssh ngfaczol@keohams.com -p 21098
```

**Step 3: Navigate to Directory**

```bash
cd /home/ngfaczol/public_html
```

**Step 4: Install Composer Dependencies**

```bash
composer install --no-dev --optimize-autoloader
```

**Step 5: Create Environment File**

```bash
cp .env.production.example .env
nano .env
```

Configure all environment variables (see [Environment Configuration](#environment-configuration))

**Step 6: Generate Application Key**

```bash
php artisan key:generate
```

**Step 7: Set Permissions**

```bash
chmod -R 755 .
chmod -R 775 storage bootstrap/cache
chown -R ngfaczol:ngfaczol storage bootstrap/cache
```

**Step 8: Create Storage Link**

```bash
php artisan storage:link
```

**Step 9: Run Database Migrations**

```bash
php artisan migrate --force
```

**Step 10: Seed Database (First Deployment Only)**

```bash
php artisan db:seed
```

**Step 11: Optimize Application**

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan optimize
```

**Step 12: Set Document Root**

In cPanel:
1. Go to **Domains**
2. Click **Manage** for your domain
3. Set **Document Root** to: `/home/ngfaczol/public_html/public`

**Alternative: .htaccess Redirect**

If you can't change document root, add to root `.htaccess`:

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteRule ^(.*)$ public/$1 [L]
</IfModule>
```

---

## Environment Configuration

### Production .env File

Create `.env` file in project root:

```env
# Application
APP_NAME=KEOHAMS
APP_ENV=production
APP_KEY=base64:your_generated_key_here
APP_DEBUG=false
APP_URL=https://keohams.com

# Database - Main
DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=ngfaczol_keohams
DB_USERNAME=ngfaczol_keohams
DB_PASSWORD=your_database_password

# Database - Public Blog
PUBLIC_DB_CONNECTION=mysql
PUBLIC_DB_HOST=localhost
PUBLIC_DB_PORT=3306
PUBLIC_DB_DATABASE=ngfaczol_keohams_public_blog
PUBLIC_DB_USERNAME=ngfaczol_keohams_public_blog
PUBLIC_DB_PASSWORD=your_blog_database_password

# Redis Cache & Queue
CACHE_DRIVER=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis

REDIS_HOST=redis-14922.c81.us-east-1-2.ec2.cloud.redislabs.com
REDIS_PORT=14922
REDIS_PASSWORD=cTEkPz7F9DCqe7HBEpnmHBLouUlAofUB
REDIS_CLIENT=phpredis

# Email (SMTP)
MAIL_MAILER=smtp
MAIL_HOST=server165.web-hosting.com
MAIL_PORT=465
MAIL_USERNAME=noreply@keohams.com
MAIL_PASSWORD=your_email_password
MAIL_ENCRYPTION=ssl
MAIL_FROM_ADDRESS=noreply@keohams.com
MAIL_FROM_NAME="${APP_NAME}"

# Paystack (Production Keys)
PAYSTACK_PUBLIC_KEY=pk_live_your_public_key
PAYSTACK_SECRET_KEY=sk_live_your_secret_key
PAYSTACK_PAYMENT_URL=https://api.paystack.co

# File Upload
FILESYSTEM_DISK=public
MAX_UPLOAD_SIZE=10240

# Session
SESSION_LIFETIME=120
SESSION_ENCRYPT=true
SESSION_COOKIE=keohams_session
SESSION_SECURE_COOKIE=true

# Logging
LOG_CHANNEL=daily
LOG_LEVEL=error
LOG_DAYS=14

# Broadcasting
BROADCAST_DRIVER=log

# Asset URL (if using CDN)
ASSET_URL=https://keohams.com

# Trusted Proxies (for cPanel)
TRUSTED_PROXIES=*
```

### Security Notes

**Important:**
- Never commit `.env` to Git
- Keep `APP_DEBUG=false` in production
- Use strong `APP_KEY`
- Use production Paystack keys
- Enable `SESSION_SECURE_COOKIE=true` with SSL
- Set `LOG_LEVEL=error` in production

---

## Database Setup

### Creating Databases in cPanel

**1. Login to cPanel**
- URL: https://keohams.com:2083
- Username: ngfaczol
- Password: [your cPanel password]

**2. Navigate to MySQL Databases**

**3. Create Main Database**
- Database Name: `ngfaczol_keohams`
- Click **Create Database**

**4. Create Public Blog Database**
- Database Name: `ngfaczol_keohams_public_blog`
- Click **Create Database**

**5. Create Database Users**

Create user for main database:
- Username: `ngfaczol_keohams`
- Password: [strong password]
- Click **Create User**

Create user for blog database:
- Username: `ngfaczol_keohams_public_blog`
- Password: [strong password]
- Click **Create User**

**6. Grant Privileges**

For each database:
- Select User
- Select Database
- Grant **ALL PRIVILEGES**
- Click **Add**

### Import Existing Data (Optional)

**Via cPanel phpMyAdmin:**

1. Open phpMyAdmin
2. Select database
3. Click **Import**
4. Choose SQL file
5. Click **Go**

**Via SSH:**

```bash
mysql -u ngfaczol_keohams -p ngfaczol_keohams < keohams.sql
mysql -u ngfaczol_keohams_public_blog -p ngfaczol_keohams_public_blog < keohams_public_blog.sql
```

### Running Migrations

**Fresh Installation:**

```bash
php artisan migrate --force
```

**Update Existing:**

```bash
php artisan migrate --force
```

**Rollback (if needed):**

```bash
php artisan migrate:rollback --step=1
```

**Check Migration Status:**

```bash
php artisan migrate:status
```

---

## File Permissions

### Correct Permissions

**Set Permissions:**

```bash
# Navigate to project root
cd /home/ngfaczol/public_html

# Set directory permissions
find . -type d -exec chmod 755 {} \;

# Set file permissions
find . -type f -exec chmod 644 {} \;

# Set storage and cache directories
chmod -R 775 storage bootstrap/cache

# Set owner
chown -R ngfaczol:ngfaczol .

# Make scripts executable
chmod +x artisan
chmod +x deploy-cpanel.sh
chmod +x rollback-cpanel.sh
```

### Permission Structure

```
/home/ngfaczol/public_html/
├── storage/          (775 - writable)
│   ├── app/          (775)
│   ├── framework/    (775)
│   └── logs/         (775)
├── bootstrap/cache/  (775 - writable)
├── public/           (755)
└── [other files]     (644)
```

### Troubleshooting Permission Issues

**Error: "The stream or file could not be opened"**

```bash
chmod -R 775 storage
chown -R ngfaczol:ngfaczol storage
```

**Error: "failed to open stream: Permission denied"**

```bash
chmod -R 775 bootstrap/cache
chown -R ngfaczol:ngfaczol bootstrap/cache
```

---

## Cron Jobs Configuration

### Laravel Scheduler

**Add to cPanel Cron Jobs:**

1. Open **Cron Jobs** in cPanel
2. Add new cron job:

```
* * * * * cd /home/ngfaczol/public_html && /usr/local/bin/php artisan schedule:run >> /dev/null 2>&1
```

**Explanation:**
- `* * * * *` - Runs every minute
- `cd /home/ngfaczol/public_html` - Navigate to project
- `/usr/local/bin/php` - Full path to PHP
- `artisan schedule:run` - Run Laravel scheduler
- `>> /dev/null 2>&1` - Suppress output

### Finding PHP Path

```bash
which php
```

Or:

```bash
whereis php
```

Common paths:
- `/usr/local/bin/php`
- `/usr/bin/php`
- `/opt/cpanel/ea-php84/root/usr/bin/php`

### Additional Cron Jobs (Optional)

**Database Backup (Daily at 2 AM):**

```
0 2 * * * cd /home/ngfaczol/public_html && /usr/local/bin/php scripts/backup-database.php >> /dev/null 2>&1
```

**Queue Worker Monitor (Every 5 minutes):**

```
*/5 * * * * cd /home/ngfaczol/public_html && /usr/local/bin/php artisan queue:work --stop-when-empty >> /dev/null 2>&1
```

**Clear Old Logs (Weekly):**

```
0 3 * * 0 cd /home/ngfaczol/public_html && /usr/local/bin/php artisan log:clear --days=30 >> /dev/null 2>&1
```

### Verifying Cron Jobs

**List all cron jobs:**

```bash
crontab -l
```

**Check if scheduler is running:**

```bash
php artisan schedule:list
```

---

## Queue Workers Setup

### Using Supervisor (Recommended)

**1. Create Supervisor Config:**

File: `/etc/supervisor/conf.d/keohams-queues.conf`

```ini
[program:keohams-worker]
process_name=%(program_name)s_%(process_num)02d
command=/usr/local/bin/php /home/ngfaczol/public_html/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=ngfaczol
numprocs=2
redirect_stderr=true
stdout_logfile=/home/ngfaczol/public_html/storage/logs/worker.log
stopwaitsecs=3600
```

**2. Start Supervisor:**

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start keohams-worker:*
```

**3. Check Status:**

```bash
sudo supervisorctl status keohams-worker:*
```

### Using Cron (Alternative)

If Supervisor is not available, use cron:

```
*/5 * * * * cd /home/ngfaczol/public_html && /usr/local/bin/php artisan queue:work --stop-when-empty --max-jobs=50 --max-time=300 >> /dev/null 2>&1
```

### Manual Queue Processing (Development)

```bash
# Process all queued jobs
php artisan queue:work

# Process with options
php artisan queue:work redis --sleep=3 --tries=3 --timeout=60

# Process once and exit
php artisan queue:work --once

# List failed jobs
php artisan queue:failed

# Retry failed job
php artisan queue:retry [job-id]

# Retry all failed jobs
php artisan queue:retry all
```

### Monitoring Queue

**Check queue status:**

```bash
php artisan queue:monitor
```

**View failed jobs:**

```bash
php artisan queue:failed
```

**Clear all failed jobs:**

```bash
php artisan queue:flush
```

---

## SSL Configuration

### Installing SSL Certificate

**Method 1: Let's Encrypt (Free)**

1. Login to cPanel
2. Go to **SSL/TLS Status**
3. Find domain: `keohams.com`
4. Click **Run AutoSSL**
5. Wait for completion

**Method 2: Manual Certificate**

1. Go to **SSL/TLS**
2. Click **Manage SSL Sites**
3. Select domain
4. Paste Certificate, Private Key, CA Bundle
5. Click **Install Certificate**

### Forcing HTTPS

**File: `public/.htaccess`**

Add after `RewriteEngine On`:

```apache
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST%}$1 [R=301,L]
```

**Full .htaccess:**

```apache
<IfModule mod_rewrite.c>
    <IfModule mod_negotiation.c>
        Options -MultiViews -Indexes
    </IfModule>

    RewriteEngine On

    # Force HTTPS
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]

    # Handle Authorization Header
    RewriteCond %{HTTP:Authorization} .
    RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]

    # Redirect Trailing Slashes
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_URI} (.+)/$
    RewriteRule ^ %1 [L,R=301]

    # Send Requests To Front Controller
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^ index.php [L]
</IfModule>
```

### Verify SSL

```bash
# Check SSL certificate
openssl s_client -connect keohams.com:443

# Check SSL grade
# Visit: https://www.ssllabs.com/ssltest/
```

---

## Post-Deployment Verification

### Health Check Script

```bash
php scripts/health-check.php
```

**Expected Output:**

```
KEOHAMS Health Check
==================

✓ Database Connection: OK
✓ Redis Connection: OK
✓ Storage Writable: OK
✓ Cache Working: OK
✓ Queue Working: OK
✓ Email Configuration: OK
✓ Environment: production
✓ Debug Mode: OFF
✓ SSL: ENABLED
✓ Migrations: UP TO DATE

All systems operational!
```

### Manual Verification

**1. Check Homepage:**
```
https://keohams.com
```

**2. Check Admin Panel:**
```
https://keohams.com/admin
```

**3. Test API:**
```bash
curl https://keohams.com/api/health
```

**4. Check Logs:**
```bash
tail -f storage/logs/laravel.log
```

**5. Verify Database:**
```bash
php artisan tinker
>>> DB::connection()->getPdo();
```

**6. Verify Cache:**
```bash
php artisan tinker
>>> Cache::put('test', 'value', 60);
>>> Cache::get('test');
```

**7. Test Queue:**
```bash
php artisan queue:work --once
```

**8. Check Cron:**
```bash
php artisan schedule:list
```

---

## Performance Optimization

### OPcache Configuration

**File: `php.ini` or `.user.ini`**

```ini
opcache.enable=1
opcache.memory_consumption=256
opcache.interned_strings_buffer=16
opcache.max_accelerated_files=10000
opcache.revalidate_freq=2
opcache.fast_shutdown=1
opcache.enable_cli=1
opcache.save_comments=1
opcache.validate_timestamps=0
```

**Preload (PHP 7.4+):**

```ini
opcache.preload=/home/ngfaczol/public_html/preload.php
opcache.preload_user=ngfaczol
```

### Database Optimization

```bash
# Optimize tables
php artisan db:optimize

# Index optimization
php artisan db:index-check
```

### Cache Optimization

```bash
# Clear all caches
php artisan optimize:clear

# Optimize application
php artisan optimize

# Cache configuration
php artisan config:cache

# Cache routes
php artisan route:cache

# Cache views
php artisan view:cache
```

### Asset Optimization

```bash
# Compile production assets
npm run production

# Minify assets
npm run build

# Verify compiled assets
ls -lh public/js/
ls -lh public/css/
```

### Gzip Compression

**File: `public/.htaccess`**

Add:

```apache
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>
```

### Browser Caching

**File: `public/.htaccess`**

Add:

```apache
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/webp "access plus 1 year"
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
    ExpiresByType application/pdf "access plus 1 month"
</IfModule>
```

---

## Troubleshooting

### Common Issues

**Issue 1: 500 Internal Server Error**

**Solution:**
```bash
# Check error log
tail -f storage/logs/laravel.log

# Check Apache error log
tail -f /var/log/apache2/error.log

# Fix permissions
chmod -R 775 storage bootstrap/cache

# Clear cache
php artisan cache:clear
php artisan config:clear
```

**Issue 2: Database Connection Failed**

**Solution:**
```bash
# Test connection
php artisan tinker
>>> DB::connection()->getPdo();

# Check credentials in .env
# Verify database exists in cPanel
# Check if user has privileges
```

**Issue 3: Queue Jobs Not Processing**

**Solution:**
```bash
# Check queue worker
ps aux | grep queue:work

# Restart worker
php artisan queue:restart

# Check failed jobs
php artisan queue:failed

# Retry failed jobs
php artisan queue:retry all
```

**Issue 4: Redis Connection Failed**

**Solution:**
```bash
# Test Redis
php artisan tinker
>>> Redis::ping();

# Check Redis credentials in .env
# Verify Redis service is running
# Test connection: redis-cli -h host -p port -a password
```

**Issue 5: Assets Not Loading**

**Solution:**
```bash
# Recreate storage link
php artisan storage:link

# Check public directory
ls -la public/storage

# Verify asset compilation
npm run production
```

**Issue 6: Email Not Sending**

**Solution:**
```bash
# Test email config
php artisan tinker
>>> Mail::raw('Test', function($msg) { $msg->to('test@example.com')->subject('Test'); });

# Check SMTP credentials in .env
# Verify SMTP port is open
# Check mail logs
```

### Debug Mode (Emergency Only)

**Enable debug mode:**

1. Edit `.env`
2. Set `APP_DEBUG=true`
3. Run `php artisan config:clear`
4. Reproduce error
5. Check error details
6. **IMPORTANT:** Set `APP_DEBUG=false` when done

### Getting Support

**Collect Information:**

```bash
# Laravel version
php artisan --version

# PHP version
php -v

# System info
php artisan about

# Check logs
tail -100 storage/logs/laravel.log

# Check permissions
ls -la storage
ls -la bootstrap/cache
```

**Contact Support:**
- Email: Ohamskenneth08@gmail.com
- Include: Error message, logs, steps to reproduce

---

## Rollback Procedures

### Automatic Rollback

**Using rollback script:**

```bash
bash rollback-cpanel.sh
```

**Select backup to restore:**
```
Available backups:
1. backup-20251116-143022.tar.gz (2 hours ago)
2. backup-20251116-100000.tar.gz (6 hours ago)
3. backup-20251115-143022.tar.gz (1 day ago)

Enter backup number to restore: 1
```

The script will:
1. ✅ Verify backup file
2. ✅ Create pre-rollback backup
3. ✅ Stop services
4. ✅ Restore files
5. ✅ Restore database
6. ✅ Clear caches
7. ✅ Restart services
8. ✅ Verify health

### Manual Rollback

**Step 1: Backup Current State**

```bash
php scripts/backup-database.php
tar -czf emergency-backup.tar.gz .
```

**Step 2: Restore Files**

```bash
# Extract backup
tar -xzf backup-20251116-143022.tar.gz -C /home/ngfaczol/public_html/

# Set permissions
chmod -R 755 /home/ngfaczol/public_html
chmod -R 775 storage bootstrap/cache
```

**Step 3: Restore Database**

```bash
php scripts/restore-database.php backup-20251116-143022.sql
```

Or manually:

```bash
mysql -u ngfaczol_keohams -p ngfaczol_keohams < backup-20251116-143022.sql
```

**Step 4: Clear Caches**

```bash
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear
```

**Step 5: Verify**

```bash
php scripts/health-check.php
```

### Rollback Checklist

- [ ] Backup created before rollback
- [ ] Files restored successfully
- [ ] Database restored successfully
- [ ] Permissions set correctly
- [ ] Caches cleared
- [ ] Health check passed
- [ ] Application accessible
- [ ] No errors in logs

---

## Maintenance Mode

### Enable Maintenance Mode

**Basic:**

```bash
php artisan down
```

**With Message:**

```bash
php artisan down --message="Upgrading database. Back in 10 minutes."
```

**With Secret Bypass:**

```bash
php artisan down --secret="keohams-2025"
```

Access via: `https://keohams.com/keohams-2025`

**With Retry After:**

```bash
php artisan down --retry=60
```

**With Allowed IPs:**

```bash
php artisan down --allow=123.45.67.89 --allow=98.76.54.32
```

### Disable Maintenance Mode

```bash
php artisan up
```

### Custom Maintenance Page

**File: `resources/views/errors/503.blade.php`**

```html
<!DOCTYPE html>
<html>
<head>
    <title>Maintenance Mode</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
        }
        h1 { color: #333; }
    </style>
</head>
<body>
    <h1>🔧 We'll be right back!</h1>
    <p>KEOHAMS is currently undergoing scheduled maintenance.</p>
    <p>We'll be back online shortly. Thank you for your patience!</p>
</body>
</html>
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Tests passing locally
- [ ] Database backed up
- [ ] Files backed up
- [ ] .env configured
- [ ] Assets compiled
- [ ] Credentials verified
- [ ] Maintenance notice sent (if major update)

### During Deployment

- [ ] Enable maintenance mode
- [ ] Upload files
- [ ] Install dependencies
- [ ] Run migrations
- [ ] Clear caches
- [ ] Optimize application
- [ ] Set permissions

### Post-Deployment

- [ ] Disable maintenance mode
- [ ] Run health checks
- [ ] Test critical features
- [ ] Monitor error logs
- [ ] Verify email sending
- [ ] Test payment processing
- [ ] Check queue processing
- [ ] Verify cron jobs

### Monitoring (First 24 Hours)

- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Verify user registrations
- [ ] Test checkout process
- [ ] Monitor queue jobs
- [ ] Check database performance
- [ ] Verify email delivery

---

## Best Practices

### Security

1. **Never expose `.env` file**
2. **Keep `APP_DEBUG=false` in production**
3. **Use strong passwords**
4. **Enable SSL/HTTPS**
5. **Regular security updates**
6. **Monitor failed login attempts**
7. **Regular backups**

### Performance

1. **Enable OPcache**
2. **Use Redis for cache and sessions**
3. **Optimize database queries**
4. **Enable Gzip compression**
5. **Use CDN for assets**
6. **Minify CSS/JS**
7. **Optimize images**

### Maintenance

1. **Daily automated backups**
2. **Weekly log cleanup**
3. **Monthly security audits**
4. **Regular dependency updates**
5. **Monitor disk space**
6. **Database optimization**
7. **Review error logs**

---

## Quick Reference

### Essential Commands

```bash
# Clear all caches
php artisan optimize:clear

# Optimize application
php artisan optimize

# Run migrations
php artisan migrate --force

# Create backup
php scripts/backup-database.php

# Health check
php scripts/health-check.php

# Enable maintenance
php artisan down

# Disable maintenance
php artisan up

# Queue worker
php artisan queue:work

# View logs
tail -f storage/logs/laravel.log
```

### Important Paths

```
Project Root:     /home/ngfaczol/public_html/
Public Directory: /home/ngfaczol/public_html/public/
Storage:          /home/ngfaczol/public_html/storage/
Logs:             /home/ngfaczol/public_html/storage/logs/
Uploads:          /home/ngfaczol/public_html/storage/app/public/
Backups:          /home/ngfaczol/backups/
```

### Support Contacts

**Developer:** Kenneth Ohams  
**Email:** Ohamskenneth08@gmail.com  
**Website:** https://keohams.com  
**GitHub:** https://github.com/Silsamk01/KEOHAMS

---

**Deployment Guide Version:** 1.0  
**Last Updated:** November 16, 2025  
**Laravel Version:** 10.49.1  
**PHP Version:** 8.4.14

© 2025 KEOHAMS. All rights reserved.
