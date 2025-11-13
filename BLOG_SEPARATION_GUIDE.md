# Blog System Separation - Documentation

## Overview
The KEOHAMS blog system is now separated into two independent databases:

1. **Main Database (`keohams`)**: Admin-controlled blog management (full CRUD)
2. **Public Blog Database (`keohams_public_blog`)**: Public-facing read-only blog content

This separation provides:
- **Security**: Public users never access the main database
- **Performance**: Isolated read load on public database
- **Control**: Admin manages everything from main DB, changes auto-sync to public
- **Scalability**: Public database can be scaled independently

---

## Architecture

### Main Database (keohams)
**Tables:**
- `posts` - Full blog post data including drafts
- `tags` - Tag management
- `post_tags` - Post-tag relationships

**Access:**
- Admin users (authenticated with ADMIN role)
- Full CRUD operations
- Draft and published content

### Public Blog Database (keohams_public_blog)
**Tables:**
- `posts` - Published posts only (no drafts, no author info)
- `tags` - Public tags
- `post_tags` - Public post-tag relationships
- `comments` - Public comments (future feature)
- `sync_log` - Tracks sync operations

**Access:**
- Public users (no authentication required)
- Read-only operations
- Published content only

---

## API Endpoints

### Public Blog API (No Auth Required)
```
GET  /api/public/blog              - List published posts
GET  /api/public/blog/slug/:slug   - Get single post by slug
GET  /api/public/blog/categories   - Get available categories
GET  /api/public/blog/tags         - Get popular tags
```

### Authenticated Blog API (Auth Required)
```
GET  /api/blog                     - List all posts (including drafts)
GET  /api/blog/slug/:slug          - Get single post
```

### Admin Blog Management (Admin Only)
```
GET    /api/blog/admin             - List all posts
POST   /api/blog/admin             - Create new post
PATCH  /api/blog/admin/:id         - Update post
DELETE /api/blog/admin/:id         - Delete post
POST   /api/blog/admin/:id/publish - Publish post (auto-syncs)
POST   /api/blog/admin/:id/unpublish - Unpublish post (removes from public)
```

### Admin Sync Control (Admin Only)
```
GET  /api/blog/admin/sync/stats    - Get sync statistics
POST /api/blog/admin/sync/all      - Manually sync all published posts
POST /api/blog/admin/sync/:id      - Manually sync specific post
```

---

## Automatic Synchronization

Posts are automatically synchronized to the public database when:

1. **Creating a post** with status = 'PUBLISHED'
2. **Updating a post** to status = 'PUBLISHED'
3. **Publishing a draft** via `/admin/:id/publish` endpoint
4. **Unpublishing a post** via `/admin/:id/unpublish` endpoint (removes from public)
5. **Deleting a post** (removes from public)

### What Gets Synced
**Synced Fields:**
- id, title, slug, excerpt, content
- cover_image, category, reading_minutes
- view_count, seo_title, seo_description
- published_at, synced_at
- Associated tags

**NOT Synced (Security):**
- author_id
- require_login flag
- status (always PUBLISHED in public DB)
- created_at, updated_at timestamps

---

## Setup Instructions

### 1. Environment Configuration
Add to `.env`:
```env
# Public Blog Database
PUBLIC_DB_HOST=127.0.0.1
PUBLIC_DB_PORT=3306
PUBLIC_DB_USER=root
PUBLIC_DB_PASSWORD=
PUBLIC_DB_NAME=keohams_public_blog
```

### 2. Create Public Blog Database
```bash
npm run db:create-public-blog
```

This creates:
- Database: `keohams_public_blog`
- Tables: posts, tags, post_tags, comments, sync_log

### 3. Initial Sync (First Time Only)
Use the admin sync endpoint to populate the public database:

```bash
# Via API (requires admin token)
POST /api/blog/admin/sync/all
Authorization: Bearer <admin_token>
```

Or use code:
```javascript
const blogSyncService = require('./src/services/blogSyncService');
await blogSyncService.syncAllPublished();
```

### 4. Start Server
```bash
npm start
```

Verify both database connections in startup logs:
```
✓ Connected to main database
✓ Connected to public blog database
```

---

## Frontend Integration

### Public Blog Pages
**File:** `frontend/src/js/blog-public.js`
- Uses `/api/public/blog` endpoint (no auth)
- Reads from public database
- Auto-detects public vs authenticated context

### Authenticated Blog Pages
**File:** `frontend/src/js/blog.js`
- Uses `/api/blog` endpoint (requires auth)
- Reads from main database
- Can view drafts and unpublished content

### Blog Post Detail Page
**File:** `frontend/src/js/blog-post.js`
- Auto-detects public vs authenticated context
- Uses appropriate API endpoint
- Falls back gracefully if auth required

---

## Manual Sync Operations

### Check Sync Status
```javascript
GET /api/blog/admin/sync/stats

Response:
{
  "main_published": 15,
  "public_total": 15,
  "in_sync": true,
  "recent_syncs": [...]
}
```

