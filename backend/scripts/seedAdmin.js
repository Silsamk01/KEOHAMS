require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');

(async () => {
  try {
    const email = process.env.ADMIN_EMAIL || process.argv[2];
    const password = process.env.ADMIN_PASSWORD || process.argv[3];
    const name = process.env.ADMIN_NAME || process.argv[4] || 'Administrator';
    if (!email || !password) {
      console.error('Usage: node scripts/seedAdmin.js <email> <password> [name]  (or set ADMIN_EMAIL and ADMIN_PASSWORD in .env)');
      process.exit(1);
    }
    const existing = await db('users').where({ email }).first();
    if (existing) {
      await db('users').where({ id: existing.id }).update({ role: 'ADMIN' });
      console.log(`User ${email} exists; promoted to ADMIN.`);
      process.exit(0);
    }
    const hash = await bcrypt.hash(password, 10);
    const [id] = await db('users').insert({ name, email, password_hash: hash, role: 'ADMIN', email_verified: 1 });
    console.log(`Admin created: id=${id}, email=${email}`);
    process.exit(0);
  } catch (e) {
    console.error('Failed to seed admin:', e.message);
    process.exit(1);
  }
})();
