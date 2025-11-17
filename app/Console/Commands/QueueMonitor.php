<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Redis;

class QueueMonitor extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'queue:monitor 
                            {--refresh=5 : Refresh interval in seconds}';

    /**
     * The console command description.
     */
    protected $description = 'Monitor Laravel queue status in real-time';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $refresh = (int) $this->option('refresh');

        $this->info('Queue Monitor Started (Press Ctrl+C to exit)');
        $this->newLine();

        while (true) {
            // Clear screen (works in most terminals)
            if (PHP_OS_FAMILY !== 'Windows') {
                system('clear');
            } else {
                system('cls');
            }

            $this->displayHeader();
            $this->displayQueueStats();
            $this->displayFailedJobs();
            
            $this->newLine();
            $this->info("Auto-refreshing every {$refresh} seconds... (Press Ctrl+C to exit)");
            
            sleep($refresh);
        }
    }

    /**
     * Display header
     */
    protected function displayHeader()
    {
        $this->line('╔═════════════════════════════════════════════════════════╗');
        $this->line('║          KEOHAMS Queue Monitor - ' . now()->format('H:i:s') . '            ║');
        $this->line('╚═════════════════════════════════════════════════════════╝');
        $this->newLine();
    }

    /**
     * Display queue statistics
     */
    protected function displayQueueStats()
    {
        try {
            $queueName = config('queue.connections.redis.queue', 'default');
            $prefix = config('database.redis.options.prefix', '');
            
            // Get queue size from Redis
            $queueKey = $prefix . 'queues:' . $queueName;
            $queueSize = Redis::llen($queueKey);
            
            // Get delayed jobs
            $delayedKey = $prefix . 'queues:' . $queueName . ':delayed';
            $delayedSize = Redis::zcard($delayedKey);
            
            // Get reserved jobs
            $reservedKey = $prefix . 'queues:' . $queueName . ':reserved';
            $reservedSize = Redis::zcard($reservedKey);

            $this->table(
                ['Metric', 'Value'],
                [
                    ['Pending Jobs', $queueSize],
                    ['Delayed Jobs', $delayedSize],
                    ['Reserved Jobs', $reservedSize],
                    ['Queue Connection', config('queue.default')],
                    ['Queue Name', $queueName],
                ]
            );

            // Status indicator
            if ($queueSize > 100) {
                $this->warn("⚠️  High queue load: {$queueSize} pending jobs");
            } elseif ($queueSize > 0) {
                $this->info("✓ Queue is processing: {$queueSize} jobs pending");
            } else {
                $this->comment("✓ Queue is empty");
            }

        } catch (\Exception $e) {
            $this->error('Failed to fetch queue stats: ' . $e->getMessage());
        }

        $this->newLine();
    }

    /**
     * Display failed jobs
     */
    protected function displayFailedJobs()
    {
        try {
            $failedJobs = \DB::table('failed_jobs')
                ->orderBy('failed_at', 'desc')
                ->limit(5)
                ->get();

            if ($failedJobs->isEmpty()) {
                $this->comment('✓ No failed jobs');
                return;
            }

            $this->error("Failed Jobs: {$failedJobs->count()}");
            $this->newLine();

            $tableData = [];
            foreach ($failedJobs as $job) {
                $payload = json_decode($job->payload, true);
                $jobName = $payload['displayName'] ?? 'Unknown';
                
                $tableData[] = [
                    substr($job->uuid, 0, 8),
                    $jobName,
                    \Carbon\Carbon::parse($job->failed_at)->diffForHumans(),
                    substr($job->exception, 0, 50) . '...',
                ];
            }

            $this->table(
                ['ID', 'Job', 'Failed', 'Error'],
                $tableData
            );

            $this->newLine();
            $this->comment('Run "php artisan queue:retry all" to retry all failed jobs');
            $this->comment('Run "php artisan queue:flush" to clear all failed jobs');

        } catch (\Exception $e) {
            $this->error('Failed to fetch failed jobs: ' . $e->getMessage());
        }
    }
}
