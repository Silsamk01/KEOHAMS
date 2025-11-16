# KEOHAMS cPanel Deployment Guide

## Prerequisites

Before deploying to cPanel, ensure you have:
- cPanel hosting account with Node.js support (Node.js 18+ recommended)
- SSH access to your server
- MySQL database access
- Redis instance (can use external service like Redis Labs)
- Domain name pointed to your cPanel server

## Step 1: Prepare Your cPanel Environment

### 1.1 Create MySQL Databases

1. Log into cPanel
2. Navigate to **MySQL Databases**
3. Create two databases:
   - `your_cpanel_user_keohams` (main database)
   - `your_cpanel_user_keohams_public_blog` (public blog database)
4. Create a MySQL user with a strong password
5. Add the user to both databases with **ALL PRIVILEGES**
6. Note down:
   - Database names
   - Database username
   - Database password
   - Database host (usually `localhost`)

### 1.2 Set Up Node.js Application

1. Navigate to **Setup Node.js App** in cPanel
2. Click **Create Application**
3. Configure:
   - **Node.js version**: 20.x (or latest available)
   - **Application mode**: Production
   - **Application root**: `keohams/backend` (important: must point to backend folder)
   - **Application URL**: Your domain (e.g., `yourdomain.com`)
   - **Application startup file**: `src/server.js`
4. Click **Create**

**Important Notes:**
- The application root MUST be set to `keohams/backend` (or wherever you placed the backend folder), not just `keohams`
- **Before creating the app**, ensure there is NO `node_modules` folder in your application root (CloudLinux will create it as a symlink)
- If you already created an app with wrong path, you MUST delete it first and create a new one (cPanel cannot move Node.js apps into subdirectories)
- To delete: Click the **Delete** (trash icon) button next to your existing app, then create a new one with correct paths

## Step 2: Upload Your Application

### Option A: Using Git (Recommended)

1. Access SSH terminal in cPanel
2. Navigate to your application root:
   ```bash
   cd ~/keohams
   ```
3. Clone your repository:
   ```bash
   git clone https://github.com/Silsamk01/KEOHAMS.git .
   ```
4. If already cloned, pull latest changes:
   ```bash
   git pull origin main
   ```

5. **IMPORTANT**: Remove `node_modules` folders before creating Node.js app:
   ```bash
   rm -rf ~/keohams/backend/node_modules
   rm -rf ~/keohams/frontend/node_modules
   ```
   *CloudLinux requires `node_modules` to be a symlink to the virtual environment, not a real folder*

### Option B: Using File Manager

1. Compress your KEOHAMS folder into a ZIP file
2. Navigate to **File Manager** in cPanel
3. Go to your application root directory
4. Click **Upload** and upload the ZIP file
5. Right-click the ZIP file and select **Extract**
6. Delete the ZIP file after extraction

7. **IMPORTANT**: Delete `node_modules` folders via File Manager:
   - Navigate to `keohams/backend/`
   - If you see `node_modules` folder, right-click → Delete
   - Navigate to `keohams/frontend/`
   - If you see `node_modules` folder, right-click → Delete
   
   *CloudLinux requires `node_modules` to be a symlink, not a real folder*

## Step 3: Configure Environment Variables

1. Navigate to your `backend` directory:
   ```bash
   cd ~/keohams/backend
   ```

2. Create `.env` file:
   ```bash
   nano .env
   ```

3. Add the following configuration (adjust values for your server):

```env
# App Configuration
PORT=3000
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# MySQL - Main Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_cpanel_user_dbuser
DB_PASSWORD=your_database_password
DB_NAME=your_cpanel_user_keohams

# Public Blog Database
PUBLIC_DB_HOST=localhost
PUBLIC_DB_PORT=3306
PUBLIC_DB_USER=your_cpanel_user_dbuser
PUBLIC_DB_PASSWORD=your_database_password
PUBLIC_DB_NAME=your_cpanel_user_keohams_public_blog

# Email Configuration
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=465
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your_email_password
SMTP_FROM="KEOHAMS <noreply@yourdomain.com>"
SMTP_DEBUG=false
SMTP_AUTH_METHOD=LOGIN

# Admin Account
ADMIN_EMAIL=admin@yourdomain.com

# 2FA
TWOFA_ISSUER=KEOHAMS

# Currency API
EXCHANGE_API_URL=https://api.exchangerate.host/latest
EXCHANGE_BASE=USD

# KYC Encryption (IMPORTANT: Generate a secure 32+ character key)
KYC_ENCRYPTION_KEY=your-secure-32-character-encryption-key-here

# Redis Configuration (use external Redis service)
REDIS_HOST=your-redis-host.com
REDIS_PORT=14922
REDIS_USERNAME=default
REDIS_PASSWORD=your_redis_password
REDIS_DB=0
REDIS_TLS=true

# Cache Control
CACHE_DISABLE=false

# Worker Configuration
KYC_WORKER_CONCURRENCY=2
EMAIL_WORKER_CONCURRENCY=5

# Application URL
APP_URL=https://yourdomain.com

# Paystack Payment Gateway
PAYSTACK_SECRET_KEY=sk_live_your_secret_key
PAYSTACK_PUBLIC_KEY=pk_live_your_public_key

# SMS Provider (Optional)
SMS_PROVIDER=TWILIO
```

