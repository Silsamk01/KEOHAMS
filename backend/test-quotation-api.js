// Test quotation API endpoint
require('dotenv').config();
const jwt = require('jsonwebtoken');

async function testAPI() {
  console.log('\n=== Testing Quotation API Endpoints ===\n');
  
  // Generate token for user 11 (the one who has the quotation)
  const user11Token = jwt.sign(
    { sub: 11, email: 'amukoyotega@gmail.com', role: 'CUSTOMER' },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
  
  console.log('✅ Generated test token for user 11 (amukoyotega@gmail.com)\n');
  console.log('🔑 Token (first 50 chars):', user11Token.substring(0, 50) + '...\n');
  
  // Test the API endpoint
  const fetch = (await import('node-fetch')).default;
  
  try {
    console.log('📡 Testing GET /api/quotations/mine...\n');
    
    const response = await fetch('http://localhost:3000/api/quotations/mine?page=1&pageSize=25', {
      headers: {
        'Authorization': `Bearer ${user11Token}`,
        'Accept': 'application/json'
      }
    });
    
    console.log('Status:', response.status, response.statusText);
    
    if (!response.ok) {
      const text = await response.text();
      console.error('❌ Error response:', text);
      return;
    }
    
    const data = await response.json();
    console.log('\n✅ Success! Response:');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\n📊 Summary:');
    console.log(`  - Total quotations: ${data.total || 0}`);
    console.log(`  - Returned: ${data.data?.length || 0}`);
    if (data.data?.length > 0) {
      console.log('\n  Quotations:');
      data.data.forEach(q => {
        console.log(`    - ${q.reference}: ${q.status} (${q.items_count || 0} items)`);
      });
    }
    
    // Test getting detail for first quotation
    if (data.data?.length > 0) {
      const firstQuoId = data.data[0].id;
      console.log(`\n📡 Testing GET /api/quotations/mine/${firstQuoId}...\n`);
      
      const detailResponse = await fetch(`http://localhost:3000/api/quotations/mine/${firstQuoId}`, {
        headers: {
          'Authorization': `Bearer ${user11Token}`,
          'Accept': 'application/json'
        }
      });
      
      console.log('Status:', detailResponse.status, detailResponse.statusText);
      
      if (detailResponse.ok) {
        const detail = await detailResponse.json();
        console.log('\n✅ Detail response:');
        console.log(JSON.stringify(detail, null, 2));
        console.log(`\n  Items in quotation: ${detail.items?.length || 0}`);
      } else {
        const text = await detailResponse.text();
        console.error('❌ Error response:', text);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n⚠️  Is the server running? Start it with: npm run dev');
  }
  
  console.log('\n=== Test Complete ===\n');
  process.exit(0);
}

testAPI().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
