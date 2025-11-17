# SQL Database Deployment Guide

**Date:** November 17, 2025  
**Purpose:** Deploy updated database schema to cPanel production server

---

## Overview

The local SQL files (`keohams.sql` and `keohams_public_blog.sql`) are already in sync with the production database. All migrations have been successfully applied on the server.

**Current Status:**
- ✅ All 42 migrations completed on production (keohams.com)
- ✅ Database schema fully updated with all new features
- ✅ Authentication tables properly configured
- ✅ No SQL files need to be re-uploaded

---

## What Was Fixed

### Backend Fixes (Already Deployed)
1. ✅ Created `app/Http/Controllers/CaptchaController.php`
2. ✅ Created `app/Http/Controllers/CurrencyController.php`
3. ✅ Fixed `app/Http/Controllers/AuthController.php` (2FA columns, verify2FA, email verification)
4. ✅ Updated `routes/api.php` (added captcha and currency routes)
5. ✅ All migration files fixed and applied

### Frontend Fixes (Need to Deploy)
1. ✅ Fixed navigation styling in `/pages/register.html`
2. ✅ Fixed navigation styling in `/pages/about.html`
3. ✅ Fixed navigation styling in `/pages/contact.html`
4. ✅ Fixed sign-in modal in `index.html` (captcha handling)
5. ✅ Fixed `/js/main.js` (login flow, 2FA verification, captcha display)

---

## Deployment Steps

### Step 1: Upload Updated Frontend Files

Upload these files to cPanel via FTP/SFTP:

```bash
# Connect to server
ssh -p 21098 ngfaczol@68.65.122.49

# Navigate to website root
cd ~/keohams.com/

# Upload files (from local machine using WinSCP, FileZilla, or command):
# - pages/register.html
# - pages/about.html
# - pages/contact.html
# - js/main.js
```

**Using SFTP from VS Code Terminal (Windows):**
```powershell
# Install WinSCP if not already installed
# Download from: https://winscp.net/

# Or use PowerShell SFTP:
$session = New-Object WinSCP.SessionOptions
$session.Protocol = [WinSCP.Protocol]::Sftp
$session.HostName = "68.65.122.49"
$session.PortNumber = 21098
$session.UserName = "ngfaczol"
$session.Password = "YOUR_PASSWORD"

# Then transfer files:
# pages/register.html -> ~/keohams.com/pages/register.html
# pages/about.html -> ~/keohams.com/pages/about.html
# pages/contact.html -> ~/keohams.com/pages/contact.html
# js/main.js -> ~/keohams.com/js/main.js
```

### Step 2: Deploy Backend Controllers (If Not Already Done)

```bash
# SSH into server
ssh -p 21098 ngfaczol@68.65.122.49

# Navigate to Laravel directory
cd ~/keohams.com

# Upload new controllers via SFTP:
# app/Http/Controllers/CaptchaController.php
# app/Http/Controllers/CurrencyController.php

# Clear cache
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

# Rebuild cache
php artisan config:cache
php artisan route:cache
```

### Step 3: Verify Routes

```bash
# SSH into server
ssh -p 21098 ngfaczol@68.65.122.49
cd ~/keohams.com

# Check that new routes exist
php artisan route:list | grep -E 'captcha|currency'

# Expected output:
# GET|HEAD  v1/captcha .............. captcha.generate
# POST      v1/captcha/verify ....... captcha.verify
# GET|HEAD  v1/currency/rates ....... currency.rates
# POST      v1/currency/convert ..... currency.convert
```

### Step 4: Test Authentication Flow

**Test Registration:**
1. Go to https://keohams.com/pages/register
2. Fill out form
3. Submit registration
4. Check email for verification link
5. Verify email works

**Test Login without 2FA:**
1. Go to https://keohams.com/
2. Click "Sign In"
3. Enter credentials
4. Verify captcha displays properly
5. Submit login
6. Should redirect to dashboard

