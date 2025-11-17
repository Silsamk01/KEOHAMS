<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class PerformanceReport extends Command
{
    protected $signature = 'performance:report';
    protected $description = 'Generate a performance report';

    public function handle()
    {
        $this->info('╔════════════════════════════════════════════════════════╗');
        $this->info('║         Application Performance Report                 ║');
        $this->info('╚════════════════════════════════════════════════════════╝');
        $this->newLine();

        // Cache Statistics
        $this->info('📊 Cache Statistics:');
        $this->displayCacheStats();
        $this->newLine();

        // Database Statistics
        $this->info('🗄️  Database Statistics:');
        $this->displayDatabaseStats();
        $this->newLine();

        // OPcache Statistics
        $this->info('⚡ OPcache Statistics:');
        $this->displayOpcacheStats();
        $this->newLine();

        // Application Statistics
        $this->info('📈 Application Statistics:');
        $this->displayAppStats();
        $this->newLine();

        // Configuration Status
        $this->info('⚙️  Configuration Status:');
        $this->displayConfigStatus();
        $this->newLine();

        $this->info('✓ Report generated successfully!');

        return Command::SUCCESS;
    }

    private function displayCacheStats()
    {
        $driver = config('cache.default');
        $this->line("  Driver: {$driver}");

        if ($driver === 'redis') {
            try {
                $redis = \Illuminate\Support\Facades\Redis::connection();
                $info = $redis->info();
                
                $this->line("  Status: Connected");
                $this->line("  Memory: " . ($info['memory']['used_memory_human'] ?? 'N/A'));
                $this->line("  Keys: " . $redis->dbsize());
                
                $hits = $info['stats']['keyspace_hits'] ?? 0;
                $misses = $info['stats']['keyspace_misses'] ?? 0;
                $total = $hits + $misses;
                
                if ($total > 0) {
                    $hitRate = round(($hits / $total) * 100, 2);
                    $this->line("  Hit Rate: {$hitRate}%");
                }
            } catch (\Exception $e) {
                $this->error("  Status: Error - " . $e->getMessage());
            }
        } else {
            $this->line("  Status: Active");
        }
    }

    private function displayDatabaseStats()
    {
        try {
            $connection = DB::connection();
            $database = $connection->getDatabaseName();
            
            $this->line("  Connection: " . config('database.default'));
            $this->line("  Database: {$database}");

            // Count tables
            $tables = DB::select("SHOW TABLES");
            $this->line("  Tables: " . count($tables));

            // Get database size
            $size = DB::select("
                SELECT 
                    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
                FROM information_schema.tables
                WHERE table_schema = ?
            ", [$database]);

            if (!empty($size)) {
                $this->line("  Size: " . $size[0]->size_mb . " MB");
            }

            // Check for missing indexes (simplified)
            $this->line("  Status: Connected");
        } catch (\Exception $e) {
            $this->error("  Status: Error - " . $e->getMessage());
        }
    }

    private function displayOpcacheStats()
    {
        if (function_exists('opcache_get_status')) {
            $status = opcache_get_status();
            
            if ($status !== false) {
                $this->line("  Status: Enabled");
                $memory = $status['memory_usage'];
                $used = round($memory['used_memory'] / 1024 / 1024, 2);
                $free = round($memory['free_memory'] / 1024 / 1024, 2);
                $this->line("  Memory Used: {$used} MB");
                $this->line("  Memory Free: {$free} MB");
                $this->line("  Cached Scripts: " . $status['opcache_statistics']['num_cached_scripts']);
                $this->line("  Hit Rate: " . round($status['opcache_statistics']['opcache_hit_rate'], 2) . "%");
            } else {
                $this->warn("  Status: Disabled");
            }
        } else {
            $this->warn("  Status: Not Available");
        }
    }

    private function displayAppStats()
    {
        $this->line("  Environment: " . app()->environment());
        $this->line("  Debug Mode: " . (config('app.debug') ? 'ON' : 'OFF'));
        $this->line("  PHP Version: " . PHP_VERSION);
        $this->line("  Laravel Version: " . app()->version());
        
        $memory = round(memory_get_usage(true) / 1024 / 1024, 2);
        $this->line("  Memory Usage: {$memory} MB");
        
        $uptime = $this->getServerUptime();
        if ($uptime) {
            $this->line("  Server Uptime: {$uptime}");
        }
    }

    private function displayConfigStatus()
    {
        $checks = [
            'Config Cached' => file_exists(base_path('bootstrap/cache/config.php')),
            'Routes Cached' => file_exists(base_path('bootstrap/cache/routes-v7.php')),
            'Views Cached' => is_dir(storage_path('framework/views')) && count(glob(storage_path('framework/views/*.php'))) > 0,
            'OPcache Enabled' => function_exists('opcache_get_status') && opcache_get_status() !== false,
            'Redis Configured' => config('cache.default') === 'redis',
            'Queue Configured' => config('queue.default') !== 'sync',
            'Debug Mode OFF' => !config('app.debug'),
        ];

        foreach ($checks as $check => $status) {
            $icon = $status ? '✓' : '✗';
            $color = $status ? 'info' : 'error';
            $this->{$color}("  {$icon} {$check}");
        }
    }

    private function getServerUptime()
    {
        if (function_exists('shell_exec') && !in_array('shell_exec', explode(',', ini_get('disable_functions')))) {
            if (PHP_OS_FAMILY === 'Windows') {
                return null;
            }
            
            $uptime = shell_exec('uptime -p');
            return $uptime ? trim($uptime) : null;
        }
        
        return null;
    }
}
