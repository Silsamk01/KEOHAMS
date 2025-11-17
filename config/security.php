<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Security Settings
    |--------------------------------------------------------------------------
    */

    // Failed login attempts
    'max_login_attempts' => env('SECURITY_MAX_LOGIN_ATTEMPTS', 5),
    'login_lockout_minutes' => env('SECURITY_LOGIN_LOCKOUT_MINUTES', 30),

    // Rate limiting
    'max_requests_per_minute' => env('SECURITY_MAX_REQUESTS_PER_MINUTE', 60),
    'api_rate_limit' => env('SECURITY_API_RATE_LIMIT', 100),
    'api_rate_limit_window' => env('SECURITY_API_RATE_LIMIT_WINDOW', 1), // minutes

    // IP blocking
    'auto_block_after_failed_attempts' => env('SECURITY_AUTO_BLOCK', true),
    'block_duration_minutes' => env('SECURITY_BLOCK_DURATION', 60),

    // IP Whitelist for admin access
    'admin_ip_whitelist_enabled' => env('SECURITY_ADMIN_IP_WHITELIST_ENABLED', false),
    'ip_whitelist' => array_filter(explode(',', env('SECURITY_IP_WHITELIST', ''))),

    // Admin IP addresses (optional, override whitelist for admin-only access)
    'admin_ip_addresses' => array_filter(explode(',', env('SECURITY_ADMIN_IPS', ''))),

    // Password requirements
    'password' => [
        'min_length' => env('SECURITY_PASSWORD_MIN_LENGTH', 8),
        'require_uppercase' => env('SECURITY_PASSWORD_REQUIRE_UPPERCASE', true),
        'require_lowercase' => env('SECURITY_PASSWORD_REQUIRE_LOWERCASE', true),
        'require_numbers' => env('SECURITY_PASSWORD_REQUIRE_NUMBERS', true),
        'require_special_chars' => env('SECURITY_PASSWORD_REQUIRE_SPECIAL', true),
        'expires_days' => env('SECURITY_PASSWORD_EXPIRES_DAYS', 90),
        'prevent_reuse_count' => env('SECURITY_PASSWORD_PREVENT_REUSE', 5),
    ],

    // Session security
    'session' => [
        'timeout_minutes' => env('SECURITY_SESSION_TIMEOUT', 120),
        'secure_cookie' => env('SECURITY_SECURE_COOKIE', true),
        'http_only' => env('SECURITY_HTTP_ONLY', true),
        'same_site' => env('SECURITY_SAME_SITE', 'lax'),
    ],

    // Two-factor authentication
    'two_factor' => [
        'enabled' => env('SECURITY_2FA_ENABLED', true),
        'required_for_admin' => env('SECURITY_2FA_REQUIRED_ADMIN', false),
        'code_length' => env('SECURITY_2FA_CODE_LENGTH', 6),
        'code_expires_minutes' => env('SECURITY_2FA_CODE_EXPIRES', 5),
    ],

    // CSRF protection
    'csrf' => [
        'enabled' => env('SECURITY_CSRF_ENABLED', true),
        'token_lifetime' => env('SECURITY_CSRF_TOKEN_LIFETIME', 120), // minutes
    ],

    // XSS protection
    'xss' => [
        'enabled' => env('SECURITY_XSS_ENABLED', true),
        'sanitize_input' => env('SECURITY_XSS_SANITIZE_INPUT', true),
        'strip_tags' => env('SECURITY_XSS_STRIP_TAGS', false),
    ],

    // SQL injection protection
    'sql_injection' => [
        'detection_enabled' => env('SECURITY_SQL_INJECTION_DETECTION', true),
        'block_on_detection' => env('SECURITY_SQL_INJECTION_BLOCK', true),
    ],

    // File upload security
    'file_upload' => [
        'max_size_mb' => env('SECURITY_MAX_FILE_SIZE', 10),
        'allowed_extensions' => [
            'images' => ['jpg', 'jpeg', 'png', 'gif', 'webp'],
            'documents' => ['pdf', 'doc', 'docx', 'xls', 'xlsx'],
            'archives' => ['zip', 'rar'],
        ],
        'scan_for_malware' => env('SECURITY_SCAN_MALWARE', false),
    ],

    // API security
    'api' => [
        'require_https' => env('SECURITY_API_REQUIRE_HTTPS', true),
        'api_key_header' => env('SECURITY_API_KEY_HEADER', 'X-API-KEY'),
        'rate_limit_by_ip' => env('SECURITY_API_RATE_LIMIT_BY_IP', true),
    ],

    // Security headers
    'headers' => [
        'x_content_type_options' => 'nosniff',
        'x_frame_options' => 'SAMEORIGIN',
        'x_xss_protection' => '1; mode=block',
        'referrer_policy' => 'strict-origin-when-cross-origin',
        'permissions_policy' => 'geolocation=(), microphone=(), camera=()',
        'strict_transport_security' => 'max-age=31536000; includeSubDomains',
    ],

    // Content Security Policy
    'csp' => [
        'enabled' => env('SECURITY_CSP_ENABLED', true),
        'default_src' => "'self'",
        'script_src' => "'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://js.paystack.co",
        'style_src' => "'self' 'unsafe-inline' https://fonts.googleapis.com",
        'font_src' => "'self' https://fonts.gstatic.com",
        'img_src' => "'self' data: https:",
        'connect_src' => "'self' https://api.paystack.co",
    ],

    // Logging
    'logging' => [
        'log_all_events' => env('SECURITY_LOG_ALL_EVENTS', true),
        'log_failed_logins' => env('SECURITY_LOG_FAILED_LOGINS', true),
        'log_suspicious_activity' => env('SECURITY_LOG_SUSPICIOUS_ACTIVITY', true),
        'log_admin_actions' => env('SECURITY_LOG_ADMIN_ACTIONS', true),
        'retention_days' => env('SECURITY_LOG_RETENTION_DAYS', 90),
    ],

    // Alerts
    'alerts' => [
        'enabled' => env('SECURITY_ALERTS_ENABLED', true),
        'email_on_failed_login' => env('SECURITY_ALERT_FAILED_LOGIN', false),
        'email_on_suspicious_activity' => env('SECURITY_ALERT_SUSPICIOUS_ACTIVITY', true),
        'email_on_ip_blocked' => env('SECURITY_ALERT_IP_BLOCKED', true),
        'admin_emails' => array_filter(explode(',', env('SECURITY_ADMIN_EMAILS', ''))),
    ],

    // Maintenance mode
    'maintenance' => [
        'allowed_ips' => array_filter(explode(',', env('SECURITY_MAINTENANCE_ALLOWED_IPS', ''))),
    ],

    // Encryption
    'encryption' => [
        'algorithm' => env('SECURITY_ENCRYPTION_ALGORITHM', 'AES-256-CBC'),
    ],

    // Suspicious patterns (for detection)
    'suspicious_patterns' => [
        'sql_injection' => [
            '/(\bor\b|\band\b).*?[\'"]?\s*=\s*[\'"]?/i',
            '/union.*?select/i',
            '/select.*?from/i',
            '/insert.*?into/i',
            '/delete.*?from/i',
            '/drop.*?table/i',
            '/update.*?set/i',
        ],
        'xss' => [
            '/<script\b[^>]*>(.*?)<\/script>/is',
            '/javascript:/i',
            '/on\w+\s*=/i',
            '/<iframe/i',
        ],
    ],
];
