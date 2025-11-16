# Affiliate Withdrawal System Fix

## Problem
Admin panel affiliate payouts section not working - not fetching data from database.

## Diagnosis Steps

### Step 1: Verify Migration Ran

SSH into server:
```bash
cd ~/keohams.com/backend
source /home/ngfaczol/nodevenv/keohams.com/backend/22/bin/activate
npx knex migrate:status
```

Look for migration `20251112_027_affiliate_system.js` in completed list.

If NOT completed:
```bash
npx knex migrate:up 20251112_027_affiliate_system.js
```

### Step 2: Verify Tables Exist

```bash
mysql -u ngfaczol_keohams -p ngfaczol_keohams
```

Then run:
```sql
SHOW TABLES LIKE 'affiliate%';
```

Should see:
- `affiliates`
- `affiliate_commission_settings`
- `affiliate_sales`
- `affiliate_commissions`
- `affiliate_withdrawals` ← THIS IS CRITICAL

If `affiliate_withdrawals` table missing:
```sql
CREATE TABLE affiliate_withdrawals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  affiliate_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  method VARCHAR(50) DEFAULT 'BANK_TRANSFER',
  status VARCHAR(50) DEFAULT 'PENDING',
  bank_account_name VARCHAR(255),
  bank_account_number VARCHAR(255),
  bank_name VARCHAR(255),
  paypal_email VARCHAR(255),
  crypto_address VARCHAR(255),
  crypto_network VARCHAR(50),
  processing_notes TEXT,
  transaction_reference VARCHAR(255),
  processed_by INT,
  processed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id),
  FOREIGN KEY (processed_by) REFERENCES users(id)
);
```

### Step 3: Test Backend API Endpoints

Test if endpoints return data:

```bash
# Get auth token first
TOKEN="your_admin_jwt_token"

# Test pending withdrawals
curl -H "Authorization: Bearer $TOKEN" \
  https://keohams.com/api/admin/affiliate/withdrawals/pending

# Test withdrawals list
curl -H "Authorization: Bearer $TOKEN" \
  https://keohams.com/api/admin/affiliate/withdrawals
```

Should return JSON, not 404 or 500 error.

### Step 4: Check AffiliateWithdrawal Model

Verify the model exists:
```bash
cd ~/keohams.com/backend
cat src/models/affiliateWithdrawal.js
```

Should export methods:
- `getPendingWithdrawals()`
- `list()`
- `findById()`
- `updateStatus()`

### Step 5: Check Admin Controller

```bash
cat src/controllers/adminController.js | grep -A 20 "getPendingWithdrawals"
```

Should see function that calls `AffiliateWithdrawal.getPendingWithdrawals()`.

### Step 6: Verify Routes Registration

```bash
cat src/routes/admin.js | grep withdrawal
```

Should see:
```javascript
router.get('/affiliate/withdrawals/pending', ...
router.get('/affiliate/withdrawals', ...
router.post('/affiliate/withdrawals/:id/process', ...
```

## Quick Fix if Tables Missing

If affiliate tables don't exist, re-run migration:

```bash
cd ~/keohams.com/backend
source /home/ngfaczol/nodevenv/keohams.com/backend/22/bin/activate

# Rollback last migration
npx knex migrate:rollback

# Run up again
npx knex migrate:up
```

## Frontend JavaScript Fix

Check if `admin-affiliate.js` is loaded in `admin.html`:

```html
<script src="/src/js/admin-affiliate.js"></script>
```

### Browser Console Test

Open admin panel, go to Affiliate tab, open browser console:

```javascript
// Test if functions exist
console.log(typeof loadUnpaidCommissions);
console.log(typeof releaseSingleCommission);

// Test API call manually
fetch('/api/admin/affiliate/withdrawals/pending', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  }
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

## Common Issues

### Error: "Cannot read property 'affiliate_id' of undefined"
- Check if `AffiliateWithdrawal` model is imported in `adminController.js`
- Add: `const AffiliateWithdrawal = require('../models/affiliateWithdrawal');`

### Error: "Table 'affiliate_withdrawals' doesn't exist"
- Run migration: `npx knex migrate:up`
- Or create table manually (SQL above)

### Error: "Cannot GET /api/admin/affiliate/withdrawals"
- Check route registration in `src/app.js`
- Should have: `app.use('/api/admin', adminRoutes);`

### Blank/Empty List in Admin Panel
- Check browser console for JavaScript errors
- Verify `admin-affiliate.js` is loaded
- Check network tab for API call failures
- Verify token is valid (not expired)

## Testing the Fix

1. **Create test withdrawal request:**
```sql
INSERT INTO affiliate_withdrawals (affiliate_id, amount, method, bank_account_name)
VALUES (1, 100.00, 'BANK_TRANSFER', 'Test Account');
```

2. **Reload admin panel** → Go to Affiliate tab → Payouts sub-tab
3. **Should see** the test withdrawal request
4. **Try approving** it - should work without errors

## Server Restart

After fixes:
```bash
# In cPanel → Setup Node.js App
# Click "Restart App"
```

Or via SSH:
```bash
pkill -f "node.*server.js"
cd ~/keohams.com/backend
source /home/ngfaczol/nodevenv/keohams.com/backend/22/bin/activate
npm start
```
