#!/bin/bash

# Production Optimization Script
# Run this script before deploying to production

echo "╔════════════════════════════════════════════════════════╗"
echo "║      Laravel Production Optimization Script            ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo "⚠ Warning: Running as root. Consider using a non-root user."
fi

echo "→ Step 1: Clearing all caches..."
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear
echo "✓ Caches cleared"
echo ""

echo "→ Step 2: Running database migrations..."
php artisan migrate --force
echo "✓ Migrations completed"
echo ""

echo "→ Step 3: Adding performance indexes..."
php artisan migrate --path=database/migrations/2024_01_22_000000_add_performance_indexes.php --force
echo "✓ Indexes added"
echo ""

echo "→ Step 4: Optimizing database tables..."
php artisan db:optimize --analyze
echo "✓ Database optimized"
echo ""

echo "→ Step 5: Building frontend assets..."
if [ -f "package.json" ]; then
    npm install --production
    npm run production
    echo "✓ Assets built"
else
    echo "⚠ package.json not found, skipping frontend build"
fi
echo ""

echo "→ Step 6: Caching configuration..."
php artisan config:cache
php artisan route:cache
php artisan view:cache
echo "✓ Configuration cached"
echo ""

echo "→ Step 7: Warming up application cache..."
php artisan cache:warmup
echo "✓ Cache warmed up"
echo ""

echo "→ Step 8: Setting file permissions..."
chmod -R 755 storage bootstrap/cache
chmod -R 775 storage/logs
echo "✓ Permissions set"
echo ""

echo "→ Step 9: Optimizing Composer autoloader..."
composer install --optimize-autoloader --no-dev
echo "✓ Composer optimized"
echo ""

echo "→ Step 10: Running tests (optional)..."
read -p "Run tests? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    php artisan test
fi
echo ""

echo "╔════════════════════════════════════════════════════════╗"
echo "║              Optimization Complete!                    ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "1. Enable OPcache in php.ini"
echo "2. Configure Redis for caching"
echo "3. Set up CDN for static assets"
echo "4. Monitor application performance"
echo ""
echo "Performance checklist:"
echo "☐ OPcache enabled"
echo "☐ Redis configured"
echo "☐ Database indexed"
echo "☐ Assets minified"
echo "☐ Gzip compression enabled"
echo "☐ Cache warming configured"
echo ""
