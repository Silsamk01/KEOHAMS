# KEOHAMS Developer Documentation

**Technical Documentation for KEOHAMS E-Commerce Platform**

Version 1.0 | Last Updated: November 16, 2025

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Installation & Setup](#installation--setup)
6. [Database Schema](#database-schema)
7. [API Development](#api-development)
8. [Authentication & Authorization](#authentication--authorization)
9. [Services & Helpers](#services--helpers)
10. [Caching Strategy](#caching-strategy)
11. [Queue Jobs](#queue-jobs)
12. [Testing](#testing)
13. [Deployment](#deployment)
14. [Performance Optimization](#performance-optimization)
15. [Contributing Guidelines](#contributing-guidelines)
16. [Troubleshooting](#troubleshooting)

---

## Project Overview

### About KEOHAMS

KEOHAMS is a full-featured e-commerce platform built with Laravel 10, designed for production deployment on cPanel hosting with comprehensive features including:

- Product catalog management
- Shopping cart and checkout
- Multiple payment gateways (Paystack)
- Multi-level affiliate system
- KYC verification with facial recognition
- Custom quotation system
- Blog with public/private separation
- Real-time notifications
- Advanced security features

### Project Goals

- **Scalability:** Handle thousands of concurrent users
- **Performance:** Sub-200ms API response times
- **Security:** Industry-standard security practices
- **Maintainability:** Clean, documented, testable code
- **Extensibility:** Easy to add new features

### Repository

**GitHub:** https://github.com/Silsamk01/KEOHAMS  
**Branch:** main  
**License:** Proprietary

---

## Architecture

### Application Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client Layer                         │
│  (Browser / Mobile App / API Consumers)                  │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│                  API Gateway Layer                       │
│  (Laravel Routes / Middleware / Rate Limiting)           │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│              Business Logic Layer                        │
│  (Controllers / Services / Repositories)                 │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│                  Data Layer                              │
│  (Models / Database / Cache / Queue)                     │
└─────────────────────────────────────────────────────────┘
```

### Design Patterns

**Repository Pattern:**
- Abstracts data layer
- Easy to test
- Swappable data sources

**Service Pattern:**
- Business logic separation
- Reusable components
- Testable units

**Observer Pattern:**
- Event-driven architecture
- Loosely coupled components
- Easy to extend

**Factory Pattern:**
- Object creation
- Testing with fake data

---

## Technology Stack

### Backend

**Core Framework:**
- Laravel 10.49.1
- PHP 8.4.14

**Database:**
- MySQL 8.0
- Redis 7.0 (caching & queues)

**Authentication:**
- Laravel Sanctum
- Custom 2FA implementation

**Queue System:**
- Redis driver
- Background job processing

**Email:**
- SMTP (server165.web-hosting.com)
- Queue-based sending

**Payment:**
- Paystack API integration

### Frontend

**Core Technologies:**
- HTML5
- CSS3
- JavaScript (ES6+)
- Bootstrap 5

**Asset Management:**
- Laravel Mix
- Webpack
- NPM

### Development Tools

**Testing:**
- PHPUnit 10.x
- 220+ test cases

**Code Quality:**
- PHP CS Fixer
- PHPStan (level 5)
- ESLint

**Version Control:**
- Git
- GitHub

**CI/CD:**
- Git deployment hooks
- Automated testing

---

## Project Structure

### Directory Structure

```
laravel/
├── app/
│   ├── Console/
│   │   └── Commands/          # Artisan commands
│   ├── Events/                # Event classes
│   ├── Exceptions/            # Exception handlers
│   ├── Http/
│   │   ├── Controllers/       # HTTP controllers
│   │   ├── Middleware/        # Request middleware
│   │   └── Requests/          # Form requests
│   ├── Jobs/                  # Queue jobs
│   ├── Listeners/             # Event listeners
│   ├── Models/                # Eloquent models
│   ├── Notifications/         # Notification classes
│   ├── Policies/              # Authorization policies
│   ├── Providers/             # Service providers
│   └── Services/              # Business logic services
├── bootstrap/
│   └── cache/                 # Framework cache
├── config/                    # Configuration files
├── database/
│   ├── factories/             # Model factories
│   ├── migrations/            # Database migrations
│   └── seeders/               # Database seeders
├── docs/                      # Documentation
├── public/                    # Public assets
├── resources/
│   ├── css/                   # Stylesheets
│   ├── js/                    # JavaScript
│   └── views/                 # Blade templates
├── routes/
│   ├── api.php                # API routes
│   ├── web.php                # Web routes
│   └── channels.php           # Broadcasting channels
├── scripts/                   # Utility scripts
├── storage/
│   ├── app/                   # Application storage
│   ├── framework/             # Framework storage
│   └── logs/                  # Log files
├── tests/
│   ├── Feature/               # Feature tests
│   └── Unit/                  # Unit tests
└── vendor/                    # Composer dependencies
```

### Key Files

```
.env                           # Environment configuration
.env.production.example        # Production environment template
composer.json                  # PHP dependencies
package.json                   # NPM dependencies
webpack.mix.js                 # Asset compilation
phpunit.xml                    # PHPUnit configuration
.cpanel.yml                    # cPanel deployment config
```

---

## Installation & Setup

### Prerequisites

- PHP 8.1 or higher
- Composer 2.x
- MySQL 8.0
- Redis Server
- Node.js 18.x & NPM
- Git

### Local Development Setup

**1. Clone Repository:**
```bash
git clone https://github.com/Silsamk01/KEOHAMS.git
cd KEOHAMS/laravel
```

**2. Install Dependencies:**
```bash
# PHP dependencies
composer install

# JavaScript dependencies
npm install
```

**3. Environment Configuration:**
```bash
# Copy environment file
cp .env.example .env

# Generate application key
php artisan key:generate
```

**4. Configure Database:**

Edit `.env`:
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=keohams_local
DB_USERNAME=root
DB_PASSWORD=your_password
```

**5. Configure Redis:**
```env
CACHE_DRIVER=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=null
```

**6. Run Migrations:**
```bash
php artisan migrate
```

**7. Seed Database:**
```bash
php artisan db:seed
```

**8. Create Storage Link:**
```bash
php artisan storage:link
```

**9. Compile Assets:**
```bash
npm run dev
```

**10. Start Development Server:**
```bash
php artisan serve
```

**11. Start Queue Worker:**
```bash
php artisan queue:work
```

Visit: http://localhost:8000

---

## Database Schema

### Core Tables

#### users
```sql
CREATE TABLE users (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified_at TIMESTAMP NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role ENUM('admin', 'manager', 'customer') DEFAULT 'customer',
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    avatar VARCHAR(255),
    two_factor_secret TEXT,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    kyc_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
    affiliate_code VARCHAR(20) UNIQUE,
    referred_by BIGINT UNSIGNED NULL,
    remember_token VARCHAR(100),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL
);
```

#### products
```sql
CREATE TABLE products (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    sku VARCHAR(100) UNIQUE,
    price DECIMAL(10,2) NOT NULL,
    sale_price DECIMAL(10,2),
    cost_price DECIMAL(10,2),
    stock_quantity INT DEFAULT 0,
    low_stock_threshold INT DEFAULT 10,
    weight DECIMAL(8,2),
    dimensions VARCHAR(100),
    category_id BIGINT UNSIGNED,
    brand VARCHAR(100),
    featured BOOLEAN DEFAULT FALSE,
    status ENUM('active', 'inactive', 'out_of_stock') DEFAULT 'active',
    meta_title VARCHAR(255),
    meta_description TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    INDEX idx_slug (slug),
    INDEX idx_category (category_id),
    INDEX idx_status (status),
    INDEX idx_featured (featured)
);
```

#### orders
```sql
CREATE TABLE orders (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
    payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
    payment_method VARCHAR(50),
    subtotal DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) DEFAULT 0,
    shipping_fee DECIMAL(10,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    tracking_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_order_number (order_number),
    INDEX idx_user (user_id),
    INDEX idx_status (status),
    INDEX idx_payment_status (payment_status)
);
```

### Relationships

**User Relations:**
- Has many orders
- Has many notifications
- Has many security events
- Belongs to referrer (self-referential)
- Has many referrals

**Product Relations:**
- Belongs to category
- Has many images
- Has many order items
- Has many reviews

**Order Relations:**
- Belongs to user
- Has many order items
- Has one shipping address
- Has one billing address

### Indexes

Performance indexes on:
- Foreign keys
- Search fields (name, email, sku)
- Filter fields (status, role, category_id)
- Sort fields (created_at, price)

---

## API Development

### Creating New Endpoint

**1. Create Route:**

`routes/api.php`:
```php
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/products', [ProductController::class, 'index']);
    Route::post('/products', [ProductController::class, 'store']);
    Route::get('/products/{id}', [ProductController::class, 'show']);
    Route::put('/products/{id}', [ProductController::class, 'update']);
    Route::delete('/products/{id}', [ProductController::class, 'destroy']);
});
```

**2. Create Controller:**

`app/Http/Controllers/ProductController.php`:
```php
<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProductRequest;
use App\Http\Requests\UpdateProductRequest;
use App\Services\ProductService;
use Illuminate\Http\JsonResponse;

class ProductController extends Controller
{
    public function __construct(
        private ProductService $productService
    ) {}

    public function index(): JsonResponse
    {
        $products = $this->productService->getAllProducts();
        
        return response()->json([
            'success' => true,
            'data' => $products
        ]);
    }

    public function store(StoreProductRequest $request): JsonResponse
    {
        $product = $this->productService->createProduct($request->validated());
        
        return response()->json([
            'success' => true,
            'message' => 'Product created successfully',
            'data' => $product
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $product = $this->productService->getProduct($id);
        
        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found'
            ], 404);
        }
        
        return response()->json([
            'success' => true,
            'data' => $product
        ]);
    }

    public function update(UpdateProductRequest $request, int $id): JsonResponse
    {
        $product = $this->productService->updateProduct($id, $request->validated());
        
        return response()->json([
            'success' => true,
            'message' => 'Product updated successfully',
            'data' => $product
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $this->productService->deleteProduct($id);
        
        return response()->json([
            'success' => true,
            'message' => 'Product deleted successfully'
        ]);
    }
}
```

**3. Create Form Request:**

`app/Http/Requests/StoreProductRequest.php`:
```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create-products');
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'description' => 'required|string',
            'price' => 'required|numeric|min:0',
            'sku' => 'required|string|unique:products,sku',
            'category_id' => 'required|exists:categories,id',
            'stock_quantity' => 'required|integer|min:0',
            'images' => 'nullable|array',
            'images.*' => 'image|mimes:jpeg,png,jpg,webp|max:5120'
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Product name is required',
            'price.min' => 'Price must be greater than zero',
            'sku.unique' => 'This SKU already exists'
        ];
    }
}
```

**4. Create Service:**

`app/Services/ProductService.php`:
```php
<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class ProductService
{
    public function getAllProducts(array $filters = []): array
    {
        $query = Product::with(['category', 'images']);
        
        if (isset($filters['search'])) {
            $query->where('name', 'LIKE', "%{$filters['search']}%");
        }
        
        if (isset($filters['category_id'])) {
            $query->where('category_id', $filters['category_id']);
        }
        
        $products = $query->paginate($filters['per_page'] ?? 15);
        
        return [
            'products' => $products->items(),
            'pagination' => [
                'current_page' => $products->currentPage(),
                'total' => $products->total(),
                'per_page' => $products->perPage(),
                'last_page' => $products->lastPage()
            ]
        ];
    }

    public function createProduct(array $data): Product
    {
        DB::beginTransaction();
        
        try {
            $data['slug'] = Str::slug($data['name']);
            
            $product = Product::create($data);
            
            if (isset($data['images'])) {
                $this->handleImageUpload($product, $data['images']);
            }
            
            DB::commit();
            
            return $product->load(['category', 'images']);
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    public function getProduct(int $id): ?Product
    {
        return Product::with(['category', 'images', 'reviews'])
            ->find($id);
    }

    public function updateProduct(int $id, array $data): Product
    {
        $product = Product::findOrFail($id);
        
        if (isset($data['name'])) {
            $data['slug'] = Str::slug($data['name']);
        }
        
        $product->update($data);
        
        return $product->fresh(['category', 'images']);
    }

    public function deleteProduct(int $id): bool
    {
        $product = Product::findOrFail($id);
        return $product->delete();
    }

    private function handleImageUpload(Product $product, array $images): void
    {
        foreach ($images as $index => $image) {
            $path = $image->store('products', 'public');
            
            $product->images()->create([
                'url' => $path,
                'is_primary' => $index === 0
            ]);
        }
    }
}
```

**5. Write Tests:**

`tests/Feature/ProductApiTest.php`:
```php
<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_get_products(): void
    {
        Product::factory()->count(5)->create();
        
        $response = $this->getJson('/api/products');
        
        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'products',
                    'pagination'
                ]
            ]);
    }

    public function test_can_create_product(): void
    {
        $admin = User::factory()->admin()->create();
        
        $data = [
            'name' => 'Test Product',
            'description' => 'Test description',
            'price' => 100.00,
            'sku' => 'TEST-001',
            'category_id' => 1,
            'stock_quantity' => 50
        ];
        
        $response = $this->actingAs($admin)
            ->postJson('/api/products', $data);
        
        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Product created successfully'
            ]);
        
        $this->assertDatabaseHas('products', [
            'name' => 'Test Product',
            'sku' => 'TEST-001'
        ]);
    }
}
```

### API Best Practices

**Response Format:**
```php
// Success response
return response()->json([
    'success' => true,
    'message' => 'Operation successful',
    'data' => $data
], 200);

// Error response
return response()->json([
    'success' => false,
    'message' => 'Operation failed',
    'errors' => $errors
], 400);
```

**Pagination:**
```php
$items = Model::paginate(15);

return response()->json([
    'success' => true,
    'data' => [
        'items' => $items->items(),
        'pagination' => [
            'current_page' => $items->currentPage(),
            'total' => $items->total(),
            'per_page' => $items->perPage(),
            'last_page' => $items->lastPage(),
            'has_more' => $items->hasMorePages()
        ]
    ]
]);
```

**Error Handling:**
```php
try {
    // Operation
} catch (ModelNotFoundException $e) {
    return response()->json([
        'success' => false,
        'message' => 'Resource not found'
    ], 404);
} catch (ValidationException $e) {
    return response()->json([
        'success' => false,
        'message' => 'Validation failed',
        'errors' => $e->errors()
    ], 422);
} catch (\Exception $e) {
    Log::error('API Error: ' . $e->getMessage());
    
    return response()->json([
        'success' => false,
        'message' => 'Internal server error'
    ], 500);
}
```

---

## Authentication & Authorization

### Laravel Sanctum

**Configuration:**

`config/sanctum.php`:
```php
'expiration' => 1440, // 24 hours
'middleware' => [
    'encrypt_cookies' => App\Http\Middleware\EncryptCookies::class,
    'verify_csrf_token' => App\Http\Middleware\VerifyCsrfToken::class,
],
```

**Issuing Tokens:**
```php
$token = $user->createToken('auth-token')->plainTextToken;

return response()->json([
    'token' => $token,
    'token_type' => 'Bearer',
    'expires_in' => 86400
]);
```

**Protecting Routes:**
```php
Route::middleware('auth:sanctum')->group(function () {
    // Protected routes
});
```

### Two-Factor Authentication

**Enable 2FA:**
```php
use PragmaRX\Google2FA\Google2FA;

$google2fa = new Google2FA();
$secret = $google2fa->generateSecretKey();

$user->update([
    'two_factor_secret' => encrypt($secret),
    'two_factor_enabled' => true
]);

$qrCodeUrl = $google2fa->getQRCodeUrl(
    'KEOHAMS',
    $user->email,
    $secret
);
```

**Verify 2FA:**
```php
$google2fa = new Google2FA();
$secret = decrypt($user->two_factor_secret);

$valid = $google2fa->verifyKey($secret, $code);
```

### Policies

**Creating Policy:**
```bash
php artisan make:policy ProductPolicy --model=Product
```

`app/Policies/ProductPolicy.php`:
```php
<?php

namespace App\Policies;

use App\Models\Product;
use App\Models\User;

class ProductPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Product $product): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return in_array($user->role, ['admin', 'manager']);
    }

    public function update(User $user, Product $product): bool
    {
        return in_array($user->role, ['admin', 'manager']);
    }

    public function delete(User $user, Product $product): bool
    {
        return $user->role === 'admin';
    }
}
```

**Using Policies:**
```php
// In controller
$this->authorize('update', $product);

// In form request
public function authorize(): bool
{
    return $this->user()->can('create', Product::class);
}

// In blade
@can('update', $product)
    <button>Edit</button>
@endcan
```

---

## Services & Helpers

### Service Classes

**Location:** `app/Services/`

**CacheService:**
```php
use App\Services\CacheService;

$cacheService = app(CacheService::class);

// Cache product
$cacheService->cacheProduct($productId, $productData);

// Get cached product
$product = $cacheService->getProduct($productId);

// Cache with custom TTL
$cacheService->put('key', $value, CacheService::TTL_LONG);
```

**NotificationService:**
```php
use App\Services\NotificationService;

$notificationService = app(NotificationService::class);

// Send notification to user
$notificationService->sendToUser($userId, 'Order Shipped', [
    'order_id' => $orderId,
    'tracking_number' => $trackingNumber
]);

// Send to multiple users
$notificationService->sendToMultipleUsers($userIds, 'Bulk Message', $data);
```

**SecurityService:**
```php
use App\Services\SecurityService;

$securityService = app(SecurityService::class);

// Log security event
$securityService->logEvent($userId, 'login', $ipAddress);

// Check if IP is blocked
if ($securityService->isIpBlocked($ipAddress)) {
    abort(403, 'Access denied');
}

// Block IP
$securityService->blockIp($ipAddress, 3600); // 1 hour
```

### Helper Functions

**Location:** `app/Helpers/helpers.php`

**Common Helpers:**
```php
// Format currency
formatCurrency(12000.00); // ₦12,000.00

// Generate order number
$orderNumber = generateOrderNumber(); // ORD-20251116-001

// Upload file
$path = uploadFile($file, 'products');

// Generate unique code
$code = generateUniqueCode('users', 'affiliate_code', 8);

// Calculate discount
$salePrice = calculateDiscount(15000, 20); // 12000

// Get client IP
$ip = getClientIp();
```

---

## Caching Strategy

### Cache Configuration

`config/cache.php`:
```php
'default' => env('CACHE_DRIVER', 'redis'),

'stores' => [
    'redis' => [
        'driver' => 'redis',
        'connection' => 'cache',
        'lock_connection' => 'default',
    ],
],
```

### Cache Usage

**Basic Caching:**
```php
// Store in cache
Cache::put('key', 'value', now()->addHour());

// Retrieve from cache
$value = Cache::get('key', 'default');

// Remember pattern
$products = Cache::remember('products.featured', 3600, function () {
    return Product::where('featured', true)->get();
});

// Cache forever
Cache::forever('settings.site_name', 'KEOHAMS');

// Forget cache
Cache::forget('key');

// Flush all cache
Cache::flush();
```

**Cache Tags (Redis only):**
```php
// Tag-based caching
Cache::tags(['products', 'featured'])->put('products.featured', $products, 3600);

// Retrieve tagged cache
$products = Cache::tags(['products', 'featured'])->get('products.featured');

// Flush tagged cache
Cache::tags('products')->flush();
```

### Model Caching

**Cache Observer:**
```php
namespace App\Observers;

use App\Models\Product;
use Illuminate\Support\Facades\Cache;

class ProductObserver
{
    public function created(Product $product): void
    {
        Cache::tags('products')->flush();
    }

    public function updated(Product $product): void
    {
        Cache::forget("product.{$product->id}");
        Cache::tags('products')->flush();
    }

    public function deleted(Product $product): void
    {
        Cache::forget("product.{$product->id}");
        Cache::tags('products')->flush();
    }
}
```

**Register Observer:**
```php
// app/Providers/EventServiceProvider.php
protected $observers = [
    Product::class => [ProductObserver::class],
];
```

### Query Caching

```php
// Cache query results
$products = Product::remember(3600)->get();

// Cache with tags
$products = Product::cacheTags(['products'])->remember(3600)->get();
```

---

## Queue Jobs

### Job Configuration

`config/queue.php`:
```php
'default' => env('QUEUE_CONNECTION', 'redis'),

'connections' => [
    'redis' => [
        'driver' => 'redis',
        'connection' => 'default',
        'queue' => env('REDIS_QUEUE', 'default'),
        'retry_after' => 90,
        'block_for' => null,
    ],
],
```

### Creating Jobs

**Generate Job:**
```bash
php artisan make:job SendOrderConfirmationEmail
```

**Job Class:**
```php
<?php

namespace App\Jobs;

use App\Models\Order;
use App\Notifications\OrderConfirmationNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendOrderConfirmationEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $timeout = 60;

    public function __construct(
        public Order $order
    ) {}

    public function handle(): void
    {
        $this->order->user->notify(
            new OrderConfirmationNotification($this->order)
        );
    }

    public function failed(\Throwable $exception): void
    {
        // Handle job failure
        \Log::error('Order confirmation email failed', [
            'order_id' => $this->order->id,
            'error' => $exception->getMessage()
        ]);
    }
}
```

### Dispatching Jobs

**Immediate Dispatch:**
```php
SendOrderConfirmationEmail::dispatch($order);
```

**Delayed Dispatch:**
```php
SendOrderConfirmationEmail::dispatch($order)
    ->delay(now()->addMinutes(10));
```

**Chain Jobs:**
```php
Bus::chain([
    new ProcessOrder($order),
    new SendOrderConfirmationEmail($order),
    new UpdateInventory($order),
])->dispatch();
```

**Batch Jobs:**
```php
Bus::batch([
    new ProcessOrder($order1),
    new ProcessOrder($order2),
    new ProcessOrder($order3),
])->then(function (Batch $batch) {
    // All jobs completed
})->catch(function (Batch $batch, Throwable $e) {
    // First batch job failure
})->finally(function (Batch $batch) {
    // Batch finished executing
})->dispatch();
```

### Running Queue Workers

**Development:**
```bash
php artisan queue:work --tries=3 --timeout=60
```

**Production (Supervisor):**
```ini
[program:keohams-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /home/ngfaczol/public_html/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
user=ngfaczol
numprocs=2
redirect_stderr=true
stdout_logfile=/home/ngfaczol/public_html/storage/logs/worker.log
```

---

## Testing

### Running Tests

**All Tests:**
```bash
php vendor/bin/phpunit
```

**Specific Test Suite:**
```bash
php vendor/bin/phpunit --testsuite=Unit
php vendor/bin/phpunit --testsuite=Feature
```

**Specific Test:**
```bash
php vendor/bin/phpunit tests/Feature/ProductApiTest.php
```

**With Coverage:**
```bash
php vendor/bin/phpunit --coverage-html coverage
```

### Writing Tests

**Feature Test:**
```php
<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserFeatureTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'John Doe',
            'email' => 'john@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123'
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'user',
                    'token'
                ]
            ]);

        $this->assertDatabaseHas('users', [
            'email' => 'john@example.com'
        ]);
    }
}
```

**Unit Test:**
```php
<?php

namespace Tests\Unit;

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductUnitTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_has_correct_attributes(): void
    {
        $product = Product::factory()->create([
            'name' => 'Test Product',
            'price' => 100.00
        ]);

        $this->assertEquals('Test Product', $product->name);
        $this->assertEquals(100.00, $product->price);
    }

    public function test_product_can_be_marked_as_featured(): void
    {
        $product = Product::factory()->create(['featured' => false]);

        $product->update(['featured' => true]);

        $this->assertTrue($product->fresh()->featured);
    }
}
```

### Test Database

Configure test database in `phpunit.xml`:
```xml
<env name="DB_CONNECTION" value="mysql"/>
<env name="DB_DATABASE" value="keohams_test"/>
```

---

## Deployment

### Production Deployment

See [CPANEL_DEPLOYMENT_GUIDE.md](./CPANEL_DEPLOYMENT_GUIDE.md) for complete deployment instructions.

**Quick Deploy:**
```bash
bash deploy-cpanel.sh production
```

**Manual Steps:**
1. Upload files to cPanel
2. Run migrations
3. Optimize application
4. Set permissions
5. Configure cron jobs
6. Verify deployment

### Environment Configuration

**Production .env:**
```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://keohams.com

DB_CONNECTION=mysql
DB_HOST=localhost
DB_DATABASE=ngfaczol_keohams
DB_USERNAME=ngfaczol_keohams
DB_PASSWORD=your_password

CACHE_DRIVER=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis

REDIS_HOST=redis-14922.c81.us-east-1-2.ec2.cloud.redislabs.com
REDIS_PORT=14922
REDIS_PASSWORD=cTEkPz7F9DCqe7HBEpnmHBLouUlAofUB
```

### Optimization Commands

```bash
# Clear all caches
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear

# Optimize for production
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Warm up caches
php artisan cache:warmup

# Optimize database
php artisan db:optimize

# Generate sitemap
php artisan sitemap:generate
```

---

## Performance Optimization

### Database Optimization

**Indexes:**
- Added on foreign keys
- Added on frequently queried columns
- Composite indexes for complex queries

**Query Optimization:**
```php
// Eager loading
$products = Product::with(['category', 'images'])->get();

// Lazy eager loading
$products = Product::all();
$products->load('reviews');

// Select specific columns
Product::select('id', 'name', 'price')->get();

// Chunk large queries
Product::chunk(100, function ($products) {
    foreach ($products as $product) {
        // Process
    }
});
```

**Database Connection Pooling:**
```php
'mysql' => [
    'options' => [
        PDO::ATTR_PERSISTENT => false,
        PDO::ATTR_EMULATE_PREPARES => true,
    ],
],
```

### Caching Strategy

**Application Cache:**
- Products: 1 hour
- Categories: 1 day
- Settings: Forever
- User data: 30 minutes

**OPcache:**
- Configured for production
- Preloading enabled
- 256MB memory allocation

**Query Cache:**
- Frequently accessed data
- Redis-based caching

### Asset Optimization

**Webpack Mix:**
```javascript
mix.js('resources/js/app.js', 'public/js')
   .sass('resources/sass/app.scss', 'public/css')
   .version()
   .sourceMaps(false, 'source-map');

if (mix.inProduction()) {
    mix.minify('public/js/app.js')
       .minify('public/css/app.css');
}
```

**Image Optimization:**
- Compress images before upload
- Use WebP format
- Lazy loading
- CDN integration

---

## Contributing Guidelines

### Code Style

**PHP CS Fixer:**
```bash
./vendor/bin/php-cs-fixer fix
```

**PSR-12 Standard:**
- Follow PSR-12 coding standard
- Use type hints
- Document all methods

### Git Workflow

**Branching:**
```
main           Production-ready code
develop        Development branch
feature/*      New features
bugfix/*       Bug fixes
hotfix/*       Emergency fixes
```

**Commit Messages:**
```
feat: Add new product feature
fix: Resolve login issue
docs: Update API documentation
test: Add product tests
refactor: Improve performance
```

### Pull Requests

**PR Template:**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Checklist
- [ ] Tests pass
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] No console errors
```

---

## Troubleshooting

### Common Issues

**Issue: 500 Internal Server Error**
```bash
# Check logs
tail -f storage/logs/laravel.log

# Clear cache
php artisan cache:clear
php artisan config:clear

# Check permissions
chmod -R 775 storage bootstrap/cache
```

**Issue: Database Connection Failed**
```bash
# Verify credentials in .env
# Test connection
php artisan migrate:status
```

**Issue: Queue Jobs Not Processing**
```bash
# Check queue worker
ps aux | grep queue:work

# Restart queue worker
php artisan queue:restart

# Check failed jobs
php artisan queue:failed
```

### Debugging Tools

**Laravel Telescope:**
```bash
composer require laravel/telescope --dev
php artisan telescope:install
php artisan migrate
```

**Query Logging:**
```php
DB::enableQueryLog();
// Your queries
dd(DB::getQueryLog());
```

**Debug Bar:**
```bash
composer require barryvdh/laravel-debugbar --dev
```

---

## Support & Resources

**Documentation:** https://keohams.com/docs  
**Repository:** https://github.com/Silsamk01/KEOHAMS  
**Technical Support:** Ohamskenneth08@gmail.com  

**Laravel Resources:**
- https://laravel.com/docs
- https://laracasts.com
- https://laravel-news.com

---

**Developer Documentation Version:** 1.0  
**Last Updated:** November 16, 2025  
**Laravel Version:** 10.49.1  
**PHP Version:** 8.4.14
