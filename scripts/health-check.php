<?php

/**
 * Application Health Check Script
 * 
 * Usage: php scripts/health-check.php
 */

require __DIR__ . '/../vendor/autoload.php';

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

// Bootstrap Laravel
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "╔════════════════════════════════════════════════════════╗\n";
echo "║           Application Health Check                     ║\n";
echo "╚════════════════════════════════════════════════════════╝\n\n";

$checks = [];
$allPassed = true;

// ===================================================================
// 1. Environment Check
// ===================================================================
echo "1. Environment Configuration:\n";
echo "   Environment: " . app()->environment() . "\n";
echo "   Debug Mode: " . (config('app.debug') ? 'ON ⚠' : 'OFF ✓') . "\n";
echo "   URL: " . config('app.url') . "\n";

if (app()->environment('production') && config('app.debug')) {
    echo "   ✗ WARNING: Debug mode should be OFF in production!\n";
    $allPassed = false;
} else {
    echo "   ✓ Environment configuration OK\n";
}
echo "\n";

// ===================================================================
// 2. Database Connection
// ===================================================================
echo "2. Database Connection:\n";
try {
    DB::connection()->getPdo();
    $dbName = DB::connection()->getDatabaseName();
    echo "   Database: {$dbName}\n";
    echo "   ✓ Database connection OK\n";
    $checks['database'] = true;
} catch (Exception $e) {
    echo "   ✗ Database connection FAILED: " . $e->getMessage() . "\n";
    $checks['database'] = false;
    $allPassed = false;
}
echo "\n";

// ===================================================================
// 3. Cache Connection
// ===================================================================
echo "3. Cache System:\n";
try {
    $cacheDriver = config('cache.default');
    echo "   Driver: {$cacheDriver}\n";
    
    Cache::put('health_check', 'test', 10);
    $value = Cache::get('health_check');
    
    if ($value === 'test') {
        echo "   ✓ Cache system OK\n";
        $checks['cache'] = true;
    } else {
        echo "   ✗ Cache read/write FAILED\n";
        $checks['cache'] = false;
        $allPassed = false;
    }
    
    Cache::forget('health_check');
} catch (Exception $e) {
    echo "   ✗ Cache connection FAILED: " . $e->getMessage() . "\n";
    $checks['cache'] = false;
    $allPassed = false;
}
echo "\n";

// ===================================================================
// 4. Storage Permissions
// ===================================================================
echo "4. Storage Permissions:\n";
$storageWritable = is_writable(storage_path());
$logsWritable = is_writable(storage_path('logs'));
$cacheWritable = is_writable(storage_path('framework/cache'));

echo "   storage/: " . ($storageWritable ? '✓ Writable' : '✗ Not writable') . "\n";
echo "   storage/logs/: " . ($logsWritable ? '✓ Writable' : '✗ Not writable') . "\n";
echo "   storage/framework/cache/: " . ($cacheWritable ? '✓ Writable' : '✗ Not writable') . "\n";

if ($storageWritable && $logsWritable && $cacheWritable) {
    echo "   ✓ Storage permissions OK\n";
    $checks['storage'] = true;
} else {
    echo "   ✗ Storage permissions FAILED\n";
    echo "   Run: chmod -R 775 storage bootstrap/cache\n";
    $checks['storage'] = false;
    $allPassed = false;
}
echo "\n";

// ===================================================================
// 5. Required PHP Extensions
// ===================================================================
echo "5. PHP Extensions:\n";
$requiredExtensions = [
    'PDO',
    'pdo_mysql',
    'mbstring',
    'tokenizer',
    'xml',
    'ctype',
    'json',
    'bcmath',
    'openssl',
];

$missingExtensions = [];
foreach ($requiredExtensions as $extension) {
    $loaded = extension_loaded($extension);
    echo "   {$extension}: " . ($loaded ? '✓' : '✗') . "\n";
    if (!$loaded) {
        $missingExtensions[] = $extension;
    }
}

