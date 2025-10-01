const db = require('../config/db');

const TABLE = 'users';

async function create(user) { return db(TABLE).insert(user); }
async function findByEmail(email) { return db(TABLE).where({ email }).first(); }
async function findById(id) { return db(TABLE).where({ id }).first(); }
async function verifyEmail(userId) { return db(TABLE).where({ id: userId }).update({ email_verified: 1 }); }
async function update(id, changes) { return db(TABLE).where({ id }).update(changes); }

module.exports = { TABLE, create, findByEmail, findById, verifyEmail, update };
