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
    charset: 'utf8mb4'
  },
  pool: {
    min: 2,
    max: 10
  },
  debug: process.env.NODE_ENV === 'development'
});

// Test connection on startup
publicDb.raw('SELECT 1')
  .then(() => {
    console.log('✓ Connected to public blog database');
  })
  .catch(err => {
    console.error('✗ Failed to connect to public blog database:', err.message);
  });

module.exports = publicDb;