if (empty($missingExtensions)) {
    echo "   ✓ All required extensions loaded\n";
    $checks['extensions'] = true;
} else {
    echo "   ✗ Missing extensions: " . implode(', ', $missingExtensions) . "\n";
    $checks['extensions'] = false;
    $allPassed = false;
}
echo "\n";

// ===================================================================
// 6. OPcache Status
// ===================================================================
echo "6. OPcache:\n";
if (function_exists('opcache_get_status')) {
    $opcacheStatus = opcache_get_status();
    if ($opcacheStatus !== false && $opcacheStatus['opcache_enabled']) {
        echo "   Status: Enabled ✓\n";
        echo "   Hit Rate: " . round($opcacheStatus['opcache_statistics']['opcache_hit_rate'], 2) . "%\n";
        echo "   Cached Scripts: " . $opcacheStatus['opcache_statistics']['num_cached_scripts'] . "\n";
        $checks['opcache'] = true;
    } else {
        echo "   Status: Disabled ⚠\n";
        $checks['opcache'] = false;
    }
} else {
    echo "   Status: Not available ⚠\n";
    $checks['opcache'] = false;
}
echo "\n";

// ===================================================================
// 7. Queue System
// ===================================================================
echo "7. Queue System:\n";
try {
    $queueConnection = config('queue.default');
    echo "   Connection: {$queueConnection}\n";
    
    if ($queueConnection !== 'sync') {
        echo "   ✓ Queue configured for async processing\n";
        $checks['queue'] = true;
    } else {
        echo "   ⚠ Queue using sync driver (not recommended for production)\n";
        $checks['queue'] = false;
    }
} catch (Exception $e) {
    echo "   ✗ Queue check FAILED: " . $e->getMessage() . "\n";
    $checks['queue'] = false;
}
echo "\n";

// ===================================================================
// 8. Application Key
// ===================================================================
echo "8. Application Key:\n";
$appKey = config('app.key');
if (!empty($appKey) && strlen($appKey) > 20) {
    echo "   ✓ Application key is set\n";
    $checks['app_key'] = true;
} else {
    echo "   ✗ Application key NOT set or invalid\n";
    echo "   Run: php artisan key:generate\n";
    $checks['app_key'] = false;
    $allPassed = false;
}
echo "\n";

// ===================================================================
// 9. Routes Cached
// ===================================================================
echo "9. Route Cache:\n";
if (file_exists(base_path('bootstrap/cache/routes-v7.php'))) {
    echo "   ✓ Routes are cached\n";
    $checks['routes_cached'] = true;
} else {
    echo "   ⚠ Routes not cached (run: php artisan route:cache)\n";
    $checks['routes_cached'] = false;
}
echo "\n";

// ===================================================================
// 10. Config Cached
// ===================================================================
echo "10. Config Cache:\n";
if (file_exists(base_path('bootstrap/cache/config.php'))) {
    echo "    ✓ Configuration is cached\n";
    $checks['config_cached'] = true;
} else {
    echo "    ⚠ Configuration not cached (run: php artisan config:cache)\n";
    $checks['config_cached'] = false;
}
echo "\n";

// ===================================================================
// Summary
// ===================================================================
echo "╔════════════════════════════════════════════════════════╗\n";
echo "║                  Health Check Summary                  ║\n";
echo "╚════════════════════════════════════════════════════════╝\n\n";

$passedCount = count(array_filter($checks, fn($v) => $v === true));
$totalCount = count($checks);
$percentage = round(($passedCount / $totalCount) * 100, 1);

echo "Checks Passed: {$passedCount}/{$totalCount} ({$percentage}%)\n\n";

if ($allPassed) {
    echo "✓ All critical checks passed!\n";
    echo "  Application is ready for production.\n\n";
    exit(0);
} else {
    echo "✗ Some checks failed!\n";
    echo "  Please fix the issues above before deploying.\n\n";
    exit(1);
}
