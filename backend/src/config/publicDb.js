/**
 * Public Blog Database Connection
 * Separate database for public-facing blog content
 * Read-only for public, synced from main DB by admin
 */
const knex = require('knex');

const publicDb = knex({
  client: 'mysql2',
  connection: {
    host: process.env.PUBLIC_DB_HOST || process.env.DB_HOST,
    port: parseInt(process.env.PUBLIC_DB_PORT || process.env.DB_PORT || '3306', 10),
    user: process.env.PUBLIC_DB_USER || process.env.DB_USER,
    password: process.env.PUBLIC_DB_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.PUBLIC_DB_NAME || 'keohams_public_blog',
    charset: 'utf8mb4',
    timezone: 'UTC',
    connectTimeout: 10000,
    ssl: process.env.PUBLIC_DB_SSL === 'true' || process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  },
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    createRetryIntervalMillis: 200,
    propagateCreateError: false
  },
  debug: process.env.DB_DEBUG === 'true'
});

// Test connection on startup
publicDb.raw('SELECT 1')
  .then(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('✓ Connected to public blog database');
    }
  })
  .catch(err => {
    console.error('✗ Failed to connect to public blog database:', err.message);
    // Don't exit process - let app handle gracefully
  });

// Handle connection errors
publicDb.on('query-error', (error, obj) => {
  console.error('Public blog database query error:', error.message);
});

module.exports = publicDb;
