const db = require('../config/db');

async function countForUser(userId) {
  const row = await db('orders').where({ user_id: userId }).count({ c: '*' }).first();
  return Number(row?.c || 0);
}

module.exports = { countForUser };
