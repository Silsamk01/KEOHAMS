# API Error Handling - Quick Fix Guide

## Problem: "Failed to execute 'json' on 'Response': Unexpected end of JSON input"

This error occurs when JavaScript tries to parse an empty or invalid response from the API.

---

## ✅ **Solutions Applied**

### 1. **Global API Error Handler** (`api-error-handler.js`)

A global script that:
- ✅ Intercepts all `fetch()` requests
- ✅ Handles empty responses gracefully
- ✅ Detects HTML error pages and prevents parsing
- ✅ Auto-redirects on 401 (unauthorized)
- ✅ Handles network errors
- ✅ Provides better error messages

**Usage:** Add to every HTML page:
```html
<head>
  ...
  <script src="/src/js/api-error-handler.js"></script>
</head>
```

### 2. **Robust API Utils** (`api-utils.js`)

Helper functions for making API calls:

```javascript
import { apiGet, apiPost, apiPatch, apiDelete } from '/src/js/api-utils.js';

// GET request
const data = await apiGet('/products');

// POST request
const result = await apiPost('/auth/login', { email, password });

// PATCH request
await apiPatch('/user/profile', { name: 'New Name' });

// DELETE request
await apiDelete('/cart/123');

// With error handling
try {
    const data = await apiGet('/products');
    console.log(data);
} catch (error) {
    console.error('Error loading products:', error.message);
    // Shows user-friendly error
}
```

---

## 🔍 **Root Causes of JSON Parse Errors**

### Cause 1: Empty Response (204 No Content)
**Example:** DELETE requests often return no body

**Solution:** Check for 204 status
```javascript
if (response.status === 204) {
    return {}; // Empty object, not null
}
```

### Cause 2: HTML Error Page
**Example:** Laravel error pages in development/production

**Solution:** Check Content-Type before parsing
```javascript
const contentType = response.headers.get('content-type');
if (contentType && contentType.includes('application/json')) {
    return await response.json();
} else {
    // Handle as text or HTML
    const text = await response.text();
    throw new Error(`Expected JSON, got: ${text.substring(0, 100)}`);
}
```

### Cause 3: Network Error Before Response
**Example:** Server not reachable, CORS error

**Solution:** Wrap in try-catch
```javascript
try {
    const response = await fetch(url);
    // ... handle response
} catch (error) {
    if (error.name === 'TypeError') {
        throw new Error('Network error: Check internet connection');
    }
    throw error;
}
```

### Cause 4: Laravel 419 CSRF Token Mismatch
**Example:** Session expired, invalid CSRF token

**Solution:** Reload page to get fresh token
```javascript
if (response.status === 419) {
    window.location.reload();
    throw new Error('Session expired. Reloading...');
}
```

### Cause 5: Server 500 Error
**Example:** Unhandled PHP exception in Laravel

**Solution:** Check Laravel logs
```bash
tail -f storage/logs/laravel.log
```

---

## 🛠️ **Debugging Steps**

### Step 1: Check Browser Console
Look for:
- Network tab → Failed requests
- Console → Full error stack trace
- Request headers → Authorization token present?
- Response → What did server actually return?

### Step 2: Check Laravel Logs
```bash
# On server
tail -f storage/logs/laravel.log

# Look for:
- PHP errors
- Database connection issues
- Missing routes
- Authentication failures
```

### Step 3: Test API Directly
```bash
# Test endpoint with curl
curl -X GET https://keohams.com/api/products \
  -H "Accept: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: JSON response
# If you get HTML, there's a server-side error
```

### Step 4: Verify .htaccess Routing
Ensure `/api/*` routes to Laravel:
```apache
# Root .htaccess
RewriteCond %{REQUEST_URI} ^/api/
RewriteRule ^(.*)$ public/index.php [L,QSA]
```

### Step 5: Check Laravel CORS
Ensure API accepts requests:
```php
// config/cors.php
'paths' => ['api/*'],
'allowed_methods' => ['*'],
'allowed_origins' => ['*'], // Or specific domain
'allowed_headers' => ['*'],
```

