# KEOHAMS Deployment Checklist
## Complete Frontend-Backend-Database Integration Guide

**Date:** November 16, 2025  
**Status:** Pre-deployment validation required

---

## 📋 Upload Structure Summary

### Root Directory (`/home/ngfaczol/public_html/`)
```
public_html/
├── .htaccess                    ✅ Routes API to Laravel, serves static files
├── index.html                   ✅ Landing page (from frontend/public/)
├── keohamlogo.jpg              ⚠️  Upload logo file
│
├── pages/                       ✅ All HTML pages (from frontend/pages/)
│   ├── about.html
│   ├── admin-dashboard.html
│   ├── admin-logs.html
│   ├── admin.html
│   ├── affiliate-dashboard.html
│   ├── affiliate-login.html
│   ├── affiliate-register.html
│   ├── blog-public.html
│   ├── blog.html
│   ├── cart.html
│   ├── chat.html
│   ├── contact.html
│   ├── dashboard.html
│   ├── forgot.html
│   ├── kyc-enhanced.html
│   ├── notifications.html
│   ├── privacy-policy.html
│   ├── register.html
│   ├── reset.html
│   ├── settings.html
│   ├── shop.html
│   ├── terms-and-conditions.html
│   ├── test-quotations.html
│   └── verify.html
│
├── src/                         ✅ Frontend source files
│   ├── js/                      ✅ All JavaScript modules (from frontend/src/js/)
│   │   ├── admin-dashboard.js
│   │   ├── api.js
│   │   ├── auth.js
│   │   ├── authGuard.js
│   │   ├── blog.js
│   │   ├── cart.js
│   │   ├── chat.js
│   │   ├── config.js          ⚠️  CHECK: API_BASE configuration
│   │   ├── dashboard.js
│   │   ├── kyc-enhanced.js
│   │   ├── main.js
│   │   ├── notifications.js
│   │   ├── quotations.js
│   │   ├── register.js
│   │   ├── settings.js
│   │   ├── shop.js
│   │   ├── sidebar.js
│   │   └── ... (all other JS files)
│   └── css/                     ✅ Stylesheets (from frontend/src/css/)
│
├── public/                      ✅ Laravel public directory (from laravel/public/)
│   ├── .htaccess               ✅ Laravel routing rules
│   ├── index.php               ✅ Laravel entry point
│   ├── css/                    ✅ Laravel compiled assets
│   └── js/                     ✅ Laravel compiled assets
│
├── app/                         ✅ Laravel application code
├── bootstrap/                   ✅ Laravel bootstrap
├── config/                      ✅ Laravel configuration
├── database/                    ✅ Migrations and seeders
├── resources/                   ✅ Laravel resources
├── routes/                      ✅ Laravel routes
├── storage/                     ✅ Laravel storage (set permissions 775)
├── vendor/                      ⚠️  Install on server with composer
├── artisan                      ✅ Laravel CLI
├── composer.json               ✅ Dependencies
└── .env                        ⚠️  CREATE on server with production credentials
```

---

## 🔍 Frontend-Backend Integration Points

### 1. **API Configuration** (`src/js/config.js`)

**Current behavior:**
```javascript
// Development: http://localhost:8000/api
// Production: https://keohams.com/api
```

**Status:** ✅ **Correctly configured**
- Auto-detects environment
- Uses same-origin in production
- No hardcoded URLs

### 2. **Authentication Flow** (`src/js/auth.js`)

**Endpoints used:**
- ✅ `POST /api/auth/register` - User registration
- ✅ `POST /api/auth/login` - User login
- ✅ `POST /api/auth/verify-2fa` - 2FA verification
- ✅ `GET /api/auth/profile` - Get user profile
- ✅ `GET /api/auth/captcha` - Get CAPTCHA challenge
- ✅ `POST /api/auth/verify-email` - Email verification
- ✅ `POST /api/auth/reset-password` - Password reset

**Database tables required:**
- ✅ `users` - User accounts
- ✅ `password_reset_tokens` - Password reset tokens
- ✅ `personal_access_tokens` - Laravel Sanctum tokens

**Status:** ✅ **Fully integrated with Laravel Sanctum**

### 3. **Product Catalog** (`src/js/shop.js`)

**Endpoints used:**
- ✅ `GET /api/products` - List products with pagination
- ✅ `GET /api/products/:id` - Get product details
- ✅ `GET /api/categories` - List categories
- ✅ `POST /api/products/:id/inquiry` - Product inquiry

**Database tables required:**
- ✅ `products` - Product catalog
- ✅ `categories` - Product categories
- ✅ `product_category` - Many-to-many pivot

**Status:** ✅ **Database-backed, ready for data seeding**