4. Save and exit (Ctrl+X, then Y, then Enter)

## Step 4: Install Dependencies

1. In the Node.js App interface in cPanel, click on your application
2. In the terminal that appears, or via SSH:
   ```bash
   cd ~/keohams/backend
   source /home/your_cpanel_user/nodevenv/keohams/backend/20/bin/activate
   npm install --production
   ```

3. Install frontend dependencies (if needed):
   ```bash
   cd ~/keohams/frontend
   npm install --production
   ```

**Important**: The virtual environment path should match your application root (`.../nodevenv/keohams/backend/...`)

## Step 5: Run Database Migrations

1. Ensure you're in the backend directory:
   ```bash
   cd ~/keohams/backend
   source /home/your_cpanel_user/nodevenv/keohams/20/bin/activate
   ```

2. Run migrations:
   ```bash
   npx knex migrate:latest
   ```

3. Verify all 39 migrations ran successfully

## Step 6: Seed Admin Account

1. Create the admin user:
   ```bash
   node scripts/seedAdmin.js admin@yourdomain.com YourStrongPassword123! "Administrator"
   ```

2. Verify admin was created successfully

## Step 7: Configure Web Server

### 7.1 Set Up Reverse Proxy (Apache)

1. Navigate to **File Manager** in cPanel
2. Go to `public_html` directory
3. Create/edit `.htaccess` file:

```apache
# Enable Rewrite Engine
RewriteEngine On

# Force HTTPS (if you have SSL)
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Proxy API requests to Node.js backend
RewriteCond %{REQUEST_URI} ^/api/ [OR]
RewriteCond %{REQUEST_URI} ^/socket.io/
RewriteRule ^(.*)$ http://localhost:3000/$1 [P,L]

# Proxy uploads to backend
RewriteCond %{REQUEST_URI} ^/uploads/
RewriteRule ^(.*)$ http://localhost:3000/$1 [P,L]

# Serve static frontend files
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ /index.html [L]
```

### 7.2 Copy Frontend Files to public_html

1. Copy frontend files:
   ```bash
   cp -r ~/keohams/frontend/public/* ~/public_html/
   cp -r ~/keohams/frontend/pages ~/public_html/
   cp -r ~/keohams/frontend/src ~/public_html/
   cp ~/keohams/keohamlogo.jpg ~/public_html/
   ```

2. Set proper permissions:
   ```bash
   chmod -R 755 ~/public_html
   ```

## Step 8: Start the Application

1. Go back to **Setup Node.js App** in cPanel
2. Click on your application
3. Click **Stop App** if running, then **Start App**
4. Verify the app is running
5. Check application logs for any errors

## Step 9: Set Up SSL Certificate

1. Navigate to **SSL/TLS Status** in cPanel
2. Select your domain
3. Click **Run AutoSSL**
4. Wait for certificate to be issued
5. Verify HTTPS is working

## Step 10: Configure Cron Jobs (Optional but Recommended)

1. Navigate to **Cron Jobs** in cPanel
2. Add the following cron jobs:

**Check Price Drops (Daily at 2 AM)**
```bash
0 2 * * * cd ~/keohams/backend && node -e "require('./src/services/wishlistService').checkPriceDrops()"
```

**Update Exchange Rates (Every 6 hours)**
```bash
0 */6 * * * cd ~/keohams/backend && node -e "require('./src/services/currencyService').updateExchangeRates()"
```

**Clean Old Logs (Weekly on Sunday at 3 AM)**
```bash
0 3 * * 0 find ~/keohams/backend/logs -type f -mtime +30 -delete
```

## Step 11: Configure File Upload Limits

1. Navigate to **Select PHP Version** in cPanel
2. Click **Switch To PHP Options**
3. Increase the following:
   - `upload_max_filesize`: 10M
   - `post_max_size`: 10M
   - `max_execution_time`: 300
   - `memory_limit`: 256M

## Step 12: Set Up Monitoring

### Create Restart Script

1. Create a monitoring script:
   ```bash
   nano ~/keohams/restart-app.sh
   ```

