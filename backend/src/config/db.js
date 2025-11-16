const knexConfig = require('../../knexfile');
const knex = require('knex');

const env = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[env]);

// Test connection on startup
db.raw('SELECT 1')
  .then(() => {
    if (env === 'development') {
      console.log('✓ Connected to main database');
    }
  })
  .catch(err => {
    console.error('✗ Failed to connect to main database:', err.message);
    // Don't exit process - let app handle gracefully
  });

// Handle connection errors
db.on('query-error', (error, obj) => {
  console.error('Database query error:', error.message);
});

module.exports = db;
