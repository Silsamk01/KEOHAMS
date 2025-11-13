// Quick diagnostic script to test quotation access
require('dotenv').config();
const db = require('./src/config/db');
const jwt = require('jsonwebtoken');

async function test() {
  console.log('\n=== QUOTATION ACCESS DIAGNOSTIC ===\n');
  
  // Check all quotations
  const quotations = await db('quotations').select('id', 'reference', 'user_id', 'status');
  console.log('📋 Total quotations in database:', quotations.length);
  console.log(quotations);
  
  // Check all users
  const users = await db('users').select('id', 'email', 'name', 'role');
  console.log('\n👥 All users:');
  users.forEach(u => console.log(`  - ID ${u.id}: ${u.email} (${u.name}) - ${u.role}`));
  
  // Test token generation for each user
  console.log('\n🔑 Test tokens for each user:\n');
  for (const user of users) {
    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    console.log(`User ${user.id} (${user.email}):`);
    console.log(`Token: ${token.substring(0, 50)}...`);
    
    // Check what quotations this user can see
    const userQuotations = await db('quotations')
      .where({ user_id: user.id })
      .select('id', 'reference', 'status');
    console.log(`Quotations: ${userQuotations.length} - ${userQuotations.map(q => q.reference).join(', ') || 'none'}\n`);
  }
  
  // Check quotation items
  console.log('📦 Quotation items:');
  const items = await db('quotation_items')
    .select('quotation_id', 'product_name', 'quantity', 'unit_price');
  items.forEach(i => console.log(`  - Quotation ${i.quotation_id}: ${i.product_name} x${i.quantity} @ $${i.unit_price}`));
  
  console.log('\n✅ Diagnostic complete\n');
  process.exit(0);
}

test().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