2. Add content:
   ```bash
   #!/bin/bash
   cd ~/keohams/backend
   source /home/your_cpanel_user/nodevenv/keohams/20/bin/activate
   
   # Check if app is running
   if ! pgrep -f "server.js" > /dev/null; then
       echo "App is down. Restarting..."
       npm start
   fi
   ```

3. Make executable:
   ```bash
   chmod +x ~/keohams/restart-app.sh
   ```

4. Add cron job (every 5 minutes):
   ```bash
   */5 * * * * ~/keohams/restart-app.sh >> ~/keohams/monitor.log 2>&1
   ```

## Troubleshooting

### Application Won't Start

1. Check logs:
   ```bash
   cd ~/keohams/backend
   tail -f logs/error.log
   ```

2. Check Node.js app logs in cPanel

3. Verify environment variables:
   ```bash
   cat .env
   ```

### CloudLinux Node.js Selector Errors

**Error**: "Application should not contain folder/file with such name in application root"

**Solution**: Remove `node_modules` folder before creating the app:
```bash
cd ~/keohams/backend
rm -rf node_modules
```

Then delete and recreate the Node.js app in cPanel. CloudLinux will create `node_modules` as a symlink to the virtual environment automatically.

### Database Connection Issues

1. Verify database credentials in `.env`
2. Test connection:
   ```bash
   mysql -u your_db_user -p your_db_name
   ```

3. Ensure database user has proper privileges

### 502 Bad Gateway

1. Check if Node.js app is running in cPanel
2. Verify port 3000 is not blocked
3. Check `.htaccess` proxy rules
4. Review Apache error logs

### Permission Denied Errors

1. Fix file permissions:
   ```bash
   chmod -R 755 ~/keohams
   chmod -R 777 ~/keohams/backend/uploads
   chmod -R 777 ~/keohams/backend/logs
   ```

### Redis Connection Failed

1. Verify Redis credentials in `.env`
2. Test connection:
   ```bash
   redis-cli -h your-redis-host -p 14922 -a your_password ping
   ```

3. Consider using external Redis service (Redis Labs, Upstash)

## Performance Optimization

### Enable Gzip Compression

Add to `.htaccess`:
```apache
# Enable Gzip Compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>
```

### Enable Browser Caching

Add to `.htaccess`:
```apache
# Enable Browser Caching
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/gif "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
</IfModule>
```

### Use PM2 for Process Management (If SSH Access)

1. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```

2. Start app with PM2:
   ```bash
   cd ~/keohams/backend
   pm2 start src/server.js --name keohams
   pm2 save
   pm2 startup
   ```

## Security Checklist

- ✅ Change all default passwords
- ✅ Use strong JWT_SECRET (64+ characters)
- ✅ Generate unique KYC_ENCRYPTION_KEY
- ✅ Enable HTTPS/SSL
- ✅ Set NODE_ENV=production
- ✅ Disable SMTP_DEBUG in production
- ✅ Use Paystack live keys (not test keys)
- ✅ Restrict database user privileges
- ✅ Set proper file permissions (755 for directories, 644 for files)
- ✅ Enable firewall on server
- ✅ Keep Node.js and dependencies updated
- ✅ Regular database backups
- ✅ Monitor application logs

## Maintenance

### Update Application

1. SSH into server:
   ```bash
   cd ~/keohams
   git pull origin main
   ```

2. Update dependencies:
   ```bash
   cd backend
   source /home/your_cpanel_user/nodevenv/keohams/20/bin/activate
   npm install --production
   ```

3. Run new migrations:
   ```bash
   npx knex migrate:latest
   ```

4. Restart application in cPanel

### Backup Database

1. Use cPanel **Backup** feature, or:
   ```bash
   mysqldump -u your_db_user -p your_db_name > backup_$(date +%Y%m%d).sql
   ```

### Monitor Logs

```bash
# Application logs
tail -f ~/keohams/backend/logs/app.log

# Error logs
tail -f ~/keohams/backend/logs/error.log

# Access logs
tail -f ~/access-logs/yourdomain.com
```

## Support

For issues specific to:
- **cPanel**: Contact your hosting provider
- **KEOHAMS Application**: Check GitHub repository issues
- **Paystack Integration**: Refer to Paystack documentation
- **Redis**: Check Redis Labs documentation

## Additional Resources

- [cPanel Node.js Documentation](https://docs.cpanel.net/knowledge-base/web-services/guide-to-node.js/)
- [Knex.js Migrations](http://knexjs.org/guide/migrations.html)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Paystack API Documentation](https://paystack.com/docs/api/)

---

**Last Updated**: November 15, 2025  
**KEOHAMS Version**: 1.0.0 (13 Production Features Complete)
