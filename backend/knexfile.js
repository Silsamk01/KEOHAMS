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
	},
	migrations: {
		tableName: 'knex_migrations',
		directory: './src/migrations'
	},
	pool: { min: 0, max: 10 }
};

module.exports = {
	development: base,
	production: base,
	test: { ...base, connection: { ...base.connection, database: `${base.connection.database}_test` } }
};

