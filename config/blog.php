<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Blog Settings
    |--------------------------------------------------------------------------
    */

    // Posts per page
    'posts_per_page' => env('BLOG_POSTS_PER_PAGE', 12),

    // Default author ID (admin)
    'default_author_id' => env('BLOG_DEFAULT_AUTHOR_ID', 1),

    // Enable comments
    'enable_comments' => env('BLOG_ENABLE_COMMENTS', false),

    // Require login to view posts
    'require_login' => env('BLOG_REQUIRE_LOGIN', false),

    // Auto-publish posts
    'auto_publish' => env('BLOG_AUTO_PUBLISH', false),

    // SEO settings
    'seo' => [
        'default_image' => env('BLOG_DEFAULT_IMAGE', '/images/default-blog-cover.jpg'),
        'site_name' => env('APP_NAME', 'KEOHAMS'),
        'twitter_handle' => env('BLOG_TWITTER_HANDLE', '@keohams'),
    ],

    // Reading time calculation
    'words_per_minute' => env('BLOG_WORDS_PER_MINUTE', 200),

    // Featured posts limit
    'featured_limit' => env('BLOG_FEATURED_LIMIT', 5),

    // Popular posts settings
    'popular_days' => env('BLOG_POPULAR_DAYS', 30),
    'popular_limit' => env('BLOG_POPULAR_LIMIT', 5),

    // Related posts limit
    'related_limit' => env('BLOG_RELATED_LIMIT', 3),

    // RSS feed settings
    'rss' => [
        'enabled' => env('BLOG_RSS_ENABLED', true),
        'limit' => env('BLOG_RSS_LIMIT', 20),
        'description' => env('BLOG_RSS_DESCRIPTION', 'Latest blog posts from ' . env('APP_NAME')),
    ],

    // Sitemap settings
    'sitemap' => [
        'enabled' => env('BLOG_SITEMAP_ENABLED', true),
        'change_frequency' => 'weekly',
        'priority' => 0.8,
    ],

    // Cache settings
    'cache' => [
        'enabled' => env('BLOG_CACHE_ENABLED', true),
        'ttl' => [
            'posts' => env('BLOG_CACHE_POSTS_TTL', 1800), // 30 minutes
            'featured' => env('BLOG_CACHE_FEATURED_TTL', 3600), // 1 hour
            'popular' => env('BLOG_CACHE_POPULAR_TTL', 3600), // 1 hour
            'categories' => env('BLOG_CACHE_CATEGORIES_TTL', 3600), // 1 hour
            'tags' => env('BLOG_CACHE_TAGS_TTL', 3600), // 1 hour
            'statistics' => env('BLOG_CACHE_STATISTICS_TTL', 1800), // 30 minutes
        ],
    ],

    // Image upload settings
    'images' => [
        'max_size' => env('BLOG_MAX_IMAGE_SIZE', 5120), // 5MB in KB
        'allowed_types' => ['jpeg', 'jpg', 'png', 'gif', 'webp'],
        'storage_path' => 'blog/covers',
    ],

    // Content settings
    'excerpt_length' => env('BLOG_EXCERPT_LENGTH', 200),
    'max_title_length' => env('BLOG_MAX_TITLE_LENGTH', 255),
    'max_slug_length' => env('BLOG_MAX_SLUG_LENGTH', 255),

    // Public blog separation
    'public_blog' => [
        'enabled' => env('PUBLIC_BLOG_ENABLED', true),
        'database' => env('PUBLIC_BLOG_DATABASE', 'keohams_public_blog'),
        'sync_published' => env('PUBLIC_BLOG_SYNC', true),
    ],

    // Search settings
    'search' => [
        'min_length' => 3,
        'max_results' => 100,
    ],
];
