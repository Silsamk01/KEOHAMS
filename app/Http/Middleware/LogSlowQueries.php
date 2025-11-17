<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class LogSlowQueries
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Enable query logging in development
        if (config('performance.query_log', false)) {
            DB::enableQueryLog();
        }

        // Start timing
        $startTime = microtime(true);

        $response = $next($request);

        // Calculate total time
        $totalTime = (microtime(true) - $startTime) * 1000;

        // Log slow queries
        if (config('performance.query_log', false)) {
            $this->logSlowQueries($request, $totalTime);
        }

        // Log slow requests
        $threshold = config('performance.slow_query_threshold', 1000);
        if ($totalTime > $threshold) {
            Log::warning('Slow request detected', [
                'url' => $request->fullUrl(),
                'method' => $request->method(),
                'time' => round($totalTime, 2) . 'ms',
                'memory' => round(memory_get_peak_usage(true) / 1024 / 1024, 2) . 'MB',
            ]);
        }

        return $response;
    }

    /**
     * Log slow database queries
     */
    private function logSlowQueries(Request $request, float $totalTime): void
    {
        $queries = DB::getQueryLog();
        $threshold = config('performance.slow_query_threshold', 1000);

        foreach ($queries as $query) {
            $queryTime = $query['time'];

            if ($queryTime > $threshold) {
                Log::warning('Slow query detected', [
                    'url' => $request->fullUrl(),
                    'query' => $query['query'],
                    'bindings' => $query['bindings'],
                    'time' => $queryTime . 'ms',
                ]);
            }
        }

        // Log total query count and time
        if (count($queries) > 20) {
            $totalQueryTime = array_sum(array_column($queries, 'time'));
            
            Log::info('High query count', [
                'url' => $request->fullUrl(),
                'count' => count($queries),
                'total_time' => round($totalQueryTime, 2) . 'ms',
                'request_time' => round($totalTime, 2) . 'ms',
            ]);
        }
    }
}
