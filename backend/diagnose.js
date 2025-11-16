#!/usr/bin/env node
/**
 * Diagnostic Script for KEOHAMS Production Issues
 * Run this on your cPanel server to diagnose KYC and Affiliate issues
 */

require('dotenv').config();
const db = require('./src/config/db');
const path = require('path');
const fs = require('fs');

async function runDiagnostics() {
  console.log('='.repeat(60));
  console.log('KEOHAMS Production Diagnostics');
  console.log('='.repeat(60));
  console.log('');

  // 1. Check Environment
  console.log('[1] Environment Check');
  console.log('  - NODE_ENV:', process.env.NODE_ENV || 'not set');
  console.log('  - PORT:', process.env.PORT || 'not set');
  console.log('  - Database:', process.env.DB_NAME || 'not set');
  console.log('');

  // 2. Check Database Connection
  console.log('[2] Database Connection');
  try {
    await db.raw('SELECT 1+1 as result');
    console.log('  ✓ Database connected successfully');
  } catch (error) {
    console.log('  ✗ Database connection failed:', error.message);
    process.exit(1);
  }
  console.log('');

  // 3. Check Affiliate Tables
  console.log('[3] Affiliate System Tables');
  const affiliateTables = [
    'affiliates',
    'affiliate_commission_settings',
    'affiliate_sales',
    'affiliate_commissions',
    'affiliate_withdrawals'
  ];

  for (const table of affiliateTables) {
    try {
      const [result] = await db.raw(`SHOW TABLES LIKE '${table}'`);
      if (result.length > 0) {
        const [{ count }] = await db(table).count('* as count');
        console.log(`  ✓ ${table}: ${count} records`);
      } else {
        console.log(`  ✗ ${table}: TABLE NOT FOUND`);
      }
    } catch (error) {
      console.log(`  ✗ ${table}: ERROR - ${error.message}`);
    }
  }
  console.log('');

  // 4. Check KYC Tables
  console.log('[4] KYC System Tables');
  const kycTables = [
    'kyc_submissions',
    'kyc_ocr_results',
    'kyc_face_matches',
    'kyc_audit_log'
  ];

  for (const table of kycTables) {
    try {
      const [result] = await db.raw(`SHOW TABLES LIKE '${table}'`);
      if (result.length > 0) {
        const [{ count }] = await db(table).count('* as count');
        console.log(`  ✓ ${table}: ${count} records`);
      } else {
        console.log(`  ✗ ${table}: TABLE NOT FOUND`);
      }
    } catch (error) {
      console.log(`  ✗ ${table}: ERROR - ${error.message}`);
    }
  }
  console.log('');

  // 5. Check File Upload Directories
  console.log('[5] File Upload Directories');
  const uploadDirs = [
    'uploads/kyc',
    'uploads/products',
    'uploads/blog',
    'logs'
  ];

  for (const dir of uploadDirs) {
    const fullPath = path.join(__dirname, dir);
    try {
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        const permissions = (stats.mode & parseInt('777', 8)).toString(8);
        console.log(`  ✓ ${dir}: exists (permissions: ${permissions})`);
        
        // Test write permission
        const testFile = path.join(fullPath, '.test-write');
        try {
          fs.writeFileSync(testFile, 'test');
          fs.unlinkSync(testFile);
          console.log(`    - Writable: YES`);
        } catch (e) {
          console.log(`    - Writable: NO - ${e.message}`);
        }
      } else {
        console.log(`  ✗ ${dir}: DOES NOT EXIST`);
      }
    } catch (error) {
      console.log(`  ✗ ${dir}: ERROR - ${error.message}`);
    }
  }
  console.log('');

  // 6. Check Migrations Status
  console.log('[6] Migrations Status');
  try {
    const migrations = await db('knex_migrations')
      .select('name')
      .orderBy('id', 'desc')
      .limit(5);
    console.log('  Last 5 migrations:');
    migrations.forEach(m => {
      console.log(`    - ${m.name}`);
    });
    
    const [{ batch }] = await db('knex_migrations')
      .max('batch as batch');
    console.log(`  Total batches: ${batch}`);
  } catch (error) {
    console.log('  ✗ Could not read migrations:', error.message);
  }
  console.log('');

  // 7. Check Pending Withdrawals
  console.log('[7] Affiliate Withdrawals Check');
  try {
    const [{ pending }] = await db('affiliate_withdrawals')
      .where('status', 'PENDING')
      .count('* as pending');
    console.log(`  - Pending withdrawals: ${pending}`);
    
    const [{ processing }] = await db('affiliate_withdrawals')
      .where('status', 'PROCESSING')
      .count('* as processing');
    console.log(`  - Processing withdrawals: ${processing}`);
    
    const [{ completed }] = await db('affiliate_withdrawals')
      .where('status', 'COMPLETED')
      .count('* as completed');
    console.log(`  - Completed withdrawals: ${completed}`);
  } catch (error) {
    console.log('  ✗ Error checking withdrawals:', error.message);
  }
  console.log('');

  // 8. Check KYC Submissions
  console.log('[8] KYC Submissions Check');
  try {
    const [{ pending }] = await db('kyc_submissions')
      .where('status', 'PENDING')
      .count('* as pending');
    console.log(`  - Pending submissions: ${pending}`);
    
    const [{ approved }] = await db('kyc_submissions')
      .where('status', 'APPROVED')
      .count('* as approved');
    console.log(`  - Approved submissions: ${approved}`);
    
    const [{ rejected }] = await db('kyc_submissions')
      .where('status', 'REJECTED')
      .count('* as rejected');
    console.log(`  - Rejected submissions: ${rejected}`);
  } catch (error) {
    console.log('  ✗ Error checking KYC submissions:', error.message);
  }
  console.log('');

  // 9. Check Models Can Load
  console.log('[9] Model Loading Check');
  const models = [
    'affiliate',
    'affiliateWithdrawal',
    'affiliateSale',
    'user'
  ];

  for (const model of models) {
    try {
      const Model = require(`./src/models/${model}`);
      console.log(`  ✓ ${model}: loaded`);
    } catch (error) {
      console.log(`  ✗ ${model}: ${error.message}`);
    }
  }
  console.log('');

  console.log('='.repeat(60));
  console.log('Diagnostics Complete');
  console.log('='.repeat(60));

  // Close database connection
  await db.destroy();
  process.exit(0);
}

// Run diagnostics
runDiagnostics().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
