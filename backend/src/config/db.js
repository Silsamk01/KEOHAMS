const knexConfig = require('../../knexfile');
const knex = require('knex');

const env = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[env]);

module.exports = db;
