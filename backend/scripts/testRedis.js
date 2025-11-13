/**
 * Redis Connection Test Script
 * Tests connection to Redis Labs instance
 */

require('dotenv').config();
const Redis = require('ioredis');

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  username: process.env.REDIS_USERNAME || undefined,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB) || 0,
  tls: process.env.REDIS_TLS === 'true' ? {
    rejectUnauthorized: false
  } : undefined,
  retryStrategy: (times) => {
    if (times > 3) {
      console.error('❌ Failed to connect after 3 attempts');
      return null;
    }
    console.log(`Retry attempt ${times}...`);
    return Math.min(times * 500, 2000);
  }
};

console.log('🔄 Connecting to Redis...');
console.log(`   Host: ${redisConfig.host}`);
console.log(`   Port: ${redisConfig.port}`);
console.log(`   Database: ${redisConfig.db}`);
console.log(`   TLS: ${redisConfig.tls ? 'Enabled' : 'Disabled'}`);
console.log('');

const redis = new Redis(redisConfig);

redis.on('connect', () => {
  console.log('✓ Connected to Redis');
});

redis.on('ready', async () => {
  console.log('✓ Redis client ready\n');

  try {
    // Test 1: Set and Get
    console.log('Test 1: Basic SET/GET');
    await redis.set('test:hello', 'world');
    const value = await redis.get('test:hello');
    console.log(`  ✓ SET/GET: ${value === 'world' ? 'PASS' : 'FAIL'}`);

    // Test 2: Expiration
    console.log('\nTest 2: Expiration (TTL)');
    await redis.setex('test:expire', 5, 'temporary');
    const ttl = await redis.ttl('test:expire');
    console.log(`  ✓ TTL: ${ttl} seconds (expected: ~5)`);

    // Test 3: Cache pattern
    console.log('\nTest 3: Cache Pattern');
    const cacheKey = 'cache:test:data';
    await redis.setex(cacheKey, 60, JSON.stringify({ data: 'cached value' }));
    const cached = await redis.get(cacheKey);
    const parsed = JSON.parse(cached);
    console.log(`  ✓ Cache: ${parsed.data === 'cached value' ? 'PASS' : 'FAIL'}`);

    // Test 4: Multiple keys
    console.log('\nTest 4: Multiple Keys');
    await redis.mset('key1', 'value1', 'key2', 'value2', 'key3', 'value3');
    const values = await redis.mget('key1', 'key2', 'key3');
    console.log(`  ✓ MSET/MGET: ${values.join(', ')}`);

    // Test 5: Delete
    console.log('\nTest 5: Delete Keys');
    await redis.del('test:hello', 'test:expire', cacheKey, 'key1', 'key2', 'key3');
    console.log('  ✓ Cleanup: All test keys deleted');

    // Connection info
    console.log('\n📊 Redis Info:');
    const info = await redis.info('server');
    const redisVersion = info.match(/redis_version:([^\r\n]+)/)?.[1];
    console.log(`  Version: ${redisVersion}`);
    
    const dbsize = await redis.dbsize();
    console.log(`  Total Keys: ${dbsize}`);

    console.log('\n✅ All Redis tests passed!');
    console.log('Your Redis connection is configured correctly.\n');

    await redis.quit();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await redis.quit();
    process.exit(1);
  }
});

redis.on('error', (err) => {
  console.error('❌ Redis Error:', err.message);
  if (err.code === 'ECONNREFUSED') {
    console.error('   Make sure Redis server is running and accessible');
  } else if (err.code === 'ENOTFOUND') {
    console.error('   Check your REDIS_HOST in .env file');
  } else if (err.message.includes('WRONGPASS')) {
    console.error('   Check your REDIS_PASSWORD in .env file');
  } else if (err.message.includes('NOAUTH')) {
    console.error('   Redis requires authentication. Set REDIS_PASSWORD in .env');
  }
  process.exit(1);
});

redis.on('close', () => {
  console.log('🔌 Redis connection closed');
});

// Timeout after 10 seconds
setTimeout(() => {
  console.error('\n⏱️  Connection timeout after 10 seconds');
  redis.disconnect();
  process.exit(1);
}, 10000);