### 4. **Cart & Quotations** (`src/js/cart.js`, `src/js/quotations.js`)

**Endpoints used:**
- ✅ `GET /api/cart` - Get user cart
- ✅ `POST /api/cart` - Add to cart
- ✅ `PATCH /api/cart/:id` - Update cart item
- ✅ `DELETE /api/cart/:id` - Remove from cart
- ✅ `POST /api/quotations` - Request quotation
- ✅ `GET /api/quotations/mine` - Get user quotations
- ✅ `PATCH /api/quotations/:id/approve` - Admin approve quotation

**Database tables required:**
- ✅ `cart_items` - Shopping cart
- ✅ `quotations` - Quote requests
- ✅ `quotation_items` - Quote line items
- ✅ `orders` - Completed orders

**Status:** ✅ **Full quotation workflow integrated**

### 5. **KYC System** (`src/js/kyc-enhanced.js`, `src/js/kyc-widget.js`)

**Endpoints used:**
- ✅ `GET /api/kyc/enhanced/status` - Check KYC status
- ✅ `POST /api/kyc/enhanced/portrait` - Upload portrait
- ✅ `POST /api/kyc/enhanced/selfie-video` - Upload selfie video
- ✅ `POST /api/kyc/enhanced/id-document` - Upload ID
- ✅ `POST /api/kyc/enhanced/submit` - Submit for review
- ✅ `GET /api/admin/kyc/pending` - Admin get pending KYC
- ✅ `POST /api/admin/kyc/:id/approve` - Admin approve KYC
- ✅ `POST /api/admin/kyc/:id/reject` - Admin reject KYC

**Database tables required:**
- ✅ `kyc_submissions` - KYC applications
- ✅ `users.kyc_status` - User KYC status field

**Status:** ✅ **Complete with facial recognition**

### 6. **Admin Dashboard** (`src/js/admin-dashboard.js`, `pages/admin.html`)

**Endpoints used:**
- ✅ `GET /api/admin/dashboard` - Dashboard statistics
- ✅ `GET /api/admin/users` - User management
- ✅ `PATCH /api/admin/users/:id` - Update user
- ✅ `DELETE /api/admin/users/:id` - Delete user
- ✅ `GET /api/admin/orders` - Order management
- ✅ `GET /api/admin/products` - Product management
- ✅ `POST /api/admin/products` - Create product
- ✅ `PATCH /api/admin/products/:id` - Update product
- ✅ `DELETE /api/admin/products/:id` - Delete product
- ✅ `GET /api/admin/logs` - Activity logs
- ✅ `GET /api/admin/quotations` - All quotations

**Database tables required:**
- ✅ `activity_logs` - System activity logging
- ✅ All other tables for management

**Status:** ✅ **Full admin functionality**

### 7. **Affiliate System** (`src/js/affiliate-dashboard.js`)

**Endpoints used:**
- ✅ `POST /api/affiliate/register` - Affiliate registration
- ✅ `POST /api/affiliate/auth/login` - Affiliate login
- ✅ `GET /api/affiliate/dashboard` - Affiliate dashboard
- ✅ `GET /api/affiliate/sales` - Affiliate sales
- ✅ `GET /api/affiliate/commissions` - Commission history
- ✅ `GET /api/affiliate/network` - Referral network
- ✅ `POST /api/affiliate/withdrawals` - Request payout
- ✅ `GET /api/affiliate/commission-preview` - Calculate commission

**Database tables required:**
- ✅ `affiliates` - Affiliate accounts
- ✅ `affiliate_sales` - Sales tracking
- ✅ `affiliate_commissions` - Commission records
- ✅ `affiliate_withdrawals` - Payout requests

**Status:** ✅ **Multi-level MLM system ready**

### 8. **Blog System** (`src/js/blog.js`, `src/js/blog-public.js`)

**Endpoints used:**
- ✅ `GET /api/blog/posts` - List blog posts (private)
- ✅ `GET /api/blog/public` - Public blog posts
- ✅ `GET /api/blog/posts/:id` - Get post details
- ✅ `POST /api/admin/blog/posts` - Create post (admin)
- ✅ `PATCH /api/admin/blog/posts/:id` - Update post (admin)
- ✅ `DELETE /api/admin/blog/posts/:id` - Delete post (admin)
- ✅ `POST /api/admin/blog/posts/:id/publish` - Publish to public

**Database tables required:**
- ✅ `blog_posts` - Main blog database
- ✅ `public_blog_posts` - Public blog database (separate)

**Status:** ✅ **Dual database system configured**

### 9. **Chat & Notifications** (`src/js/chat.js`, `src/js/notifications.js`)

