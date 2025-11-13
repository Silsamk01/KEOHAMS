# Blog Separation - Quick Start Guide

## 🚀 Setup in 3 Steps

### Step 1: Create Public Database
```bash
cd backend
npm run db:create-public-blog
```

Expected output:
```
✓ Database keohams_public_blog created successfully
✓ Created posts table
✓ Created tags table
✓ Created post_tags table
✓ Created comments table
✓ Created sync_log table
```

### Step 2: Initial Sync
```bash
npm run db:sync-blog
```

Expected output:
```
✅ Synchronization complete!
   Successfully synced: X posts
   Main published: X
   Public total: X
   In sync: ✓ Yes
```

### Step 3: Verify Setup
```bash
npm run test:blog-separation
```

Expected output:
```
✅ All tests passed!
   Blog separation is working correctly.
```

---

## 📋 What Changed

### Backend
- **New Public DB**: `keohams_public_blog` created
- **New Routes**: `/api/public/blog/*` (no auth required)
- **Auto Sync**: Publish/unpublish triggers automatic sync
- **Admin Control**: New sync management endpoints

### Frontend
- **blog-public.js**: Now uses `/api/public/blog`
- **blog-post.js**: Auto-detects public vs authenticated context

---

## 🎯 Usage

### For Public Users
```javascript
// No authentication required
GET http://localhost:4000/api/public/blog
GET http://localhost:4000/api/public/blog/slug/my-post
```

### For Admins
```javascript
// Requires authentication + ADMIN role
POST /api/blog/admin
POST /api/blog/admin/:id/publish  // ← Triggers auto-sync
POST /api/blog/admin/sync/all     // ← Manual bulk sync
```

---

## 🔍 Testing

### Quick Test
```bash
npm run test:blog-separation
```

### Manual Verification
```bash
# Check main database
mysql -u root keohams -e "SELECT id, title, status FROM posts;"

# Check public database
mysql -u root keohams_public_blog -e "SELECT id, title, synced_at FROM posts;"

# Check sync log
mysql -u root keohams_public_blog -e "SELECT * FROM sync_log ORDER BY synced_at DESC LIMIT 5;"
```

---

## 🛠️ Common Commands

```bash
# Create public database
npm run db:create-public-blog

# Sync all published posts
npm run db:sync-blog

# Test setup
npm run test:blog-separation

# Start server
npm start
```

---

## 📊 Environment Variables

Already configured in `.env`:
```env
PUBLIC_DB_HOST=127.0.0.1
PUBLIC_DB_PORT=3306
PUBLIC_DB_USER=root
PUBLIC_DB_PASSWORD=
PUBLIC_DB_NAME=keohams_public_blog
```

---

## ✅ Success Indicators

1. ✓ Public database created
2. ✓ Initial sync completed
3. ✓ All tests passing
4. ✓ Server starts without errors
5. ✓ Logs show: "✓ Connected to public blog database"

---

## 📖 Full Documentation

- **Complete Guide**: `BLOG_SEPARATION_GUIDE.md`
- **Implementation Summary**: `BLOG_SEPARATION_SUMMARY.md`
- **This Quick Start**: `BLOG_SEPARATION_QUICKSTART.md`

---

## 🆘 Troubleshooting

**Issue**: Database connection error
```bash
# Verify MySQL is running
mysql -u root -p

# Recreate database if needed
npm run db:create-public-blog
```

**Issue**: Sync mismatch detected
```bash
# Run bulk sync
npm run db:sync-blog

# Verify
npm run test:blog-separation
```

**Issue**: Server won't start
```bash
# Check if port 4000 is in use
netstat -ano | findstr :4000

# Kill process if needed (replace PID)
taskkill /PID <PID> /F
```

---

## 🎉 You're Done!

Your blog system is now separated with:
- ✅ Secure public-facing database
- ✅ Automatic synchronization
- ✅ Admin control and monitoring
- ✅ Production-ready setup

**Next**: Start creating blog posts in the admin panel!

---

**Last Updated**: November 12, 2025
