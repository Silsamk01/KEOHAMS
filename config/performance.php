<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Query Logging
    |--------------------------------------------------------------------------
    */
    'query_log' => env('DB_QUERY_LOG', false),

    /*
    |--------------------------------------------------------------------------
    | Slow Query Threshold (milliseconds)
    |--------------------------------------------------------------------------
    */
    'slow_query_threshold' => env('DB_SLOW_QUERY_THRESHOLD', 1000),

    /*
    |--------------------------------------------------------------------------
    | Cache Configuration
    |--------------------------------------------------------------------------
    */
    'cache' => [
        'enabled' => env('CACHE_ENABLED', true),
        'default_ttl' => env('CACHE_DEFAULT_TTL', 3600),
        'prefix' => env('CACHE_PREFIX', 'keohams'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Query Cache
    |--------------------------------------------------------------------------
    */
    'query_cache' => [
        'enabled' => env('QUERY_CACHE_ENABLED', true),
        'ttl' => env('QUERY_CACHE_TTL', 3600),
    ],

    /*
    |--------------------------------------------------------------------------
    | Asset Optimization
    |--------------------------------------------------------------------------
    */
    'assets' => [
        'minify' => env('ASSET_MINIFY', true),
        'combine' => env('ASSET_COMBINE', true),
        'version' => env('ASSET_VERSION', '1.0.0'),
        'cdn_url' => env('CDN_URL', null),
    ],

    /*
    |--------------------------------------------------------------------------
    | Image Optimization
    |--------------------------------------------------------------------------
    */
    'images' => [
        'optimize' => env('IMAGE_OPTIMIZE', true),
        'quality' => env('IMAGE_QUALITY', 85),
        'max_width' => env('IMAGE_MAX_WIDTH', 2000),
        'max_height' => env('IMAGE_MAX_HEIGHT', 2000),
        'formats' => ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Session Configuration
    |--------------------------------------------------------------------------
    */
    'session' => [
        'driver' => env('SESSION_DRIVER', 'redis'),
        'lifetime' => env('SESSION_LIFETIME', 120),
        'expire_on_close' => false,
    ],

    /*
    |--------------------------------------------------------------------------
    | Queue Configuration
    |--------------------------------------------------------------------------
    */
    'queue' => [
        'driver' => env('QUEUE_DRIVER', 'redis'),
        'retry_after' => 90,
        'max_attempts' => 3,
    ],

    /*
    |--------------------------------------------------------------------------
    | Rate Limiting
    |--------------------------------------------------------------------------
    */
    'rate_limit' => [
        'api' => env('RATE_LIMIT_API', 60),
        'login' => env('RATE_LIMIT_LOGIN', 5),
        'register' => env('RATE_LIMIT_REGISTER', 3),
    ],

    /*
    |--------------------------------------------------------------------------
    | Database Optimization
    |--------------------------------------------------------------------------
    */
    'database' => [
        'connection_pool' => env('DB_CONNECTION_POOL', 10),
        'query_timeout' => env('DB_QUERY_TIMEOUT', 30),
        'strict_mode' => env('DB_STRICT_MODE', false),
    ],

    /*
    |--------------------------------------------------------------------------
    | Response Compression
    |--------------------------------------------------------------------------
    */
    'compression' => [
        'enabled' => env('RESPONSE_COMPRESSION', true),
        'level' => env('COMPRESSION_LEVEL', 6),
        'min_size' => env('COMPRESSION_MIN_SIZE', 1024),
    ],

    /*
    |--------------------------------------------------------------------------
    | Lazy Loading
    |--------------------------------------------------------------------------
    */
    'lazy_loading' => [
        'enabled' => env('LAZY_LOADING', true),
        'threshold' => env('LAZY_LOADING_THRESHOLD', 100),
    ],

    /*
    |--------------------------------------------------------------------------
    | CDN Configuration
    |--------------------------------------------------------------------------
    */
    'cdn' => [
        'enabled' => env('CDN_ENABLED', false),
        'url' => env('CDN_URL', ''),
        'assets' => ['css', 'js', 'images', 'fonts'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Performance Monitoring
    |--------------------------------------------------------------------------
    */
    'monitoring' => [
        'enabled' => env('PERFORMANCE_MONITORING', true),
        'slow_threshold' => env('PERFORMANCE_SLOW_THRESHOLD', 2000),
        'memory_limit' => env('PERFORMANCE_MEMORY_LIMIT', '256M'),
    ],
];