**Endpoints used:**
- ✅ `GET /api/chat/conversations` - List conversations
- ✅ `GET /api/chat/messages/:id` - Get messages
- ✅ `POST /api/chat/messages` - Send message
- ✅ `GET /api/notifications` - Get user notifications
- ✅ `PATCH /api/notifications/:id/read` - Mark as read
- ✅ `DELETE /api/notifications/:id` - Delete notification

**Database tables required:**
- ✅ `conversations` - Chat conversations
- ✅ `messages` - Chat messages
- ✅ `notifications` - User notifications

**Real-time features:**
- ⚠️ Requires Laravel Broadcasting (Pusher/WebSockets)
- ⚠️ WebSocket server setup needed for real-time

**Status:** ✅ **API ready**, ⚠️ **Real-time optional**

### 10. **Settings & Profile** (`src/js/settings.js`, `pages/settings.html`)

**Endpoints used:**
- ✅ `GET /api/user/profile` - Get user profile
- ✅ `PATCH /api/user/profile` - Update profile
- ✅ `POST /api/user/profile/avatar` - Upload avatar
- ✅ `POST /api/user/change-password` - Change password
- ✅ `POST /api/user/enable-2fa` - Enable 2FA
- ✅ `POST /api/user/disable-2fa` - Disable 2FA

**Database tables required:**
- ✅ `users` - User data
- ✅ `user_settings` - User preferences (if table exists)

**Status:** ✅ **Full profile management**

---

## ⚙️ Server Configuration Required

### 1. **Environment Variables** (`.env`)

Create on server with production values:

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
DB_PASSWORD=your_secure_password

# Database - Public Blog
PUBLIC_DB_CONNECTION=mysql
PUBLIC_DB_HOST=localhost
PUBLIC_DB_PORT=3306
PUBLIC_DB_DATABASE=ngfaczol_keohams_public_blog
PUBLIC_DB_USERNAME=ngfaczol_keohams_public_blog
PUBLIC_DB_PASSWORD=your_secure_password

# Redis Cache
CACHE_DRIVER=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis

REDIS_HOST=redis-14922.c81.us-east-1-2.ec2.cloud.redislabs.com
REDIS_PORT=14922
REDIS_PASSWORD=cTEkPz7F9DCqe7HBEpnmHBLouUlAofUB
REDIS_CLIENT=phpredis

# Email
MAIL_MAILER=smtp
MAIL_HOST=server165.web-hosting.com
MAIL_PORT=465
MAIL_USERNAME=noreply@keohams.com
MAIL_PASSWORD=your_email_password
MAIL_ENCRYPTION=ssl
MAIL_FROM_ADDRESS=noreply@keohams.com
MAIL_FROM_NAME="${APP_NAME}"

# Paystack (Production)
PAYSTACK_PUBLIC_KEY=pk_live_your_public_key
PAYSTACK_SECRET_KEY=sk_live_your_secret_key
PAYSTACK_PAYMENT_URL=https://api.paystack.co

# Security
SESSION_LIFETIME=120
SESSION_COOKIE=keohams_session
SESSION_SECURE_COOKIE=true
```

### 2. **Database Setup**

**Create databases in cPanel:**
```sql
-- Main database
CREATE DATABASE ngfaczol_keohams;
-- Public blog database
CREATE DATABASE ngfaczol_keohams_public_blog;
```

**Run migrations:**
```bash
cd /home/ngfaczol/public_html
php artisan migrate --force
```

**Seed initial data:**
```bash
php artisan db:seed --class=AdminSeeder
php artisan db:seed --class=CategorySeeder
php artisan db:seed --class=ProductSeeder
```

### 3. **File Permissions**

```bash
cd /home/ngfaczol/public_html

# Set directory permissions
find . -type d -exec chmod 755 {} \;

# Set file permissions
find . -type f -exec chmod 644 {} \;

# Set writable directories
chmod -R 775 storage bootstrap/cache

# Set owner
chown -R ngfaczol:ngfaczol .
```

### 4. **Laravel Optimization**

```bash
# Install dependencies
composer install --no-dev --optimize-autoloader

# Clear all caches
php artisan optimize:clear

