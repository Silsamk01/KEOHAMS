# Laravel Performance Checklist

**Quick reference checklist for optimizing KEOHAMS Laravel application**

Version: 1.0  
Last Updated: November 16, 2025

---

## Pre-Deployment Optimization

### ✅ Configuration

- [ ] Set `APP_ENV=production`
- [ ] Set `APP_DEBUG=false`
- [ ] Set `LOG_LEVEL=error`
- [ ] Configure proper `SESSION_DRIVER` (redis)
- [ ] Configure proper `CACHE_DRIVER` (redis)
- [ ] Configure proper `QUEUE_CONNECTION` (redis)
- [ ] Set `SESSION_SECURE_COOKIE=true` (if using HTTPS)
- [ ] Configure `TRUSTED_PROXIES` if behind proxy

### ✅ Dependencies

- [ ] Run `composer install --optimize-autoloader --no-dev`
- [ ] Run `composer dump-autoload --optimize`
- [ ] Remove development packages
- [ ] Update all dependencies to latest stable versions
- [ ] Remove unused dependencies

### ✅ Assets

- [ ] Run `npm run production`
- [ ] Minify CSS files
- [ ] Minify JavaScript files
- [ ] Optimize images (compress, resize, WebP)
- [ ] Enable asset versioning
- [ ] Remove unused CSS/JS

---

## OPcache Optimization

### ✅ OPcache Configuration

- [ ] Enable OPcache: `opcache.enable=1`
- [ ] Set memory: `opcache.memory_consumption=256`
- [ ] Set max files: `opcache.max_accelerated_files=10000`
- [ ] Disable validation in production: `opcache.validate_timestamps=0`
- [ ] Enable fast shutdown: `opcache.fast_shutdown=1`
- [ ] Save comments: `opcache.save_comments=1`
- [ ] Configure preload file
- [ ] Set preload user

### ✅ Verification

- [ ] Verify OPcache is enabled: `php -i | grep opcache`
- [ ] Check OPcache status
- [ ] Monitor OPcache hit rate (should be > 95%)
- [ ] Clear OPcache after deployment

---

## Database Optimization

### ✅ Configuration

- [ ] Enable persistent connections (if applicable)
- [ ] Configure connection pooling
- [ ] Set proper `mysql.max_connections`
- [ ] Enable query caching
- [ ] Configure proper charset (utf8mb4)

### ✅ Indexes

- [ ] Index all foreign keys
- [ ] Index frequently queried columns (email, status, created_at)
- [ ] Create composite indexes for common queries
- [ ] Index slug fields
- [ ] Index date fields used in WHERE clauses
- [ ] Remove unused indexes

### ✅ Queries

- [ ] Enable eager loading to prevent N+1 queries
- [ ] Use `select()` to load only needed columns
- [ ] Use `chunk()` for large datasets
- [ ] Use database transactions for multiple operations
- [ ] Optimize complex queries
- [ ] Add database query logging in development

### ✅ Maintenance

- [ ] Run `OPTIMIZE TABLE` on all tables
- [ ] Run `ANALYZE TABLE` on all tables
- [ ] Check and fix table fragmentation
- [ ] Monitor slow query log
- [ ] Set up automated database backups

---

## Caching Optimization

### ✅ Application Caching

- [ ] Cache configuration: `php artisan config:cache`
- [ ] Cache routes: `php artisan route:cache`
- [ ] Cache views: `php artisan view:cache`
- [ ] Run `php artisan optimize`
- [ ] Clear old caches before deploying new code

### ✅ Data Caching

- [ ] Cache frequently accessed data (products, categories)
- [ ] Implement cache tags for organized cache management
- [ ] Set appropriate cache TTL for each data type
- [ ] Cache API responses
- [ ] Cache database query results
- [ ] Implement fragment caching in views

### ✅ Redis Configuration

- [ ] Use phpredis extension (faster than predis)
- [ ] Enable persistent connections
- [ ] Use separate Redis databases for cache/session/queue
- [ ] Configure proper memory limits
- [ ] Set eviction policy: `maxmemory-policy allkeys-lru`
- [ ] Monitor Redis memory usage

---

## Session Optimization

### ✅ Session Configuration

- [ ] Use Redis for session storage
- [ ] Set appropriate `SESSION_LIFETIME`
- [ ] Set `SESSION_ENCRYPT=false` (unless required)
- [ ] Enable `SESSION_SECURE_COOKIE` with HTTPS
- [ ] Set proper `SESSION_COOKIE` name
- [ ] Configure `SESSION_DOMAIN` for subdomains

### ✅ Session Cleanup

- [ ] Set up automatic session garbage collection
- [ ] Add cron job for: `php artisan session:gc`
- [ ] Monitor session storage size
- [ ] Clear expired sessions regularly

---

## Asset Optimization

