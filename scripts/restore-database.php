<?php

/**
 * Database Restore Script for cPanel Deployment
 * 
 * Usage: php scripts/restore-database.php [backup_file]
 */

require __DIR__ . '/../vendor/autoload.php';

use Illuminate\Support\Facades\DB;

// Bootstrap Laravel
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "╔════════════════════════════════════════════════════════╗\n";
echo "║           Database Restore Script                      ║\n";
echo "╚════════════════════════════════════════════════════════╝\n\n";

// Get backup file
if (!isset($argv[1])) {
    echo "Usage: php scripts/restore-database.php [backup_file]\n\n";
    
    // List available backups
    $backupDir = __DIR__ . '/../storage/backups';
    if (is_dir($backupDir)) {
        echo "Available backups:\n";
        $backups = glob($backupDir . '/database_backup_*.sql');
        rsort($backups);
        
        if (empty($backups)) {
            echo "  No backups found.\n";
        } else {
            foreach ($backups as $index => $backup) {
                $fileSize = filesize($backup);
                $fileSizeFormatted = number_format($fileSize / 1024 / 1024, 2);
                $fileName = basename($backup);
                echo "  " . ($index + 1) . ". {$fileName} ({$fileSizeFormatted} MB)\n";
            }
        }
    }
    
    exit(1);
}

$backupFile = $argv[1];

// Check if file exists
if (!file_exists($backupFile)) {
    // Try in backup directory
    $backupDir = __DIR__ . '/../storage/backups';
    $backupFile = $backupDir . '/' . basename($backupFile);
    
    if (!file_exists($backupFile)) {
        echo "✗ Error: Backup file not found: {$backupFile}\n";
        exit(1);
    }
}

echo "Backup file: {$backupFile}\n";
echo "Size: " . number_format(filesize($backupFile) / 1024 / 1024, 2) . " MB\n\n";

// Confirmation
echo "⚠ WARNING: This will restore the database and overwrite all current data!\n";
echo "Are you sure you want to continue? (yes/no): ";
$handle = fopen("php://stdin", "r");
$confirm = trim(fgets($handle));
fclose($handle);

if ($confirm !== 'yes') {
    echo "\nRestore cancelled.\n";
    exit(0);
}

echo "\n";

try {
    $config = config('database.connections.' . config('database.default'));
    
    echo "Database: {$config['database']}\n";
    echo "Host: {$config['host']}\n\n";
    
    // Create pre-restore backup
    echo "Creating pre-restore backup...\n";
    $preRestoreBackup = __DIR__ . '/../storage/backups/pre_restore_' . date('Y-m-d_His') . '.sql';
    
    $backupCommand = sprintf(
        'mysqldump -h %s -u %s -p%s %s > %s 2>&1',
        escapeshellarg($config['host']),
        escapeshellarg($config['username']),
        escapeshellarg($config['password']),
        escapeshellarg($config['database']),
        escapeshellarg($preRestoreBackup)
    );
    
    exec($backupCommand, $backupOutput, $backupReturnVar);
    
    if ($backupReturnVar === 0) {
        echo "✓ Pre-restore backup created: " . basename($preRestoreBackup) . "\n\n";
    } else {
        echo "⚠ Warning: Could not create pre-restore backup\n\n";
    }
    
    // Restore database
    echo "Restoring database...\n";
    
    $command = sprintf(
        'mysql -h %s -u %s -p%s %s < %s 2>&1',
        escapeshellarg($config['host']),
        escapeshellarg($config['username']),
        escapeshellarg($config['password']),
        escapeshellarg($config['database']),
        escapeshellarg($backupFile)
    );
    
    exec($command, $output, $returnVar);
    
    if ($returnVar === 0) {
        echo "✓ Database restored successfully!\n\n";
        
        // Run migrations to ensure schema is up to date
        echo "Running migrations...\n";
        $migrateCommand = 'php artisan migrate --force';
        exec($migrateCommand, $migrateOutput, $migrateReturnVar);
        
        if ($migrateReturnVar === 0) {
            echo "✓ Migrations completed\n";
        } else {
            echo "⚠ Warning: Migrations may have failed\n";
        }
        
        echo "\n✓ Restore process completed!\n";
        echo "\nNext steps:\n";
        echo "  1. Clear application cache: php artisan cache:clear\n";
        echo "  2. Verify data integrity\n";
        echo "  3. Test critical functionality\n";
        
        exit(0);
    } else {
        echo "✗ Restore failed!\n";
        if (!empty($output)) {
            echo "Error output:\n" . implode("\n", $output) . "\n";
        }
        exit(1);
    }
    
} catch (Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
    exit(1);
}
