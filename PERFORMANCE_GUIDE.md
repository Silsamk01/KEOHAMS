# Laravel Performance Optimization Guide

**Complete performance optimization guide for KEOHAMS Laravel application**

Version: 1.0  
Last Updated: November 16, 2025  
Target: Sub-200ms API response times

---

## Table of Contents

1. [Performance Goals](#performance-goals)
2. [OPcache Configuration](#opcache-configuration)
3. [Database Optimization](#database-optimization)
4. [Query Optimization](#query-optimization)
5. [Caching Strategies](#caching-strategies)
6. [Redis Configuration](#redis-configuration)
7. [Session Optimization](#session-optimization)
8. [Asset Optimization](#asset-optimization)
9. [Image Optimization](#image-optimization)
10. [HTTP/2 and Compression](#http2-and-compression)
11. [CDN Integration](#cdn-integration)
12. [Queue Optimization](#queue-optimization)
13. [Monitoring and Profiling](#monitoring-and-profiling)
14. [Load Testing](#load-testing)

---

## Performance Goals

### Target Metrics

**API Response Times:**
- **Homepage:** < 200ms
- **API Endpoints:** < 150ms
- **Database Queries:** < 50ms
- **Cache Hit Rate:** > 90%

**Resource Usage:**
- **Memory:** < 512MB per request
- **CPU:** < 30% average
- **Disk I/O:** < 100 ops/sec

**Scalability:**
- **Concurrent Users:** 1000+
- **Requests/Second:** 500+
- **Database Connections:** < 100

---

## OPcache Configuration

### Recommended Settings

**File: `php.ini` or `.user.ini` in public_html/**

```ini
; Enable OPcache
opcache.enable=1
opcache.enable_cli=1

; Memory Settings
opcache.memory_consumption=256
opcache.interned_strings_buffer=16
opcache.max_accelerated_files=10000

; Performance Settings
opcache.validate_timestamps=0
opcache.revalidate_freq=0
opcache.fast_shutdown=1
opcache.enable_file_override=1

; Optimization Level
opcache.optimization_level=0x7FFEBFFF

; Save Comments (Required for Laravel)
opcache.save_comments=1
opcache.load_comments=1

; Preloading (PHP 7.4+)
opcache.preload=/home/ngfaczol/public_html/preload.php
opcache.preload_user=ngfaczol
```

### Preload File

**File: `preload.php` in project root**

```php
<?php

if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    require __DIR__ . '/vendor/autoload.php';
    
    // Load Laravel framework
    \Illuminate\Foundation\Application::getInstance();
    
    // Preload frequently used classes
    $classes = [
        \Illuminate\Support\Facades\Route::class,
        \Illuminate\Support\Facades\DB::class,
        \Illuminate\Support\Facades\Cache::class,
        \Illuminate\Support\Facades\Redis::class,
        \Illuminate\Support\Facades\Log::class,
        \Illuminate\Http\Request::class,
        \Illuminate\Http\Response::class,
        \Illuminate\Http\JsonResponse::class,
    ];
    
    foreach ($classes as $class) {
        if (class_exists($class)) {
            opcache_compile_file((new ReflectionClass($class))->getFileName());
        }
    }
}
```

### Verifying OPcache

```bash
# Check if OPcache is enabled
php -i | grep opcache

# Check OPcache status
php -r "print_r(opcache_get_status());"
```

### Clear OPcache

```bash
# Clear OPcache
php artisan opcache:clear

# Or create a route
# Route: /admin/opcache/clear
opcache_reset();
```

---

## Database Optimization

### Connection Pooling

**File: `config/database.php`**

```php
'mysql' => [
    'driver' => 'mysql',
    'options' => [
        PDO::ATTR_PERSISTENT => false,
        PDO::ATTR_EMULATE_PREPARES => true,
        PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,
    ],
    'strict' => true,
    'engine' => 'InnoDB',
],
```

### Database Indexes

**Essential Indexes:**

```sql
-- Users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Products table
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_featured ON products(featured);
CREATE INDEX idx_products_price ON products(price);

-- Orders table
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_order_number ON orders(order_number);

-- Composite Indexes
CREATE INDEX idx_products_status_featured ON products(status, featured);
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
```

### Database Maintenance

```bash
# Optimize all tables
php artisan db:optimize

# Analyze tables
mysql -u user -p database -e "ANALYZE TABLE users, products, orders;"

# Check table status
mysql -u user -p database -e "SHOW TABLE STATUS;"
```

### Query Caching

**File: `config/database.php`**

```php
'mysql' => [
    'options' => [
        PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,
    ],
],
```

---

## Query Optimization

### Eager Loading

**Bad (N+1 Query Problem):**

```php
$products = Product::all();
foreach ($products as $product) {
    echo $product->category->name; // N+1 queries
}
```

**Good (Eager Loading):**

```php
$products = Product::with('category')->get();
foreach ($products as $product) {
    echo $product->category->name; // 2 queries total
}
```

### Lazy Eager Loading

```php
$products = Product::all();

// Later in code
$products->load('category', 'images');
```

### Select Specific Columns

**Bad:**

```php
$users = User::all(); // Loads all columns
```

**Good:**

```php
$users = User::select('id', 'name', 'email')->get();
```

### Chunking Large Datasets

**Bad:**

```php
$products = Product::all(); // Loads all at once
foreach ($products as $product) {
    // Process
}
```

**Good:**

```php
Product::chunk(100, function ($products) {
    foreach ($products as $product) {
        // Process
    }
});
```

### Query Scope Optimization

```php
// ProductModel.php
public function scopeActive($query)
{
    return $query->where('status', 'active');
}

public function scopeFeatured($query)
{
    return $query->where('featured', true);
}

// Usage
$products = Product::active()->featured()->get();
```

### Database Query Log

```php
// Enable query logging
DB::enableQueryLog();

// Your queries here
$products = Product::with('category')->get();

// Get executed queries
$queries = DB::getQueryLog();
dd($queries);
```

---

## Caching Strategies

### Configuration Cache

```bash
# Cache configuration
php artisan config:cache

# Clear config cache
php artisan config:clear
```

### Route Cache

```bash
# Cache routes
php artisan route:cache

# Clear route cache
php artisan route:clear
```

### View Cache

```bash
# Cache views
php artisan view:cache

# Clear view cache
php artisan view:clear
```

### Application Cache

**Products Cache:**

```php
use Illuminate\Support\Facades\Cache;

// Cache product list
$products = Cache::remember('products.all', 3600, function () {
    return Product::with('category')->get();
});

// Cache single product
$product = Cache::remember("product.{$id}", 3600, function () use ($id) {
    return Product::with(['category', 'images'])->find($id);
});
```

### Cache Tags (Redis only)

```php
// Store with tags
Cache::tags(['products', 'featured'])->put('products.featured', $products, 3600);

// Retrieve with tags
$products = Cache::tags(['products', 'featured'])->get('products.featured');

// Flush specific tags
Cache::tags('products')->flush();
```

### Fragment Caching in Blade

```blade
@cache('sidebar', 3600)
    <div class="sidebar">
        @foreach($categories as $category)
            <a href="/category/{{ $category->slug }}">{{ $category->name }}</a>
        @endforeach
    </div>
@endcache
```

### Cache Warming

```php
// app/Console/Commands/WarmCache.php
public function handle()
{
    // Warm product cache
    Cache::remember('products.all', 3600, function () {
        return Product::with('category')->get();
    });
    
    // Warm category cache
    Cache::remember('categories.all', 86400, function () {
        return Category::all();
    });
    
    $this->info('Cache warmed successfully!');
}
```

---

## Redis Configuration

### Optimal Redis Settings

**File: `.env`**

```env
REDIS_CLIENT=phpredis
REDIS_HOST=redis-14922.c81.us-east-1-2.ec2.cloud.redislabs.com
REDIS_PORT=14922
REDIS_PASSWORD=cTEkPz7F9DCqe7HBEpnmHBLouUlAofUB
REDIS_DB=0

# Separate databases for different purposes
REDIS_CACHE_DB=0
REDIS_SESSION_DB=1
REDIS_QUEUE_DB=2
```

**File: `config/database.php`**

```php
'redis' => [
    'client' => env('REDIS_CLIENT', 'phpredis'),
    
    'default' => [
        'host' => env('REDIS_HOST', '127.0.0.1'),
        'password' => env('REDIS_PASSWORD', null),
        'port' => env('REDIS_PORT', 6379),
        'database' => env('REDIS_DB', 0),
        'read_timeout' => 60,
        'timeout' => 5,
        'persistent' => true,
    ],
    
    'cache' => [
        'host' => env('REDIS_HOST', '127.0.0.1'),
        'password' => env('REDIS_PASSWORD', null),
        'port' => env('REDIS_PORT', 6379),
        'database' => env('REDIS_CACHE_DB', 0),
    ],
    
    'session' => [
        'host' => env('REDIS_HOST', '127.0.0.1'),
        'password' => env('REDIS_PASSWORD', null),
        'port' => env('REDIS_PORT', 6379),
        'database' => env('REDIS_SESSION_DB', 1),
    ],
],
```

### Redis Connection Pooling

```php
// Use persistent connections
'redis' => [
    'default' => [
        'persistent' => true,
        'persistent_id' => 'keohams',
    ],
],
```

### Redis Memory Optimization

```bash
# Set max memory policy
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Set max memory
redis-cli CONFIG SET maxmemory 256mb
```

---

## Session Optimization

### Redis Sessions

**File: `.env`**

```env
SESSION_DRIVER=redis
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_COOKIE=keohams_session
SESSION_DOMAIN=.keohams.com
```

**File: `config/session.php`**

```php
'driver' => env('SESSION_DRIVER', 'redis'),
'connection' => 'session',
'expire_on_close' => false,
'encrypt' => false,
'cookie' => env('SESSION_COOKIE', 'keohams_session'),
'domain' => env('SESSION_DOMAIN', null),
'secure' => env('SESSION_SECURE_COOKIE', true),
'http_only' => true,
'same_site' => 'lax',
```

### Session Cleanup

```bash
# Add to cron (daily)
php artisan session:gc
```

---

## Asset Optimization

### Laravel Mix Configuration

**File: `webpack.mix.js`**

```javascript
const mix = require('laravel-mix');

mix.js('resources/js/app.js', 'public/js')
   .sass('resources/sass/app.scss', 'public/css')
   .options({
       processCssUrls: false,
       postCss: [
           require('autoprefixer'),
           require('cssnano')({
               preset: ['default', {
                   discardComments: {
                       removeAll: true,
                   },
               }]
           }),
       ],
   });

if (mix.inProduction()) {
    mix.version()
       .sourceMaps(false, 'source-map')
       .minify('public/js/app.js')
       .minify('public/css/app.css');
} else {
    mix.sourceMaps();
}
```

### Compile Production Assets

```bash
# Install dependencies
npm install

# Compile for production
npm run production

# Verify file sizes
ls -lh public/js/
ls -lh public/css/
```

### CSS/JS Minification

```json
// package.json
{
  "scripts": {
    "dev": "mix",
    "watch": "mix watch",
    "prod": "mix --production",
    "production": "npm run prod"
  },
  "devDependencies": {
    "laravel-mix": "^6.0.0",
    "autoprefixer": "^10.4.0",
    "cssnano": "^5.0.0"
  }
}
```

---

## Image Optimization

### Intervention Image Configuration

```php
// config/image.php
return [
    'driver' => 'gd',
    'quality' => 85,
    'max_width' => 1920,
    'max_height' => 1080,
    'thumbnails' => [
        'small' => [100, 100],
        'medium' => [300, 300],
        'large' => [800, 800],
    ],
];
```

### Image Optimization Service

```php
use Intervention\Image\Facades\Image;

public function optimizeImage($file, $path)
{
    $image = Image::make($file);
    
    // Resize if too large
    if ($image->width() > 1920) {
        $image->resize(1920, null, function ($constraint) {
            $constraint->aspectRatio();
            $constraint->upsize();
        });
    }
    
    // Optimize quality
    $image->save($path, 85);
    
    return $path;
}
```

### WebP Conversion

```php
public function convertToWebP($imagePath)
{
    $image = Image::make($imagePath);
    $webpPath = preg_replace('/\.[^.]+$/', '.webp', $imagePath);
    $image->encode('webp', 85)->save($webpPath);
    return $webpPath;
}
```

### Lazy Loading Images

```html
<img src="placeholder.jpg" 
     data-src="image.jpg" 
     class="lazyload" 
     alt="Product">

<script>
document.addEventListener('DOMContentLoaded', function() {
    const images = document.querySelectorAll('.lazyload');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazyload');
                observer.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
});
</script>
```

---

## HTTP/2 and Compression

### Enable Gzip Compression

**File: `public/.htaccess`**

```apache
<IfModule mod_deflate.c>
    # Compress HTML, CSS, JavaScript, Text, XML and fonts
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/vnd.ms-fontobject
    AddOutputFilterByType DEFLATE application/x-font
    AddOutputFilterByType DEFLATE application/x-font-opentype
    AddOutputFilterByType DEFLATE application/x-font-otf
    AddOutputFilterByType DEFLATE application/x-font-truetype
    AddOutputFilterByType DEFLATE application/x-font-ttf
    AddOutputFilterByType DEFLATE application/x-javascript
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE font/opentype
    AddOutputFilterByType DEFLATE font/otf
    AddOutputFilterByType DEFLATE font/ttf
    AddOutputFilterByType DEFLATE image/svg+xml
    AddOutputFilterByType DEFLATE image/x-icon
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/javascript
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/xml
    
    # Remove browser bugs
    BrowserMatch ^Mozilla/4 gzip-only-text/html
    BrowserMatch ^Mozilla/4\.0[678] no-gzip
    BrowserMatch \bMSIE !no-gzip !gzip-only-text/html
    Header append Vary User-Agent
</IfModule>
```

### Browser Caching

**File: `public/.htaccess`**

```apache
<IfModule mod_expires.c>
    ExpiresActive On
    
    # Images
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/webp "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
    ExpiresByType image/x-icon "access plus 1 year"
    
    # CSS and JavaScript
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
    ExpiresByType text/javascript "access plus 1 month"
    
    # Fonts
    ExpiresByType application/x-font-ttf "access plus 1 year"
    ExpiresByType font/opentype "access plus 1 year"
    ExpiresByType application/x-font-woff "access plus 1 year"
    ExpiresByType application/font-woff "access plus 1 year"
    ExpiresByType application/font-woff2 "access plus 1 year"
    
    # Others
    ExpiresByType application/pdf "access plus 1 month"
    ExpiresByType text/html "access plus 0 seconds"
</IfModule>
```

### Enable HTTP/2

In cPanel, enable HTTP/2 through:
1. **Software** → **MultiPHP Manager**
2. Enable **HTTP/2**

Verify:
```bash
curl -I --http2 https://keohams.com
```

---

## CDN Integration

### CloudFlare Setup

1. Sign up at https://cloudflare.com
2. Add domain: keohams.com
3. Update nameservers
4. Enable features:
   - Auto Minify (CSS, JS, HTML)
   - Brotli compression
   - Rocket Loader
   - Polish (image optimization)

### CDN Asset URLs

**File: `.env`**

```env
ASSET_URL=https://cdn.keohams.com
```

**Usage in Blade:**

```blade
<link rel="stylesheet" href="{{ asset('css/app.css') }}">
<!-- Outputs: https://cdn.keohams.com/css/app.css -->
```

---

## Queue Optimization

### Queue Configuration

**File: `config/queue.php`**

```php
'redis' => [
    'driver' => 'redis',
    'connection' => 'default',
    'queue' => env('REDIS_QUEUE', 'default'),
    'retry_after' => 90,
    'block_for' => null,
    'after_commit' => false,
],
```

### Queue Workers

```bash
# Start multiple workers
php artisan queue:work --sleep=3 --tries=3 --max-jobs=1000 --max-time=3600 &
php artisan queue:work --sleep=3 --tries=3 --max-jobs=1000 --max-time=3600 &

# Process high priority jobs first
php artisan queue:work --queue=high,default,low
```

### Horizon (Redis Queue Manager)

```bash
# Install Horizon
composer require laravel/horizon

# Publish config
php artisan horizon:install

# Start Horizon
php artisan horizon
```

---

## Monitoring and Profiling

### Laravel Telescope (Development)

```bash
composer require laravel/telescope --dev
php artisan telescope:install
php artisan migrate
```

### Performance Report Command

```bash
php artisan performance:report
```

### Query Performance Monitoring

```php
DB::listen(function ($query) {
    if ($query->time > 100) { // Log slow queries (>100ms)
        Log::warning('Slow query detected', [
            'sql' => $query->sql,
            'bindings' => $query->bindings,
            'time' => $query->time,
        ]);
    }
});
```

### Response Time Middleware

```php
// app/Http/Middleware/LogResponseTime.php
public function handle($request, Closure $next)
{
    $start = microtime(true);
    $response = $next($request);
    $duration = (microtime(true) - $start) * 1000;
    
    if ($duration > 200) {
        Log::info('Slow response', [
            'url' => $request->fullUrl(),
            'method' => $request->method(),
            'duration' => round($duration, 2) . 'ms',
        ]);
    }
    
    $response->headers->set('X-Response-Time', round($duration, 2) . 'ms');
    return $response;
}
```

---

## Load Testing

### Apache Bench

```bash
# Test homepage
ab -n 1000 -c 10 https://keohams.com/

# Test API endpoint
ab -n 1000 -c 10 -H "Authorization: Bearer token" https://keohams.com/api/products
```

### Siege

```bash
# Install Siege
sudo apt-get install siege

# Run load test
siege -c 50 -t 60s https://keohams.com/

# Test with URLs file
siege -c 50 -t 60s -f urls.txt
```

### Expected Results

```
Transactions:              3000 hits
Availability:              100.00 %
Elapsed time:              59.23 secs
Data transferred:          125.45 MB
Response time:             0.18 secs
Transaction rate:          50.67 trans/sec
Throughput:                2.12 MB/sec
Concurrency:               9.12
Successful transactions:   3000
Failed transactions:       0
```

---

## Performance Checklist

See [PERFORMANCE_CHECKLIST.md](./PERFORMANCE_CHECKLIST.md) for a complete checklist of optimization tasks.

---

**Performance Guide Version:** 1.0  
**Last Updated:** November 16, 2025  
**Laravel Version:** 10.49.1

© 2025 KEOHAMS. All rights reserved.