### Sync Specific Post
```javascript
POST /api/blog/admin/sync/42
Content-Type: application/json

{
  "action": "publish"  // or "unpublish"
}
```

### Bulk Sync All Published Posts
```javascript
POST /api/blog/admin/sync/all

Response:
{
  "message": "Bulk sync completed",
  "synced": 15,
  "errors": 0
}
```

---

## Database Schema

### Public Posts Table
```sql
CREATE TABLE posts (
  id INT UNSIGNED PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  cover_image VARCHAR(500),
  category VARCHAR(100),
  reading_minutes INT UNSIGNED,
  view_count INT UNSIGNED DEFAULT 0,
  seo_title VARCHAR(255),
  seo_description VARCHAR(300),
  published_at TIMESTAMP,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_slug (slug),
  INDEX idx_published_at (published_at),
  INDEX idx_category (category),
  INDEX idx_view_count (view_count)
);
```

### Sync Log Table
```sql
CREATE TABLE sync_log (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id INT UNSIGNED NOT NULL,
  action ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_post_id (post_id),
  INDEX idx_synced_at (synced_at)
);
```

---

## Monitoring & Troubleshooting

### Check Database Connection
```javascript
// Main DB
const db = require('./src/config/db');
await db.raw('SELECT 1');

// Public DB
const publicDb = require('./src/config/publicDb');
await publicDb.raw('SELECT 1');
```

### Verify Sync Service
```javascript
const blogSyncService = require('./src/services/blogSyncService');

// Get stats
const stats = await blogSyncService.getSyncStats();
console.log(stats);

// Test sync single post
const result = await blogSyncService.syncPost(1, 'publish');
console.log(result);
```

### Common Issues

**Issue:** Public database connection fails
```
✗ Failed to connect to public blog database: <error>
```
**Solution:** 
- Verify PUBLIC_DB_* env variables in `.env`
- Ensure database exists: `npm run db:create-public-blog`
- Check MySQL user permissions

**Issue:** Posts not appearing in public blog
**Solution:**
- Check post status is 'PUBLISHED' in main database
- Manually trigger sync: `POST /api/blog/admin/sync/:id`
- Check sync_log table for errors

**Issue:** Sync count mismatch
```json
{
  "main_published": 20,
  "public_total": 15,
  "in_sync": false
}
```
**Solution:**
- Run bulk sync: `POST /api/blog/admin/sync/all`
- Check for posts with errors in console logs

---

## Performance Considerations

### Caching
Public blog endpoints are cached for 2 minutes:
```javascript
app.use('/api/public/blog', cache(2 * 60 * 1000), publicBlogRoutes);
```

### Database Indexes
Public database has optimized indexes:
- `idx_slug` - Fast slug lookups
- `idx_published_at` - Chronological sorting
- `idx_category` - Category filtering
- `idx_view_count` - Popular posts queries

### View Count Updates
View counts are updated asynchronously (best-effort):
```javascript
publicDb('posts')
  .where({ id: post.id })
  .increment('view_count', 1)
  .catch(() => {}); // Non-blocking
```

---

## Security Benefits

1. **Database Isolation**: Public users never touch main database
2. **No Sensitive Data**: author_id, internal flags excluded from public DB
3. **Read-Only Public Access**: Public database could use restricted MySQL user
4. **Admin-Only Sync**: Only admins can trigger sync operations
5. **Audit Trail**: sync_log tracks all synchronization events

---

## Future Enhancements

- [ ] Public comments system (moderated via admin)
- [ ] Read-only MySQL user for public database
- [ ] Automatic scheduled syncs (cron job)
- [ ] Sync queue with retry logic (BullMQ)
- [ ] Multi-region public database replication
- [ ] CDN integration for public blog assets
- [ ] Webhook notifications on sync events

---

## Files Created/Modified

### New Files
```
backend/src/config/publicDb.js              - Public DB connection
backend/src/controllers/publicBlogController.js - Public blog API
backend/src/controllers/blogSyncController.js   - Sync admin endpoints
backend/src/services/blogSyncService.js         - Sync logic
backend/src/routes/publicBlog.js               - Public routes
backend/scripts/createPublicBlogDb.js          - DB setup script
```

### Modified Files
```
backend/.env                                - DB config
backend/package.json                        - Added script
backend/src/app.js                         - Registered public routes
backend/src/routes/blog.js                 - Added sync endpoints
backend/src/controllers/blogController.js  - Auto-sync hooks
frontend/src/js/blog-public.js            - Public API usage
frontend/src/js/blog-post.js              - Context detection
```

---

## Support

For issues or questions:
1. Check sync stats: `GET /api/blog/admin/sync/stats`
2. Review sync logs in public database: `SELECT * FROM sync_log ORDER BY synced_at DESC`
3. Check server logs for sync errors
4. Manually trigger sync if needed

---

**Last Updated:** November 12, 2025
**Version:** 1.0.0
