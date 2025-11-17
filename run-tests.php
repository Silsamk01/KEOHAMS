#!/usr/bin/env php
<?php

/**
 * Test Runner Script
 * 
 * This script runs various test suites and generates a comprehensive report.
 * Usage: php run-tests.php [options]
 * 
 * Options:
 *   --unit           Run only unit tests
 *   --feature        Run only feature tests
 *   --integration    Run only integration tests
 *   --coverage       Generate code coverage report
 *   --filter=name    Run specific test by name
 */

$options = getopt('', ['unit', 'feature', 'integration', 'coverage', 'filter:']);

$commands = [];

echo "\n";
echo "╔════════════════════════════════════════════════════════╗\n";
echo "║         Laravel Test Suite Runner                      ║\n";
echo "╚════════════════════════════════════════════════════════╝\n";
echo "\n";

// Determine which tests to run
if (isset($options['unit'])) {
    echo "→ Running Unit Tests...\n\n";
    $commands[] = 'vendor/bin/phpunit --testsuite=Unit';
} elseif (isset($options['feature'])) {
    echo "→ Running Feature Tests...\n\n";
    $commands[] = 'vendor/bin/phpunit --testsuite=Feature';
} elseif (isset($options['integration'])) {
    echo "→ Running Integration Tests...\n\n";
    $commands[] = 'vendor/bin/phpunit tests/Feature/Integration';
} elseif (isset($options['filter'])) {
    echo "→ Running Filtered Tests: {$options['filter']}...\n\n";
    $commands[] = "vendor/bin/phpunit --filter={$options['filter']}";
} else {
    echo "→ Running All Tests...\n\n";
    $commands[] = 'vendor/bin/phpunit';
}

// Add coverage if requested
if (isset($options['coverage'])) {
    echo "→ Generating Code Coverage Report...\n\n";
    $commands[0] .= ' --coverage-html coverage-report --coverage-text';
}

// Run commands
foreach ($commands as $command) {
    echo "Executing: $command\n";
    echo str_repeat('-', 60) . "\n";
    
    passthru($command, $exitCode);
    
    echo "\n";
    
    if ($exitCode !== 0) {
        echo "✗ Tests failed with exit code: $exitCode\n";
        exit($exitCode);
    }
}

echo "✓ All tests passed successfully!\n\n";

if (isset($options['coverage'])) {
    echo "→ Coverage report generated in: coverage-report/index.html\n\n";
}

exit(0);
