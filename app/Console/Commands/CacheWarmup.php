<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use App\Services\CacheService;

class CacheWarmup extends Command
{
    protected $signature = 'cache:warmup';
    protected $description = 'Warm up application cache with frequently accessed data';

    protected CacheService $cacheService;

    public function __construct(CacheService $cacheService)
    {
        parent::__construct();
        $this->cacheService = $cacheService;
    }

    public function handle()
    {
        $this->info('Starting cache warmup...');
        
        $this->info('Warming up featured products...');
        $this->cacheService->getFeaturedProducts(10);
        
        $this->info('Warming up dashboard statistics...');
        $this->cacheService->getDashboardStats();
        
        $this->info('Warming up categories...');
        Cache::remember('categories:active', CacheService::CACHE_LONG, function () {
            return \App\Models\Category::active()->get();
        });
        
        $this->info('Warming up site configuration...');
        $this->cacheService->getConfig('app.name');
        $this->cacheService->getConfig('app.url');
        
        $this->info('Cache warmup completed successfully!');
        
        return Command::SUCCESS;
    }
}