**Test Login with 2FA:**
1. Enable 2FA for test account (in dashboard settings)
2. Log out
3. Click "Sign In" on homepage
4. Enter credentials
5. Verify captcha
6. Submit - should show 2FA code input
7. Enter 6-digit code from email
8. Should redirect to dashboard

**Test Navigation Links:**
1. Visit https://keohams.com/pages/about
2. Verify navbar shows: About, Contact, Blog, Shop, Sign In
3. Click each link to verify they work
4. Repeat for /pages/contact and /pages/register

### Step 5: Monitor Logs

```bash
# SSH into server
ssh -p 21098 ngfaczol@68.65.122.49
cd ~/keohams.com

# Watch error logs
tail -f storage/logs/laravel.log

# Check for any errors during testing
# Look for:
# - Captcha generation errors
# - Currency API errors
# - Login/2FA errors
# - Email sending errors
```

---

## Database Schema Status

### Current Production Schema (Already Applied)

**Users Table - 2FA Columns:**
```sql
email_2fa_enabled BOOLEAN DEFAULT FALSE
email_2fa_code VARCHAR(255) NULL
email_2fa_expires_at TIMESTAMP NULL
email_2fa_method ENUM('EMAIL','SMS','APP') NULL
recovery_codes JSON NULL
twofa_secret VARCHAR(255) NULL
```

**Other Key Tables:**
- ✅ products (with MOQ, pricing tiers)
- ✅ categories
- ✅ orders (with commission tracking)
- ✅ quotations (RFQ system)
- ✅ affiliates (MLM structure)
- ✅ cart_items
- ✅ blog_posts (dual database setup)
- ✅ notifications (real-time)
- ✅ kyc_verifications

### No SQL Import Needed

**Why:** All migrations were already run on production server via `php artisan migrate`. The database schema is current.

**If You Need Fresh SQL Export:**
```bash
# SSH into server
ssh -p 21098 ngfaczol@68.65.122.49

# Export main database
mysqldump -u ngfaczol_admin -p ngfaczol_keohams > keohams_export_$(date +%Y%m%d).sql

# Export blog database
mysqldump -u ngfaczol_admin -p ngfaczol_keohams_public_blog > blog_export_$(date +%Y%m%d).sql

# Download files using SFTP
```

---

## Files Changed Summary

### Frontend Files (Upload These)
```
pages/register.html    - Added full navigation bar with styled links
pages/about.html       - Updated nav links to use /pages/ paths, added Sign In link
pages/contact.html     - Updated nav links to use /pages/ paths, added Sign In link
js/main.js             - Fixed captcha display (uses backend image), fixed 2FA flow
```

### Backend Files (Already on Server)
```
app/Http/Controllers/CaptchaController.php    - NEW (generates CAPTCHA images)
app/Http/Controllers/CurrencyController.php   - NEW (multi-currency support)
app/Http/Controllers/AuthController.php       - FIXED (2FA, email verification)
routes/api.php                                 - UPDATED (added 4 new routes)
```

---

## Troubleshooting

### Issue: Captcha Not Displaying

**Symptoms:** Login form shows blank captcha canvas

**Solution:**
1. Check browser console for errors
2. Verify route exists: `curl https://keohams.com/api/v1/captcha`
3. Check Laravel logs: `tail -f storage/logs/laravel.log`
4. Ensure GD library installed: `php -m | grep -i gd`

### Issue: Sign-In Modal Not Opening

**Symptoms:** Clicking "Sign In" does nothing

**Solution:**
1. Check browser console for JavaScript errors
2. Verify Bootstrap JS is loaded
3. Check that `js/main.js` was uploaded correctly
4. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

### Issue: Navigation Links Not Working

**Symptoms:** Clicking nav links gives 404

**Solution:**
1. Verify files exist in `/pages/` directory on server
2. Check `.htaccess` rewrite rules
3. Ensure correct paths: `/pages/about` not `/about`

