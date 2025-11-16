# cPanel Urgent Fixes - November 16, 2025

## Critical Issues from Error Log

### Issue 1: Missing node_modules (socket.io not found)
**Error:** `Cannot find module 'socket.io'`

**Cause:** npm dependencies not installed after deployment

**Fix:**
```bash
cd ~/keohams.com/backend
source /home/ngfaczol/nodevenv/keohams.com/backend/22/bin/activate
npm install
```

Or use cPanel interface:
1. Go to **Setup Node.js App**
2. Click on your KEOHAMS application
3. Click **Run NPM Install** button
4. Wait for completion (may take 2-3 minutes)

---

### Issue 2: SMTP_FROM parsing error
**Error:** `/home/ngfaczol/nodevenv/keohams.com/backend/22/bin/node: line 10: noreply@keohams.com: No such file or directory`

**Cause:** Environment variable with email in angle brackets being parsed as command

**Already Fixed:** Changed in .env from:
```
SMTP_FROM="KEOHAMS <noreply@keohams.com>"
```

To:
```
SMTP_FROM=KEOHAMS <noreply@keohams.com>
```

**Verify Fix:**
```bash
cd ~/keohams.com/backend
cat .env | grep SMTP_FROM
```

Should show: `SMTP_FROM=KEOHAMS <noreply@keohams.com>` (no quotes)

---

### Issue 3: Foreign Key Constraint Error in activity_logs
**Error:** 
```
Cannot add or update a child row: a foreign key constraint fails
(`ngfaczol_keohams`.`activity_logs`, CONSTRAINT `activity_logs_user_id_foreign` 
FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL)
```

**Cause:** Affiliate login trying to log activity with user_id=3, but user 3 doesn't exist in users table

**Diagnosis:**
```bash
mysql -u ngfaczol_keohams -p ngfaczol_keohams -e "SELECT id, email FROM affiliates WHERE id = 3;"
mysql -u ngfaczol_keohams -p ngfaczol_keohams -e "SELECT id, email FROM users WHERE id = 3;"
```

**Fix Option 1: Create Missing User Record**

If affiliate exists but user doesn't:
```sql
-- Get affiliate details
SELECT * FROM affiliates WHERE id = 3;

-- Create corresponding user (replace with actual affiliate data)
INSERT INTO users (id, name, email, password_hash, role, email_verified, is_active)
SELECT 
  user_id,
  name,
  email,
  password_hash,
  'CUSTOMER' as role,
  true as email_verified,
  is_active
FROM affiliates 
WHERE id = 3;
```

**Fix Option 2: Make activity_logs.user_id Nullable**

Allow activity logs without valid user references:
```sql
ALTER TABLE activity_logs 
MODIFY COLUMN user_id INT NULL;

-- Or drop the foreign key constraint entirely
ALTER TABLE activity_logs 
DROP FOREIGN KEY activity_logs_user_id_foreign;
```

**Fix Option 3: Update Activity Logging Code (APPLIED)**

The issue was in `backend/src/controllers/affiliateAuthController.js` - it was using `affiliate.id` instead of `affiliate.user_id` when logging.

**Fixed in code:** Changed line 346 from:
```javascript
user_id: affiliate.id,  // WRONG - uses affiliate table ID
```

To:
```javascript
user_id: affiliate.user_id || null,  // CORRECT - uses users table ID or null for standalone affiliates
```

This fix is already applied in the codebase. Just redeploy or pull latest changes.

---

## Quick Deployment Checklist

After uploading code to cPanel, ALWAYS run:

```bash
cd ~/keohams.com/backend
source /home/ngfaczol/nodevenv/keohams.com/backend/22/bin/activate

# 1. Install dependencies
npm install --production

# 2. Run migrations
npx knex migrate:latest

# 3. Verify environment variables
cat .env | grep -E "PORT|NODE_ENV|DB_NAME|SMTP_FROM"

# 4. Check file permissions
chmod -R 755 .
chmod -R 777 uploads/
chmod -R 777 logs/

# 5. Test database connection
node -e "const db = require('./src/config/db'); db.raw('SELECT 1').then(() => console.log('DB OK')).catch(console.error).finally(() => db.destroy());"

# 6. Restart app
pkill -f "node.*server.js"
npm start &
```

Or simply restart via cPanel:
1. Go to **Setup Node.js App**
2. Click **Restart App**

---

## Verify Everything Works

### Test 1: Check App is Running
```bash
curl http://localhost:3000/api/health
```

Should return: `{"status":"ok"}`

### Test 2: Check Socket.io Loads
```bash
cd ~/keohams.com/backend
node -e "const io = require('socket.io'); console.log('socket.io version:', require('socket.io/package.json').version);"
```

### Test 3: Check Database Tables
```bash
mysql -u ngfaczol_keohams -p ngfaczol_keohams -e "SHOW TABLES;" | wc -l
```

Should show 60+ tables.

### Test 4: Check Affiliate Login
```bash
# Get affiliate auth token
curl -X POST https://keohams.com/api/affiliate-auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

Should NOT throw foreign key error.

---

## Still Having Issues?

### View Real-time Logs
```bash
cd ~/keohams.com/backend
tail -f logs/error.log
```

### View Node.js Process
```bash
ps aux | grep node
```

### Kill and Restart Manually
```bash
pkill -f "node.*server.js"
cd ~/keohams.com/backend
source /home/ngfaczol/nodevenv/keohams.com/backend/22/bin/activate
NODE_ENV=production node src/server.js > logs/app.log 2> logs/error.log &
```

### Check cPanel Error Logs
In cPanel → **Errors** section, look for recent Node.js errors.

---

## Root Cause Summary

1. ❌ **npm install not run** → Dependencies missing
2. ❌ **Environment variable syntax** → Shell parsing error (FIXED in .env)
3. ❌ **Data integrity issue** → Affiliate record exists without corresponding user

**Priority Actions:**
1. Run `npm install` in cPanel (CRITICAL)
2. Verify .env has correct SMTP_FROM syntax
3. Fix foreign key constraint by creating missing user or dropping constraint
