/**
 * Fix KYC Submissions Columns (adds missing columns with proper hasColumn checks)
 */

exports.up = async function(knex) {
  const table = 'kyc_submissions';

  async function addColumn(name, cb) {
    const exists = await knex.schema.hasColumn(table, name);
    if (!exists) {
      await knex.schema.alterTable(table, (t) => cb(t));
    }
  }

  // Core ID fields
  await addColumn('id_type', (t) => t.enu('id_type', ['NATIONAL_ID', 'DRIVERS_LICENSE', 'PASSPORT', 'OTHER']).nullable());
  await addColumn('id_number', (t) => t.string('id_number', 100).nullable());
  await addColumn('id_issue_date', (t) => t.date('id_issue_date').nullable());
  await addColumn('id_expiry_date', (t) => t.date('id_expiry_date').nullable());
  await addColumn('id_document_path', (t) => t.string('id_document_path', 500).nullable().comment('Path to government ID image/PDF'));

  // Live photo / face
  await addColumn('live_photo_path', (t) => t.string('live_photo_path', 500).nullable().comment('Path to live selfie for face verification'));
  await addColumn('face_match_score', (t) => t.decimal('face_match_score', 5, 2).nullable().comment('Face similarity score 0-100'));
  await addColumn('face_match_status', (t) => t.enu('face_match_status', ['PENDING', 'MATCHED', 'NOT_MATCHED', 'ERROR']).defaultTo('PENDING'));
  await addColumn('liveness_check_passed', (t) => t.boolean('liveness_check_passed').nullable());

  // Address proof
  await addColumn('address_proof_type', (t) => t.enu('address_proof_type', ['UTILITY_BILL', 'BANK_STATEMENT', 'RENTAL_AGREEMENT', 'OTHER']).nullable());
  await addColumn('address_proof_path', (t) => t.string('address_proof_path', 500).nullable());
  await addColumn('address_proof_date', (t) => t.date('address_proof_date').nullable().comment('Date on address proof document'));
  await addColumn('residential_address', (t) => t.text('residential_address').nullable());

  // OCR
  await addColumn('ocr_data', (t) => t.json('ocr_data').nullable().comment('OCR extracted data from ID document'));
  await addColumn('ocr_confidence', (t) => t.decimal('ocr_confidence', 5, 2).nullable().comment('OCR confidence score 0-100'));
  await addColumn('ocr_status', (t) => t.enu('ocr_status', ['PENDING', 'SUCCESS', 'FAILED', 'MANUAL_REVIEW']).defaultTo('PENDING'));

  // Validation
  await addColumn('document_expired', (t) => t.boolean('document_expired').defaultTo(false));
  await addColumn('document_quality_score', (t) => t.decimal('document_quality_score', 5, 2).nullable().comment('Image quality score'));

  // Admin review
  await addColumn('admin_remarks', (t) => t.text('admin_remarks').nullable());
  await addColumn('reviewed_by', (t) => t.integer('reviewed_by').unsigned().nullable().references('id').inTable('users'));
  await addColumn('reviewed_at', (t) => t.timestamp('reviewed_at').nullable());

  // Security & compliance
  await addColumn('is_encrypted', (t) => t.boolean('is_encrypted').defaultTo(false));
  await addColumn('encryption_key_id', (t) => t.string('encryption_key_id', 100).nullable().comment('Reference to encryption key used'));
  await addColumn('gdpr_consent', (t) => t.boolean('gdpr_consent').defaultTo(false));
  await addColumn('data_retention_date', (t) => t.timestamp('data_retention_date').nullable().comment('When to delete sensitive data'));
};

exports.down = async function(knex) {
  const table = 'kyc_submissions';
  const cols = [
    'id_type', 'id_number', 'id_issue_date', 'id_expiry_date', 'id_document_path',
    'live_photo_path', 'face_match_score', 'face_match_status', 'liveness_check_passed',
    'address_proof_type', 'address_proof_path', 'address_proof_date', 'residential_address',
    'ocr_data', 'ocr_confidence', 'ocr_status',
    'document_expired', 'document_quality_score',
    'admin_remarks', 'reviewed_by', 'reviewed_at',
    'is_encrypted', 'encryption_key_id', 'gdpr_consent', 'data_retention_date'
  ];

  // Drop columns if they exist
  for (const name of cols) {
    const exists = await knex.schema.hasColumn(table, name);
    if (exists) {
      await knex.schema.alterTable(table, (t) => {
        t.dropColumn(name);
      });
    }
  }
};