### ✅ CSS/JavaScript

- [ ] Minify CSS files
- [ ] Minify JavaScript files
- [ ] Remove unused CSS
- [ ] Remove unused JavaScript
- [ ] Combine multiple CSS files
- [ ] Combine multiple JavaScript files
- [ ] Use async/defer for non-critical scripts
- [ ] Load critical CSS inline

### ✅ Images

- [ ] Compress all images (PNG, JPG)
- [ ] Convert images to WebP format
- [ ] Implement responsive images
- [ ] Use appropriate image dimensions
- [ ] Enable lazy loading for images
- [ ] Remove image EXIF data
- [ ] Optimize SVG files

### ✅ Fonts

- [ ] Use system fonts when possible
- [ ] Load only required font weights
- [ ] Use font-display: swap
- [ ] Preload critical fonts
- [ ] Host fonts locally or use CDN

---

## HTTP Optimization

### ✅ Compression

- [ ] Enable Gzip compression
- [ ] Enable Brotli compression (if available)
- [ ] Compress HTML, CSS, JavaScript
- [ ] Compress JSON responses
- [ ] Set appropriate compression levels

### ✅ Caching Headers

- [ ] Set proper `Cache-Control` headers
- [ ] Configure `Expires` headers
- [ ] Set `ETag` headers
- [ ] Configure browser caching for static assets
- [ ] Set long cache times for versioned assets

### ✅ HTTP/2

- [ ] Enable HTTP/2 on server
- [ ] Verify HTTP/2 is working
- [ ] Use server push for critical resources (if beneficial)
- [ ] Optimize for HTTP/2 multiplexing

---

## CDN Integration

### ✅ CDN Setup

- [ ] Configure CDN (CloudFlare, AWS CloudFront, etc.)
- [ ] Set `ASSET_URL` in environment
- [ ] Configure CDN caching rules
- [ ] Enable CDN auto-minification
- [ ] Enable CDN image optimization
- [ ] Configure CDN SSL certificate

### ✅ CDN Optimization

- [ ] Use CDN for static assets (images, CSS, JS)
- [ ] Set long cache TTL for static files
- [ ] Configure CDN to respect cache headers
- [ ] Purge CDN cache after deployments
- [ ] Monitor CDN hit rate (should be > 90%)

---

## Queue Optimization

### ✅ Queue Configuration

- [ ] Use Redis for queue driver
- [ ] Configure proper queue priorities
- [ ] Set appropriate `retry_after` time
- [ ] Configure max job attempts
- [ ] Set job timeout values

### ✅ Queue Workers

- [ ] Run multiple queue workers
- [ ] Use Supervisor for process management
- [ ] Configure worker auto-restart
- [ ] Monitor queue length
- [ ] Monitor failed jobs
- [ ] Set up alerts for queue backlog

### ✅ Job Optimization

- [ ] Make jobs idempotent
- [ ] Split large jobs into smaller jobs
- [ ] Use job batching when appropriate
- [ ] Implement job chaining for dependencies
- [ ] Add proper error handling
- [ ] Log failed jobs

---

## Server Optimization

### ✅ PHP Configuration

- [ ] Set `memory_limit` (512M or higher)
- [ ] Set `max_execution_time` (30-60 seconds)
- [ ] Set `upload_max_filesize` (appropriate for your needs)
- [ ] Set `post_max_size` (slightly larger than upload_max_filesize)
- [ ] Enable `realpath_cache`: `realpath_cache_size=4M`
- [ ] Set `realpath_cache_ttl=3600`

### ✅ Web Server

- [ ] Enable Keep-Alive connections
- [ ] Configure appropriate worker processes
- [ ] Set proper timeout values
- [ ] Enable HTTP/2
- [ ] Configure SSL/TLS properly
- [ ] Use latest PHP version (8.1+)

---

## Monitoring & Profiling

### ✅ Application Monitoring

- [ ] Install monitoring tools (Laravel Telescope for dev)
- [ ] Monitor response times
- [ ] Monitor database query times
- [ ] Monitor cache hit rates
- [ ] Monitor queue processing
- [ ] Set up error tracking (Sentry, Bugsnag)

### ✅ Server Monitoring

- [ ] Monitor CPU usage
- [ ] Monitor memory usage
- [ ] Monitor disk I/O
- [ ] Monitor network traffic
- [ ] Monitor MySQL connections
- [ ] Monitor Redis memory usage

### ✅ Logging

- [ ] Set `LOG_LEVEL=error` in production
- [ ] Use daily log rotation
- [ ] Set log retention policy (14-30 days)
- [ ] Monitor log file sizes
- [ ] Set up log aggregation (ELK, Papertrail)
- [ ] Create alerts for critical errors

---

## Security & Performance

### ✅ Security

