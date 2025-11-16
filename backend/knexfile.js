require('dotenv').config();

const base = {
	client: 'mysql2',
	connection: {
		host: process.env.DB_HOST || '127.0.0.1',
		port: Number(process.env.DB_PORT || 3306),
		user: process.env.DB_USER || 'root',
		password: process.env.DB_PASSWORD || '',
		database: process.env.DB_NAME || 'keohams',
		multipleStatements: true,
		charset: 'utf8mb4',
		timezone: 'UTC',
		connectTimeout: 10000,
		ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
	},
	migrations: {
		tableName: 'knex_migrations',
		directory: './src/migrations'
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
};

module.exports = {
	development: base,
	production: base,
	test: { ...base, connection: { ...base.connection, database: `${base.connection.database}_test` } }
};

