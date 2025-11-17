#!/bin/bash

# Laravel OPcache Preloader
# This file preloads frequently used files into OPcache for better performance

<?php

// Preload Composer Autoloader
require __DIR__ . '/vendor/autoload.php';

// Preload Laravel Core
preloadDirectory(__DIR__ . '/vendor/laravel/framework/src/Illuminate/Support');
preloadDirectory(__DIR__ . '/vendor/laravel/framework/src/Illuminate/Container');
preloadDirectory(__DIR__ . '/vendor/laravel/framework/src/Illuminate/Database');
preloadDirectory(__DIR__ . '/vendor/laravel/framework/src/Illuminate/Http');
preloadDirectory(__DIR__ . '/vendor/laravel/framework/src/Illuminate/Routing');
preloadDirectory(__DIR__ . '/vendor/laravel/framework/src/Illuminate/View');

// Preload Application Files
preloadDirectory(__DIR__ . '/app/Models');
preloadDirectory(__DIR__ . '/app/Services');
preloadDirectory(__DIR__ . '/app/Http/Controllers');
preloadDirectory(__DIR__ . '/app/Http/Middleware');

// Preload Helpers
if (file_exists(__DIR__ . '/app/Helpers')) {
    preloadDirectory(__DIR__ . '/app/Helpers');
}

/**
 * Recursively preload PHP files in directory
 */
function preloadDirectory($directory)
{
    if (!is_dir($directory)) {
        return;
    }

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($directory, RecursiveDirectoryIterator::SKIP_DOTS)
    );

    foreach ($iterator as $file) {
        if ($file->isFile() && $file->getExtension() === 'php') {
            try {
                opcache_compile_file($file->getRealPath());
            } catch (\Throwable $e) {
                // Skip files that cannot be preloaded
                continue;
            }
        }
    }
}
