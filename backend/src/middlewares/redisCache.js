/**
 * Redis-based TTL cache middleware for GET endpoints
 * Replaces in-memory Map with Redis for distributed caching
 * Falls back to in-memory if Redis is unavailable
 */

const logger = require('../utils/logger');
let redis = null;
let redisAvailable = false;

// Try to initialize Redis client
try {
  const Redis = require('ioredis');
  
  const redisConfig = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB) || 0,
    retryStrategy: (times) => {
      if (times > 3) {
        logger.warn('Redis connection failed after 3 attempts, falling back to in-memory cache');
        return null; // Stop retrying
      }
      return Math.min(times * 100, 2000);
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
    tls: process.env.REDIS_TLS === 'true' ? {
      rejectUnauthorized: false
    } : undefined
  };

  redis = new Redis(redisConfig);

  redis.on('connect', () => {
    redisAvailable = true;
    logger.info('Redis cache connected');
  });

  redis.on('error', (err) => {
    redisAvailable = false;
    logger.warn({ err }, 'Redis cache error, using fallback');
  });

  redis.on('close', () => {
    redisAvailable = false;
    logger.warn('Redis cache connection closed');
  });

  // Attempt to connect
  redis.connect().catch((err) => {
    logger.warn({ err }, 'Failed to connect to Redis, using in-memory fallback');
    redisAvailable = false;
  });

} catch (err) {
  logger.warn({ err }, 'Redis module not available, using in-memory cache');
  redisAvailable = false;
}

// Fallback in-memory cache
const DEFAULT_TTL_MS = 60 * 1000;
const MAX_ENTRIES = 500;
const memoryStore = new Map();

function pruneMemoryCache() {
  if (memoryStore.size <= MAX_ENTRIES) return;
  const removeCount = Math.ceil(memoryStore.size * 0.1);
  let i = 0;
  for (const key of memoryStore.keys()) {
    memoryStore.delete(key);
    if (++i >= removeCount) break;
  }
}

function getCacheKey(req) {
  // Include method, path, and relevant query params
  const url = req.originalUrl || req.url;
  return `cache:${req.method}:${url}`;
}

/**
 * Redis cache middleware
 * @param {number} ttlMs - Time to live in milliseconds
 * @param {Object} options - Additional options
 * @param {boolean} options.varyByUser - Cache per user (default: false)
 * @param {string} options.keyPrefix - Custom key prefix (default: 'cache')
 * @returns {Function} Express middleware
 */
function cache(ttlMs = DEFAULT_TTL_MS, options = {}) {
  const { varyByUser = false, keyPrefix = 'cache' } = options;

  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip cache if disabled
    if (process.env.CACHE_DISABLE === 'true') {
      return next();
    }

    // Generate cache key
    let key = `${keyPrefix}:${req.originalUrl || req.url}`;
    if (varyByUser && req.user?.sub) {
      key += `:user:${req.user.sub}`;
    }

    const now = Date.now();
    const ttlSeconds = Math.ceil(ttlMs / 1000);

    // Try Redis first
    if (redisAvailable && redis) {
      try {
        const cached = await redis.get(key);
        if (cached) {
          res.set('X-Cache', 'HIT');
          res.set('X-Cache-Type', 'redis');
          return res.status(200).send(cached);
        }

        // Cache miss - wrap res.send
        const origSend = res.send.bind(res);
        res.send = function(body) {
          if (res.statusCode === 200) {
            // Store in Redis asynchronously (don't await)
            redis.setex(key, ttlSeconds, body).catch((err) => {
              logger.warn({ err, key }, 'Failed to cache in Redis');
            });
            res.set('X-Cache', 'MISS');
            res.set('X-Cache-Type', 'redis');
          }
          return origSend(body);
        };

        return next();
      } catch (err) {
        logger.warn({ err }, 'Redis cache error, falling back to memory');
        // Fall through to memory cache
      }
    }

    // Fallback to in-memory cache
    const hit = memoryStore.get(key);
    if (hit && hit.expires > now) {
      res.set('X-Cache', 'HIT');
      res.set('X-Cache-Type', 'memory');
      return res.status(200).send(hit.value);
    }

    // Cache miss - wrap res.send for memory cache
    const origSend = res.send.bind(res);
    res.send = function(body) {
      if (res.statusCode === 200) {
        memoryStore.set(key, { value: body, expires: now + ttlMs });
        pruneMemoryCache();
        res.set('X-Cache', 'MISS');
        res.set('X-Cache-Type', 'memory');
      }
      return origSend(body);
    };

    next();
  };
}

/**
 * Clear cache by pattern
 * @param {string} pattern - Redis key pattern (e.g., 'cache:products:*')
 * @returns {Promise<number>} Number of keys deleted
 */
async function clearCache(pattern = 'cache:*') {
  let cleared = 0;

  // Clear Redis cache
  if (redisAvailable && redis) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        cleared = await redis.del(...keys);
      }
      logger.info({ pattern, cleared }, 'Redis cache cleared');
    } catch (err) {
      logger.error({ err, pattern }, 'Failed to clear Redis cache');
    }
  }

  // Clear memory cache
  for (const key of memoryStore.keys()) {
    if (key.includes(pattern.replace('*', ''))) {
      memoryStore.delete(key);
      cleared++;
    }
  }

  return cleared;
}

/**
 * Get cache stats
 * @returns {Promise<Object>} Cache statistics
 */
async function getCacheStats() {
  const stats = {
    type: redisAvailable ? 'redis' : 'memory',
    memoryEntries: memoryStore.size,
    redisConnected: redisAvailable
  };

  if (redisAvailable && redis) {
    try {
      const info = await redis.info('stats');
      const keys = await redis.dbsize();
      stats.redisKeys = keys;
      stats.redisInfo = info;
    } catch (err) {
      logger.warn({ err }, 'Failed to get Redis stats');
    }
  }

  return stats;
}

/**
 * Close Redis connection gracefully
 */
async function closeCache() {
  if (redis) {
    try {
      await redis.quit();
      logger.info('Redis cache connection closed');
    } catch (err) {
      logger.error({ err }, 'Error closing Redis connection');
    }
  }
}

module.exports = {
  cache,
  clearCache,
  getCacheStats,
  closeCache,
  getRedisClient: () => redis
};