- [ ] Enable HTTPS/SSL
- [ ] Force HTTPS redirects
- [ ] Set secure cookie flags
- [ ] Implement rate limiting
- [ ] Enable CORS properly
- [ ] Sanitize user inputs
- [ ] Use prepared statements
- [ ] Keep dependencies updated

### ✅ Rate Limiting

- [ ] Configure API rate limiting
- [ ] Configure login rate limiting
- [ ] Set up IP-based throttling
- [ ] Monitor rate limit hits
- [ ] Implement exponential backoff

---

## Load Testing

### ✅ Testing Tools

- [ ] Apache Bench (ab)
- [ ] Siege
- [ ] JMeter
- [ ] K6
- [ ] Locust

### ✅ Test Scenarios

- [ ] Test homepage load
- [ ] Test API endpoints
- [ ] Test concurrent users (100, 500, 1000)
- [ ] Test database-heavy operations
- [ ] Test file uploads
- [ ] Test checkout process

### ✅ Performance Goals

- [ ] Homepage load time < 2 seconds
- [ ] API response time < 200ms
- [ ] Database query time < 50ms
- [ ] Time to first byte < 500ms
- [ ] Handle 500+ requests/second
- [ ] Support 1000+ concurrent users

---

## Post-Deployment

### ✅ Immediate Checks

- [ ] Clear all caches
- [ ] Restart queue workers
- [ ] Restart PHP-FPM (if applicable)
- [ ] Verify OPcache is working
- [ ] Test critical user flows
- [ ] Check error logs
- [ ] Verify cron jobs are running

### ✅ Monitoring (First 24 Hours)

- [ ] Monitor response times
- [ ] Monitor error rates
- [ ] Monitor server resources
- [ ] Monitor database performance
- [ ] Monitor queue processing
- [ ] Monitor cache hit rates
- [ ] Check user feedback

### ✅ Optimization

- [ ] Identify and fix slow queries
- [ ] Optimize slow endpoints
- [ ] Adjust cache TTL based on usage
- [ ] Scale resources if needed
- [ ] Fine-tune worker counts
- [ ] Adjust rate limits if needed

---

## Continuous Optimization

### ✅ Weekly Tasks

- [ ] Review error logs
- [ ] Check slow query log
- [ ] Monitor cache hit rates
- [ ] Review queue metrics
- [ ] Check disk space usage
- [ ] Review performance metrics

### ✅ Monthly Tasks

- [ ] Run load tests
- [ ] Optimize database (OPTIMIZE TABLE)
- [ ] Review and update indexes
- [ ] Clean up old data
- [ ] Update dependencies
- [ ] Security updates
- [ ] Review CDN statistics

### ✅ Quarterly Tasks

- [ ] Comprehensive performance audit
- [ ] Database maintenance
- [ ] Server resource review
- [ ] Architecture review
- [ ] Scaling assessment
- [ ] Disaster recovery test

---

## Performance Benchmarks

### ✅ Target Metrics

**Response Times:**
- Homepage: < 200ms
- API Endpoints: < 150ms
- Database Queries: < 50ms
- Cache Hits: > 90%

**Server Resources:**
- CPU Usage: < 30% average
- Memory Usage: < 80%
- Disk I/O: < 100 ops/sec
- Network: < 50% bandwidth

**Scalability:**
- Concurrent Users: 1000+
- Requests/Second: 500+
- Database Connections: < 100
- Queue Processing: < 10 second wait

---

## Quick Commands Reference

```bash
# Clear all caches
php artisan optimize:clear

# Optimize application
php artisan optimize

# Cache configuration
php artisan config:cache

# Cache routes
php artisan route:cache

# Cache views
php artisan view:cache

# Install optimized autoloader
composer install --optimize-autoloader --no-dev

# Compile production assets
npm run production

# Run performance report
php artisan performance:report

# Check OPcache status
php -i | grep opcache

# Optimize database
php artisan db:optimize

# Clear OPcache
php artisan opcache:clear

# Monitor queue
php artisan queue:monitor

# Start queue worker
php artisan queue:work --sleep=3 --tries=3 --max-time=3600
```

---

## Helpful Tools

### Performance Testing
- **Apache Bench** - Simple load testing
- **Siege** - HTTP load tester
- **K6** - Modern load testing
- **Lighthouse** - Web performance audit

### Monitoring
- **Laravel Telescope** - Application debugging
- **New Relic** - Application monitoring
- **Datadog** - Infrastructure monitoring
- **Sentry** - Error tracking

### Profiling
- **Blackfire** - PHP profiler
- **Xdebug** - PHP debugger
- **Chrome DevTools** - Browser profiling

---

**Performance Checklist Version:** 1.0  
**Last Updated:** November 16, 2025  
**Laravel Version:** 10.49.1

© 2025 KEOHAMS. All rights reserved.
