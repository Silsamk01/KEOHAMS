<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class CacheService
{
    /**
     * Cache TTL values (in seconds)
     */
    const TTL_SHORT = 300;       // 5 minutes
    const TTL_MEDIUM = 1800;     // 30 minutes
    const TTL_LONG = 3600;       // 1 hour
    const TTL_DAY = 86400;       // 24 hours
    const TTL_WEEK = 604800;     // 7 days

    /**
     * Alias for cache warmup command
     */
    const CACHE_LONG = self::TTL_LONG;

    /**
     * Cache key prefixes
     */
    const PREFIX_USER = 'user:';
    const PREFIX_PRODUCT = 'product:';
    const PREFIX_CATEGORY = 'category:';
    const PREFIX_CART = 'cart:';
    const PREFIX_SETTINGS = 'settings:';
    const PREFIX_STATS = 'stats:';
    const PREFIX_AFFILIATE = 'affiliate:';

    /**
     * Remember a value in cache or retrieve it
     *
     * @param string $key
     * @param int $ttl
     * @param callable $callback
     * @return mixed
     */
    public function remember(string $key, int $ttl, callable $callback)
    {
        try {
            return Cache::remember($key, $ttl, $callback);
        } catch (\Exception $e) {
            Log::error('Cache remember failed', [
                'key' => $key,
                'error' => $e->getMessage()
            ]);
            return $callback();
        }
    }

    /**
     * Get a value from cache
     *
     * @param string $key
     * @param mixed $default
     * @return mixed
     */
    public function get(string $key, $default = null)
    {
        try {
            return Cache::get($key, $default);
        } catch (\Exception $e) {
            Log::error('Cache get failed', [
                'key' => $key,
                'error' => $e->getMessage()
            ]);
            return $default;
        }
    }

    /**
     * Store a value in cache
     *
     * @param string $key
     * @param mixed $value
     * @param int $ttl
     * @return bool
     */
    public function put(string $key, $value, int $ttl = self::TTL_MEDIUM): bool
    {
        try {
            return Cache::put($key, $value, $ttl);
        } catch (\Exception $e) {
            Log::error('Cache put failed', [
                'key' => $key,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Store a value in cache forever
     *
     * @param string $key
     * @param mixed $value
     * @return bool
     */
    public function forever(string $key, $value): bool
    {
        try {
            return Cache::forever($key, $value);
        } catch (\Exception $e) {
            Log::error('Cache forever failed', [
                'key' => $key,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Remove a value from cache
     *
     * @param string $key
     * @return bool
     */
    public function forget(string $key): bool
    {
        try {
            return Cache::forget($key);
        } catch (\Exception $e) {
            Log::error('Cache forget failed', [
                'key' => $key,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Flush all cache
     *
     * @return bool
     */
    public function flush(): bool
    {
        try {
            return Cache::flush();
        } catch (\Exception $e) {
            Log::error('Cache flush failed', [
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Cache user data
     *
     * @param int $userId
     * @param mixed $data
     * @param int $ttl
     * @return bool
     */
    public function cacheUser(int $userId, $data, int $ttl = self::TTL_MEDIUM): bool
    {
        $key = self::PREFIX_USER . $userId;
        return $this->put($key, $data, $ttl);
    }

    /**
     * Get cached user data
     *
     * @param int $userId
     * @return mixed
     */
    public function getUser(int $userId)
    {
        $key = self::PREFIX_USER . $userId;
        return $this->get($key);
    }

    /**
     * Forget cached user data
     *
     * @param int $userId
     * @return bool
     */
    public function forgetUser(int $userId): bool
    {
        $key = self::PREFIX_USER . $userId;
        return $this->forget($key);
    }

    /**
     * Cache product data
     *
     * @param int $productId
     * @param mixed $data
     * @param int $ttl
     * @return bool
     */
    public function cacheProduct(int $productId, $data, int $ttl = self::TTL_LONG): bool
    {
        $key = self::PREFIX_PRODUCT . $productId;
        return $this->put($key, $data, $ttl);
    }

    /**
     * Get cached product data
     *
     * @param int $productId
     * @return mixed
     */
    public function getProduct(int $productId)
    {
        $key = self::PREFIX_PRODUCT . $productId;
        return $this->get($key);
    }

    /**
     * Forget cached product data
     *
     * @param int $productId
     * @return bool
     */
    public function forgetProduct(int $productId): bool
    {
        $key = self::PREFIX_PRODUCT . $productId;
        return $this->forget($key);
    }

    /**
     * Cache all products
     *
     * @param mixed $products
     * @param int $ttl
     * @return bool
     */
    public function cacheAllProducts($products, int $ttl = self::TTL_LONG): bool
    {
        $key = self::PREFIX_PRODUCT . 'all';
        return $this->put($key, $products, $ttl);
    }

    /**
     * Get all cached products
     *
     * @return mixed
     */
    public function getAllProducts()
    {
        $key = self::PREFIX_PRODUCT . 'all';
        return $this->get($key);
    }

    /**
     * Cache category data
     *
     * @param int $categoryId
     * @param mixed $data
     * @param int $ttl
     * @return bool
     */
    public function cacheCategory(int $categoryId, $data, int $ttl = self::TTL_LONG): bool
    {
        $key = self::PREFIX_CATEGORY . $categoryId;
        return $this->put($key, $data, $ttl);
    }

    /**
     * Get cached category data
     *
     * @param int $categoryId
     * @return mixed
     */
    public function getCategory(int $categoryId)
    {
        $key = self::PREFIX_CATEGORY . $categoryId;
        return $this->get($key);
    }

    /**
     * Cache category tree
     *
     * @param mixed $tree
     * @param int $ttl
     * @return bool
     */
    public function cacheCategoryTree($tree, int $ttl = self::TTL_DAY): bool
    {
        $key = self::PREFIX_CATEGORY . 'tree';
        return $this->put($key, $tree, $ttl);
    }

    /**
     * Get cached category tree
     *
     * @return mixed
     */
    public function getCategoryTree()
    {
        $key = self::PREFIX_CATEGORY . 'tree';
        return $this->get($key);
    }

    /**
     * Forget all category caches
     *
     * @return bool
     */
    public function forgetCategories(): bool
    {
        // Forget tree
        $this->forget(self::PREFIX_CATEGORY . 'tree');
        
        // Note: Individual categories would need to be cleared separately
        // or we need to use tags (requires Redis)
        return true;
    }

    /**
     * Cache user's cart
     *
     * @param int $userId
     * @param mixed $cart
     * @param int $ttl
     * @return bool
     */
    public function cacheCart(int $userId, $cart, int $ttl = self::TTL_SHORT): bool
    {
        $key = self::PREFIX_CART . $userId;
        return $this->put($key, $cart, $ttl);
    }

    /**
     * Get cached cart
     *
     * @param int $userId
     * @return mixed
     */
    public function getCart(int $userId)
    {
        $key = self::PREFIX_CART . $userId;
        return $this->get($key);
    }

    /**
     * Forget cached cart
     *
     * @param int $userId
     * @return bool
     */
    public function forgetCart(int $userId): bool
    {
        $key = self::PREFIX_CART . $userId;
        return $this->forget($key);
    }

    /**
     * Cache site settings
     *
     * @param string $settingKey
     * @param mixed $value
     * @param int $ttl
     * @return bool
     */
    public function cacheSetting(string $settingKey, $value, int $ttl = self::TTL_DAY): bool
    {
        $key = self::PREFIX_SETTINGS . $settingKey;
        return $this->put($key, $value, $ttl);
    }

    /**
     * Get cached setting
     *
     * @param string $settingKey
     * @param mixed $default
     * @return mixed
     */
    public function getSetting(string $settingKey, $default = null)
    {
        $key = self::PREFIX_SETTINGS . $settingKey;
        return $this->get($key, $default);
    }

    /**
     * Cache dashboard statistics
     *
     * @param string $statKey
     * @param mixed $value
     * @param int $ttl
     * @return bool
     */
    public function cacheStat(string $statKey, $value, int $ttl = self::TTL_SHORT): bool
    {
        $key = self::PREFIX_STATS . $statKey;
        return $this->put($key, $value, $ttl);
    }

    /**
     * Get cached statistic
     *
     * @param string $statKey
     * @return mixed
     */
    public function getStat(string $statKey)
    {
        $key = self::PREFIX_STATS . $statKey;
        return $this->get($key);
    }

    /**
     * Cache affiliate tree
     *
     * @param int $userId
     * @param mixed $tree
     * @param int $ttl
     * @return bool
     */
    public function cacheAffiliateTree(int $userId, $tree, int $ttl = self::TTL_MEDIUM): bool
    {
        $key = self::PREFIX_AFFILIATE . 'tree:' . $userId;
        return $this->put($key, $tree, $ttl);
    }

    /**
     * Get cached affiliate tree
     *
     * @param int $userId
     * @return mixed
     */
    public function getAffiliateTree(int $userId)
    {
        $key = self::PREFIX_AFFILIATE . 'tree:' . $userId;
        return $this->get($key);
    }

    /**
     * Cache affiliate stats
     *
     * @param int $userId
     * @param mixed $stats
     * @param int $ttl
     * @return bool
     */
    public function cacheAffiliateStats(int $userId, $stats, int $ttl = self::TTL_SHORT): bool
    {
        $key = self::PREFIX_AFFILIATE . 'stats:' . $userId;
        return $this->put($key, $stats, $ttl);
    }

    /**
     * Get cached affiliate stats
     *
     * @param int $userId
     * @return mixed
     */
    public function getAffiliateStats(int $userId)
    {
        $key = self::PREFIX_AFFILIATE . 'stats:' . $userId;
        return $this->get($key);
    }

    /**
     * Forget affiliate cache
     *
     * @param int $userId
     * @return bool
     */
    public function forgetAffiliate(int $userId): bool
    {
        $this->forget(self::PREFIX_AFFILIATE . 'tree:' . $userId);
        $this->forget(self::PREFIX_AFFILIATE . 'stats:' . $userId);
        return true;
    }

    /**
     * Increment a cached value
     *
     * @param string $key
     * @param int $value
     * @return int|bool
     */
    public function increment(string $key, int $value = 1)
    {
        try {
            return Cache::increment($key, $value);
        } catch (\Exception $e) {
            Log::error('Cache increment failed', [
                'key' => $key,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Decrement a cached value
     *
     * @param string $key
     * @param int $value
     * @return int|bool
     */
    public function decrement(string $key, int $value = 1)
    {
        try {
            return Cache::decrement($key, $value);
        } catch (\Exception $e) {
            Log::error('Cache decrement failed', [
                'key' => $key,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Check if a key exists in cache
     *
     * @param string $key
     * @return bool
     */
    public function has(string $key): bool
    {
        try {
            return Cache::has($key);
        } catch (\Exception $e) {
            Log::error('Cache has failed', [
                'key' => $key,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Get featured products (for cache warmup)
     *
     * @param int $limit
     * @return mixed
     */
    public function getFeaturedProducts(int $limit = 10)
    {
        return $this->remember(
            self::PREFIX_PRODUCT . 'featured:' . $limit,
            self::TTL_LONG,
            function () use ($limit) {
                return \App\Models\Product::where('featured', true)
                    ->where('status', 'active')
                    ->orderBy('created_at', 'desc')
                    ->limit($limit)
                    ->get();
            }
        );
    }

    /**
     * Get dashboard statistics (for cache warmup)
     *
     * @return array
     */
    public function getDashboardStats(): array
    {
        return $this->remember(
            self::PREFIX_STATS . 'dashboard',
            self::TTL_SHORT,
            function () {
                return [
                    'total_users' => \App\Models\User::count(),
                    'total_products' => \App\Models\Product::count(),
                    'total_orders' => \App\Models\Order::count(),
                    'pending_orders' => \App\Models\Order::where('status', 'pending')->count(),
                    'revenue_today' => \App\Models\Order::whereDate('created_at', today())
                        ->where('payment_status', 'paid')
                        ->sum('total_amount'),
                    'revenue_month' => \App\Models\Order::whereMonth('created_at', now()->month)
                        ->where('payment_status', 'paid')
                        ->sum('total_amount'),
                ];
            }
        );
    }

    /**
     * Get configuration value (with caching)
     *
     * @param string $key
     * @param mixed $default
     * @return mixed
     */
    public function getConfig(string $key, $default = null)
    {
        return $this->remember(
            self::PREFIX_SETTINGS . 'config:' . $key,
            self::TTL_DAY,
            function () use ($key, $default) {
                return config($key, $default);
            }
        );
    }

    /**
     * Get active categories (for cache warmup)
     *
     * @return mixed
     */
    public function getActiveCategories()
    {
        return $this->remember(
            self::PREFIX_CATEGORY . 'active',
            self::TTL_LONG,
            function () {
                return \App\Models\Category::where('status', 'active')
                    ->orderBy('name')
                    ->get();
            }
        );
    }
}