# Cache configuration
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Create storage link
php artisan storage:link
```

### 5. **Cron Job Setup**

Add to cPanel Cron Jobs:
```
* * * * * cd /home/ngfaczol/public_html && /usr/local/bin/php artisan schedule:run >> /dev/null 2>&1
```

---

## ✅ Pre-Deployment Testing Checklist

### Authentication Tests
- [ ] User can register with email
- [ ] Email verification link works
- [ ] User can login after verification
- [ ] Password reset flow works
- [ ] 2FA can be enabled and works
- [ ] Admin can login to admin panel
- [ ] Logout clears session properly

### Product Catalog Tests
- [ ] Products display on shop page
- [ ] Product search works
- [ ] Category filters work
- [ ] Product details page loads
- [ ] Add to cart works
- [ ] Cart updates properly

### Quotation Tests
- [ ] User can request quotation
- [ ] Admin receives quotation request
- [ ] Admin can modify and approve quotation
- [ ] User receives notification of approval
- [ ] User can complete payment

### KYC Tests
- [ ] User can upload portrait photo
- [ ] User can record selfie video
- [ ] User can upload ID document
- [ ] Admin can view pending KYC
- [ ] Admin can approve/reject KYC
- [ ] User receives KYC status notification

### Admin Panel Tests
- [ ] Admin dashboard shows statistics
- [ ] Admin can manage users
- [ ] Admin can manage products
- [ ] Admin can manage orders
- [ ] Admin can view activity logs
- [ ] Admin can approve quotations

### Affiliate Tests
- [ ] Affiliate can register with referral code
- [ ] Affiliate dashboard shows statistics
- [ ] Sales are tracked correctly
- [ ] Commissions calculated properly
- [ ] Referral network displays
- [ ] Payout requests work

### Blog Tests
- [ ] Public blog displays posts
- [ ] Private blog requires authentication
- [ ] Admin can create/edit posts
- [ ] Admin can publish to public blog
- [ ] Blog post details page loads

### Chat & Notifications Tests
- [ ] User receives notifications
- [ ] Notifications can be marked read
- [ ] Chat conversations load
- [ ] Messages can be sent
- [ ] Real-time updates work (if WebSocket configured)

---

## 🚨 Common Issues & Solutions

### Issue 1: "API endpoint not found" (404)
**Cause:** `.htaccess` not routing correctly  
**Solution:** Verify root `.htaccess` exists and routes `/api/*` to `public/index.php`

### Issue 2: "Token mismatch" or "Unauthenticated" (401)
**Cause:** Laravel Sanctum not configured  
**Solution:** 
```bash
php artisan config:clear
php artisan cache:clear
```
Verify `APP_URL` in `.env` matches your domain

### Issue 3: Database connection failed
**Cause:** Wrong credentials or database doesn't exist  
**Solution:** Double-check `.env` database credentials, ensure databases created in cPanel

### Issue 4: File upload fails
**Cause:** Storage directory not writable  
**Solution:**
```bash
chmod -R 775 storage
php artisan storage:link
```

### Issue 5: CORS errors in browser console
**Cause:** Laravel CORS configuration  
**Solution:** Already configured in `config/cors.php` - ensure it's cached:
```bash
php artisan config:cache
```

### Issue 6: Static pages return 404
**Cause:** Routing issue in `.htaccess`  
**Solution:** Verify `pages/` directory uploaded and accessible

### Issue 7: JavaScript modules fail to load
**Cause:** Incorrect paths or missing files  
**Solution:** Verify `src/js/` uploaded correctly, check browser console for exact path

---

## 📊 Deployment Success Metrics

After deployment, verify:

✅ **Homepage loads** (`/`)  
✅ **Static pages load** (`/about`, `/contact`, `/privacy-policy`)  
✅ **Registration works** - User can create account  
✅ **Email verification works** - User receives email  
✅ **Login works** - User can access dashboard  
✅ **Shop loads products** - Database query successful  
✅ **Cart functions** - Add/remove items  
✅ **Admin panel accessible** - Admin can login  
✅ **KYC upload works** - Files stored correctly  
✅ **API responds** - Test with `curl https://keohams.com/api/health`  

---

## 🎯 Post-Deployment Tasks

### Immediate (First 24 Hours)
1. Monitor error logs: `tail -f storage/logs/laravel.log`
2. Test all critical user flows
3. Verify email delivery
4. Check payment processing (test mode first)
5. Monitor database performance
6. Verify SSL certificate working

### Short Term (First Week)
7. Set up automated backups
8. Configure monitoring/alerting
9. Load test critical endpoints
10. Review security headers
11. Optimize slow queries
12. Set up log rotation

### Ongoing
13. Weekly database backups
14. Monthly security audits
15. Review user feedback
16. Performance optimization
17. Dependency updates
18. Feature enhancements

---

## 📞 Support Resources

**Developer:** Kenneth Ohams  
**Email:** Ohamskenneth08@gmail.com  
**Documentation:** `/laravel/docs/`  
**Deployment Guide:** `/laravel/CPANEL_DEPLOYMENT_GUIDE.md`  
**Security Fixes:** `/SECURITY_FIXES_APPLIED.md`

---

**Status:** ✅ Ready for deployment  
**Last Updated:** November 16, 2025  
**Version:** 1.0.0
