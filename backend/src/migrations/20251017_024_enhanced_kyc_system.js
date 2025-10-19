/**
 * Enhanced KYC System Migration
 * Adds comprehensive fields for government ID, live photo, address proof
 * OCR data extraction, face matching results, and enhanced tracking
 */
exports.up = async function(knex) {
  // Extend kyc_submissions table with new fields
  const hasKycTable = await knex.schema.hasTable('kyc_submissions');
  
  if (hasKycTable) {
    await knex.schema.alterTable('kyc_submissions', (t) => {
      // ID Document fields
      if (!knex.schema.hasColumn('kyc_submissions', 'id_type')) {
        t.enum('id_type', ['NATIONAL_ID', 'DRIVERS_LICENSE', 'PASSPORT', 'OTHER']).nullable();
      }
      if (!knex.schema.hasColumn('kyc_submissions', 'id_number')) {
        t.string('id_number', 100).nullable();
      }
      if (!knex.schema.hasColumn('kyc_submissions', 'id_issue_date')) {
        t.date('id_issue_date').nullable();
      }
      if (!knex.schema.hasColumn('kyc_submissions', 'id_expiry_date')) {
        t.date('id_expiry_date').nullable();
      }
      if (!knex.schema.hasColumn('kyc_submissions', 'id_document_path')) {
        t.string('id_document_path', 500).nullable().comment('Path to government ID image/PDF');
      }
      
      // Live photo / Selfie fields
      if (!knex.schema.hasColumn('kyc_submissions', 'live_photo_path')) {
        t.string('live_photo_path', 500).nullable().comment('Path to live selfie for face verification');
      }
      if (!knex.schema.hasColumn('kyc_submissions', 'face_match_score')) {
        t.decimal('face_match_score', 5, 2).nullable().comment('Face similarity score 0-100');
      }
      if (!knex.schema.hasColumn('kyc_submissions', 'face_match_status')) {
        t.enum('face_match_status', ['PENDING', 'MATCHED', 'NOT_MATCHED', 'ERROR']).defaultTo('PENDING');
      }
      if (!knex.schema.hasColumn('kyc_submissions', 'liveness_check_passed')) {
        t.boolean('liveness_check_passed').nullable();
      }
      
      // Address Proof fields
      if (!knex.schema.hasColumn('kyc_submissions', 'address_proof_type')) {
        t.enum('address_proof_type', ['UTILITY_BILL', 'BANK_STATEMENT', 'RENTAL_AGREEMENT', 'OTHER']).nullable();
      }
      if (!knex.schema.hasColumn('kyc_submissions', 'address_proof_path')) {
        t.string('address_proof_path', 500).nullable();
      }
      if (!knex.schema.hasColumn('kyc_submissions', 'address_proof_date')) {
        t.date('address_proof_date').nullable().comment('Date on address proof document');
      }
      if (!knex.schema.hasColumn('kyc_submissions', 'residential_address')) {
        t.text('residential_address').nullable();
      }
      
      // OCR Extracted Data (stored as JSON)
      if (!knex.schema.hasColumn('kyc_submissions', 'ocr_data')) {
        t.json('ocr_data').nullable().comment('OCR extracted data from ID document');
      }
      if (!knex.schema.hasColumn('kyc_submissions', 'ocr_confidence')) {
        t.decimal('ocr_confidence', 5, 2).nullable().comment('OCR confidence score 0-100');
      }
      if (!knex.schema.hasColumn('kyc_submissions', 'ocr_status')) {
        t.enum('ocr_status', ['PENDING', 'SUCCESS', 'FAILED', 'MANUAL_REVIEW']).defaultTo('PENDING');
      }
      
      // Document Validation
      if (!knex.schema.hasColumn('kyc_submissions', 'document_expired')) {
        t.boolean('document_expired').defaultTo(false);
      }
      if (!knex.schema.hasColumn('kyc_submissions', 'document_quality_score')) {
        t.decimal('document_quality_score', 5, 2).nullable().comment('Image quality score');
      }
      
      // Admin Review fields
      if (!knex.schema.hasColumn('kyc_submissions', 'admin_remarks')) {
        t.text('admin_remarks').nullable();
      }
      if (!knex.schema.hasColumn('kyc_submissions', 'reviewed_by')) {
        t.integer('reviewed_by').unsigned().nullable().references('id').inTable('users');
      }
      if (!knex.schema.hasColumn('kyc_submissions', 'reviewed_at')) {
        t.timestamp('reviewed_at').nullable();
      }
      
      // Encryption & Security
      if (!knex.schema.hasColumn('kyc_submissions', 'is_encrypted')) {
        t.boolean('is_encrypted').defaultTo(false);
      }
      if (!knex.schema.hasColumn('kyc_submissions', 'encryption_key_id')) {
        t.string('encryption_key_id', 100).nullable().comment('Reference to encryption key used');
      }
      
      // Compliance
      if (!knex.schema.hasColumn('kyc_submissions', 'gdpr_consent')) {
        t.boolean('gdpr_consent').defaultTo(false);
      }
      if (!knex.schema.hasColumn('kyc_submissions', 'data_retention_date')) {
        t.timestamp('data_retention_date').nullable().comment('When to delete sensitive data');
      }
    });
  }

  // Create KYC Audit Log table
  const hasAuditTable = await knex.schema.hasTable('kyc_audit_log');
  if (!hasAuditTable) {
    await knex.schema.createTable('kyc_audit_log', (t) => {
      t.increments('id').primary();
      t.integer('kyc_submission_id').unsigned().notNullable().references('id').inTable('kyc_submissions').onDelete('CASCADE');
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.integer('admin_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.enum('action', [
        'SUBMITTED',
        'DOCUMENT_UPLOADED',
        'OCR_PROCESSED',
        'FACE_VERIFIED',
        'ADMIN_REVIEWED',
        'APPROVED',
        'REJECTED',
        'RESUBMIT_REQUESTED',
        'DOCUMENT_EXPIRED',
        'DATA_DELETED'
      ]).notNullable();
      t.enum('status_before', ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESUBMIT_REQUIRED']).nullable();
      t.enum('status_after', ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESUBMIT_REQUIRED']).nullable();
      t.text('remarks').nullable();
      t.json('metadata').nullable().comment('Additional context like IP, device info');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      
      // Indexes for audit queries
      t.index('kyc_submission_id');
      t.index('user_id');
      t.index('admin_id');
      t.index('action');
      t.index('created_at');
    });
  }

  // Create Face Match Results table (for detailed face comparison data)
  const hasFaceTable = await knex.schema.hasTable('kyc_face_matches');
  if (!hasFaceTable) {
    await knex.schema.createTable('kyc_face_matches', (t) => {
      t.increments('id').primary();
      t.integer('kyc_submission_id').unsigned().notNullable().references('id').inTable('kyc_submissions').onDelete('CASCADE');
      t.string('id_face_path', 500).nullable().comment('Extracted face from ID');
      t.string('selfie_face_path', 500).nullable().comment('Extracted face from live photo');
      t.decimal('similarity_score', 5, 2).nullable();
      t.json('face_landmarks').nullable().comment('Detected facial landmarks');
      t.boolean('liveness_passed').defaultTo(false);
      t.json('liveness_checks').nullable().comment('Liveness detection results');
      t.enum('match_status', ['MATCHED', 'NOT_MATCHED', 'UNCERTAIN', 'ERROR']).notNullable();
      t.text('error_message').nullable();
      t.timestamp('processed_at').defaultTo(knex.fn.now());
      
      t.index('kyc_submission_id');
      t.index('match_status');
    });
  }

  // Create OCR Results table (for detailed extraction data)
  const hasOcrTable = await knex.schema.hasTable('kyc_ocr_results');
  if (!hasOcrTable) {
    await knex.schema.createTable('kyc_ocr_results', (t) => {
      t.increments('id').primary();
      t.integer('kyc_submission_id').unsigned().notNullable().references('id').inTable('kyc_submissions').onDelete('CASCADE');
      t.enum('document_type', ['ID', 'ADDRESS_PROOF']).notNullable();
      t.json('extracted_text').nullable().comment('Raw OCR text output');
      t.json('parsed_fields').nullable().comment('Structured extracted fields');
      t.decimal('confidence_score', 5, 2).nullable();
      t.boolean('requires_manual_review').defaultTo(false);
      t.text('manual_corrections').nullable();
      t.timestamp('processed_at').defaultTo(knex.fn.now());
      
      t.index('kyc_submission_id');
      t.index('document_type');
    });
  }
};

exports.down = async function(knex) {
  // Drop new tables
  await knex.schema.dropTableIfExists('kyc_ocr_results');
  await knex.schema.dropTableIfExists('kyc_face_matches');
  await knex.schema.dropTableIfExists('kyc_audit_log');

  // Remove added columns from kyc_submissions
  const hasKycTable = await knex.schema.hasTable('kyc_submissions');
  if (hasKycTable) {
    const columnsToRemove = [
      'id_type', 'id_number', 'id_issue_date', 'id_expiry_date', 'id_document_path',
      'live_photo_path', 'face_match_score', 'face_match_status', 'liveness_check_passed',
      'address_proof_type', 'address_proof_path', 'address_proof_date', 'residential_address',
      'ocr_data', 'ocr_confidence', 'ocr_status',
      'document_expired', 'document_quality_score',
      'admin_remarks', 'reviewed_by', 'reviewed_at',
      'is_encrypted', 'encryption_key_id',
      'gdpr_consent', 'data_retention_date'
    ];

    await knex.schema.alterTable('kyc_submissions', (t) => {
      for (const col of columnsToRemove) {
        if (knex.schema.hasColumn('kyc_submissions', col)) {
          t.dropColumn(col);
        }
      }
    });
  }
};
