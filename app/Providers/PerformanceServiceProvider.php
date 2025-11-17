<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\View;
use Illuminate\Support\Facades\Blade;

class PerformanceServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        // Register CacheService
        $this->app->singleton(\App\Services\CacheService::class);
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        // Disable lazy loading in production to catch N+1 queries
        if ($this->app->environment('production')) {
            Model::preventLazyLoading();
        }

        // Enable strict mode in development
        if ($this->app->environment('local')) {
            Model::preventSilentlyDiscardingAttributes();
            Model::preventAccessingMissingAttributes();
        }

        // Log slow queries in development
        if (config('performance.query_log', false)) {
            DB::listen(function ($query) {
                $threshold = config('performance.slow_query_threshold', 1000);
                
                if ($query->time > $threshold) {
                    logger()->warning('Slow query detected', [
                        'sql' => $query->sql,
                        'bindings' => $query->bindings,
                        'time' => $query->time . 'ms',
                    ]);
                }
            });
        }

        // Share common cached data with views
        View::composer('*', function ($view) {
            if (!$view->getData()['__env']->shared('cached_categories' ?? false)) {
                $cacheService = app(\App\Services\CacheService::class);
                
                View::share('cached_categories', cache()->remember(
                    'categories:active',
                    \App\Services\CacheService::CACHE_LONG,
                    fn() => \App\Models\Category::active()->get()
                ));
            }
        });

        // Custom Blade directives for performance
        Blade::directive('cache', function ($expression) {
            return "<?php if(! cache()->has({$expression})) : ?>";
        });

        Blade::directive('endcache', function () {
            return "<?php endif; ?>";
        });

        // Add performance monitoring
        if (config('performance.monitoring.enabled', true)) {
            $this->monitorPerformance();
        }
    }

    /**
     * Monitor application performance
     */
    private function monitorPerformance(): void
    {
        $this->app->terminating(function () {
            $executionTime = (microtime(true) - LARAVEL_START) * 1000;
            $memoryUsage = memory_get_peak_usage(true) / 1024 / 1024;

            $slowThreshold = config('performance.monitoring.slow_threshold', 2000);
            
            if ($executionTime > $slowThreshold) {
                logger()->warning('Slow request detected', [
                    'url' => request()->fullUrl(),
                    'method' => request()->method(),
                    'time' => round($executionTime, 2) . 'ms',
                    'memory' => round($memoryUsage, 2) . 'MB',
                    'queries' => count(DB::getQueryLog()),
                ]);
            }
        });
    }
}