### Issue: 2FA Code Not Received

**Symptoms:** User doesn't receive 2FA email

**Solution:**
1. Check mail configuration in `.env`:
   ```env
   MAIL_MAILER=smtp
   MAIL_HOST=server165.web-hosting.com
   MAIL_PORT=465
   MAIL_USERNAME=noreply@keohams.com
   MAIL_PASSWORD=your_password
   MAIL_ENCRYPTION=ssl
   ```
2. Check Laravel logs for email errors
3. Verify email queue is running: `php artisan queue:work`

### Issue: Currency Conversion Not Working

**Symptoms:** Prices don't convert when changing currency

**Solution:**
1. Check route exists: `curl https://keohams.com/api/v1/currency/rates`
2. Verify controller uploaded correctly
3. Check cache: `php artisan cache:clear`
4. Add API key to `.env` (optional): `EXCHANGE_RATE_API_KEY=your_key`

---

## Quick Deployment Commands

### Upload All Files at Once (PowerShell)

```powershell
# Set variables
$server = "68.65.122.49"
$port = 21098
$user = "ngfaczol"
$remotePath = "~/keohams.com"

# Files to upload
$files = @(
    @{local="pages\register.html"; remote="pages/register.html"},
    @{local="pages\about.html"; remote="pages/about.html"},
    @{local="pages\contact.html"; remote="pages/contact.html"},
    @{local="js\main.js"; remote="js/main.js"}
)

# Using WinSCP PowerShell module (install first: Install-Module WinSCP)
# Or use FileZilla/other SFTP client
```

### Verify Deployment

```bash
# SSH into server
ssh -p 21098 ngfaczol@68.65.122.49

# Check file timestamps
ls -lh ~/keohams.com/pages/register.html
ls -lh ~/keohams.com/js/main.js

# Test routes
php artisan route:list | grep -E 'v1/(captcha|currency|login|verify-2fa)'

# Test API endpoints
curl -s https://keohams.com/api/v1/captcha | jq
```

---

## Post-Deployment Checklist

- [ ] Register new user account - verify email sent
- [ ] Login without 2FA - verify captcha works
- [ ] Enable 2FA - verify recovery codes generated
- [ ] Login with 2FA - verify code sent and verified
- [ ] Test currency selector - verify prices convert
- [ ] Visit /pages/about - verify navigation works
- [ ] Visit /pages/contact - verify navigation works
- [ ] Visit /pages/register - verify navigation works
- [ ] Check all nav links on each page
- [ ] Test on mobile device
- [ ] Check Laravel logs for errors
- [ ] Verify no console errors in browser

---

## Support Commands

### Clear All Caches
```bash
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear
```

### Rebuild Caches
```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### Check Migration Status
```bash
php artisan migrate:status
```

### View Routes
```bash
php artisan route:list --path=v1
```

### Watch Logs
```bash
tail -f storage/logs/laravel.log | grep -E 'ERROR|CRITICAL|WARNING'
```

---

## Important Notes

1. **No SQL Import Required** - All database changes already applied via migrations
2. **Backend Already Deployed** - Controllers and routes already on server
3. **Only Frontend Needs Upload** - Upload 4 files (3 HTML, 1 JS)
4. **Test Thoroughly** - Follow post-deployment checklist
5. **Monitor Logs** - Watch for any errors during testing

---

## Contact for Issues

If you encounter any problems:
1. Check Laravel logs: `storage/logs/laravel.log`
2. Check browser console for JavaScript errors
3. Verify files uploaded correctly
4. Clear all caches and try again
5. Review this guide's troubleshooting section

**Files Reference:**
- Bug fixes: `BUG_FIXES_SUMMARY.md`
- Deployment: `CPANEL_DEPLOYMENT_GUIDE.md`
- Security: `SECURITY_FIXES_APPLIED.md`