---

## 📋 **Common Scenarios**

### Scenario 1: Login Returns HTML
**Symptom:** Login fails with JSON parse error

**Cause:** Laravel route not found or authentication middleware issue

**Fix:**
1. Check `routes/api.php` has login route
2. Verify URL is `/api/auth/login` not `/auth/login`
3. Check Laravel logs for errors

### Scenario 2: Protected Route Returns 401
**Symptom:** Authenticated requests fail

**Cause:** Token not sent or expired

**Fix:**
1. Verify token in localStorage: `localStorage.getItem('auth_token')`
2. Check Authorization header in Network tab
3. Verify token format: `Bearer YOUR_TOKEN`

### Scenario 3: All Requests Return 404
**Symptom:** Every API call fails with 404

**Cause:** `.htaccess` not routing correctly

**Fix:**
1. Verify root `.htaccess` exists
2. Check Apache `mod_rewrite` is enabled
3. Test direct access: `https://keohams.com/public/index.php/api/products`

### Scenario 4: CORS Error in Console
**Symptom:** "Access-Control-Allow-Origin" error

**Cause:** Laravel CORS not configured

**Fix:**
```bash
# Clear Laravel cache
php artisan config:clear
php artisan cache:clear

# Re-cache with CORS config
php artisan config:cache
```

---

## ✅ **Prevention Checklist**

When making API calls in your code:

- [ ] Always use try-catch blocks
- [ ] Check response.ok before parsing
- [ ] Handle 204 No Content responses
- [ ] Check Content-Type header
- [ ] Use `await response.text()` first to inspect response
- [ ] Provide user-friendly error messages
- [ ] Log errors for debugging
- [ ] Test with both valid and invalid data
- [ ] Test with expired tokens
- [ ] Test with network disconnected

---

## 🔧 **Quick Fixes**

### Fix 1: Wrap All .json() Calls
```javascript
// ❌ BAD
const data = await response.json();

// ✅ GOOD
const data = await response.json().catch(() => ({}));
```

### Fix 2: Check Before Parsing
```javascript
// ✅ BEST
if (response.status === 204) {
    return {};
}

const text = await response.text();
if (!text || text.trim() === '') {
    return {};
}

try {
    return JSON.parse(text);
} catch (error) {
    console.error('Invalid JSON:', text);
    return {};
}
```

### Fix 3: Use Helper Functions
```javascript
// ✅ Use the api-utils.js helpers
import { apiGet } from '/src/js/api-utils.js';

const data = await apiGet('/products'); // Handles all errors
```

---

## 📝 **Example: Refactoring Existing Code**

### Before (Fragile):
```javascript
async function loadProducts() {
    const response = await fetch('/api/products');
    const data = await response.json(); // ❌ Can throw error
    displayProducts(data);
}
```

### After (Robust):
```javascript
import { apiGet, handleApiError } from '/src/js/api-utils.js';

async function loadProducts() {
    try {
        const data = await apiGet('/products');
        displayProducts(data);
    } catch (error) {
        handleApiError(error, true); // Shows user-friendly error
        displayProducts([]); // Show empty state
    }
}
```

---

## 🎯 **Files to Include in Upload**

Make sure these new files are uploaded:

✅ `/src/js/api-error-handler.js` - Global error handler  
✅ `/src/js/api-utils.js` - API utility functions  
✅ Update all HTML pages to include error handler script

---

## 📞 **Still Getting Errors?**

1. **Check Laravel logs:** `tail -f storage/logs/laravel.log`
2. **Check Apache error log:** `/var/log/apache2/error.log`
3. **Test API directly:** Use Postman or curl
4. **Verify .env:** Database connection, APP_URL correct
5. **Clear caches:** `php artisan optimize:clear`
6. **Check file permissions:** `chmod -R 775 storage`

---

**Status:** ✅ Error handling implemented  
**Files Created:** 2 new utility files  
**Pages Updated:** index.html, cart.html + others  
**Last Updated:** November 16, 2025
