<?php

/**
 * Database Backup Script for cPanel Deployment
 * 
 * Usage: php scripts/backup-database.php [output_file]
 */

require __DIR__ . '/../vendor/autoload.php';

use Illuminate\Support\Facades\DB;

// Bootstrap Laravel
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$outputFile = $argv[1] ?? 'database_backup_' . date('Y-m-d_His') . '.sql';
$backupDir = __DIR__ . '/../storage/backups';

// Create backup directory if it doesn't exist
if (!is_dir($backupDir)) {
    mkdir($backupDir, 0755, true);
}

$outputPath = $backupDir . '/' . $outputFile;

echo "╔════════════════════════════════════════════════════════╗\n";
echo "║           Database Backup Script                       ║\n";
echo "╚════════════════════════════════════════════════════════╝\n\n";

try {
    $config = config('database.connections.' . config('database.default'));
    
    echo "Database: {$config['database']}\n";
    echo "Host: {$config['host']}\n";
    echo "Output: {$outputPath}\n\n";
    
    // Build mysqldump command
    $command = sprintf(
        'mysqldump -h %s -u %s -p%s %s > %s 2>&1',
        escapeshellarg($config['host']),
        escapeshellarg($config['username']),
        escapeshellarg($config['password']),
        escapeshellarg($config['database']),
        escapeshellarg($outputPath)
    );
    
    echo "Creating backup...\n";
    exec($command, $output, $returnVar);
    
    if ($returnVar === 0 && file_exists($outputPath)) {
        $size = filesize($outputPath);
        $sizeFormatted = number_format($size / 1024 / 1024, 2);
        
        echo "✓ Backup created successfully!\n";
        echo "  File: {$outputPath}\n";
        echo "  Size: {$sizeFormatted} MB\n\n";
        
        // List recent backups
        echo "Recent backups:\n";
        $backups = glob($backupDir . '/database_backup_*.sql');
        rsort($backups);
        
        foreach (array_slice($backups, 0, 5) as $backup) {
            $fileSize = filesize($backup);
            $fileSizeFormatted = number_format($fileSize / 1024 / 1024, 2);
            $fileName = basename($backup);
            echo "  - {$fileName} ({$fileSizeFormatted} MB)\n";
        }
        
        // Clean old backups (keep last 10)
        if (count($backups) > 10) {
            echo "\nCleaning old backups...\n";
            foreach (array_slice($backups, 10) as $oldBackup) {
                unlink($oldBackup);
                echo "  Deleted: " . basename($oldBackup) . "\n";
            }
        }
        
        echo "\n✓ Backup process completed!\n";
        exit(0);
    } else {
        echo "✗ Backup failed!\n";
        if (!empty($output)) {
            echo "Error output:\n" . implode("\n", $output) . "\n";
        }
        exit(1);
    }
    
} catch (Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
    exit(1);
}
