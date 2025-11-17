<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class OptimizeDatabase extends Command
{
    protected $signature = 'db:optimize {--analyze : Run ANALYZE TABLE}';
    protected $description = 'Optimize database tables and indexes';

    public function handle()
    {
        $this->info('Starting database optimization...');
        
        $tables = $this->getTables();
        $progressBar = $this->output->createProgressBar(count($tables));
        
        foreach ($tables as $table) {
            $this->optimizeTable($table);
            $progressBar->advance();
        }
        
        $progressBar->finish();
        $this->newLine(2);
        
        if ($this->option('analyze')) {
            $this->info('Running ANALYZE TABLE...');
            $this->analyzeTables($tables);
        }
        
        $this->info('Database optimization completed!');
        
        return Command::SUCCESS;
    }

    private function getTables()
    {
        $database = config('database.connections.mysql.database');
        
        return DB::select("
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = ? 
            AND table_type = 'BASE TABLE'
        ", [$database]);
    }

    private function optimizeTable($table)
    {
        $tableName = $table->table_name ?? $table->TABLE_NAME;
        
        try {
            DB::statement("OPTIMIZE TABLE `{$tableName}`");
            $this->line(" ✓ Optimized: {$tableName}");
        } catch (\Exception $e) {
            $this->error(" ✗ Failed: {$tableName} - " . $e->getMessage());
        }
    }

    private function analyzeTables($tables)
    {
        foreach ($tables as $table) {
            $tableName = $table->table_name ?? $table->TABLE_NAME;
            
            try {
                DB::statement("ANALYZE TABLE `{$tableName}`");
                $this->line(" ✓ Analyzed: {$tableName}");
            } catch (\Exception $e) {
                $this->error(" ✗ Failed: {$tableName} - " . $e->getMessage());
            }
        }
    }
}
