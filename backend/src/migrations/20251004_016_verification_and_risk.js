exports.up = async function(knex) {
  // user_verification_state: one row per user tracking overall verification tier & risk
  const hasState = await knex.schema.hasTable('user_verification_state');
  if (!hasState) {
    await knex.schema.createTable('user_verification_state', t => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable().unique().references('id').inTable('users').onDelete('CASCADE');
      t.enum('status', ['UNVERIFIED','BASIC_PENDING','BASIC_VERIFIED','KYC_PENDING','KYC_VERIFIED','REJECTED','LOCKED']).notNullable().defaultTo('UNVERIFIED');
      // Numeric risk score (0-1000 scale) & derived qualitative level
      t.integer('risk_score').notNullable().defaultTo(0);
      t.enum('risk_level', ['LOW','MEDIUM','HIGH','CRITICAL']).notNullable().defaultTo('LOW');
      // Escalation / lock metadata
      t.boolean('manual_lock').notNullable().defaultTo(false);
  t.text('lock_reason');
  // Explicit null defaults to satisfy strict SQL modes (NO_ZERO_DATE / explicit_defaults_for_timestamp)
  t.timestamp('locked_at').nullable().defaultTo(null);
  // Basic profile attestation timestamp (when user completed minimal profile requirements)
  t.timestamp('basic_verified_at').nullable().defaultTo(null);
      // KYC linkage convenience (latest approved submission id)
      t.integer('kyc_submission_id').unsigned().references('id').inTable('kyc_submissions').onDelete('SET NULL');
  t.timestamp('kyc_verified_at').nullable().defaultTo(null);
      t.timestamps(true, true);
      t.index(['status']);
      t.index(['risk_level']);
      t.index(['risk_score']);
      t.index(['user_id']);
    });
  }

  // risk_events: append-only audit of risk-affecting occurrences
  const hasRiskEvents = await knex.schema.hasTable('risk_events');
  if (!hasRiskEvents) {
    await knex.schema.createTable('risk_events', t => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.string('event_type').notNullable(); // e.g. LOGIN_FAILURE, KYC_APPROVED, CONTACT_SPAM_FLAG
      t.integer('delta').notNullable().defaultTo(0); // signed change applied to risk score
      t.integer('resulting_score').notNullable().defaultTo(0); // score after applying delta
      t.enum('resulting_level', ['LOW','MEDIUM','HIGH','CRITICAL']).notNullable().defaultTo('LOW');
      t.text('metadata'); // JSON string (stored as text for MySQL 5/8 portability)
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.index(['user_id']);
      t.index(['event_type']);
      t.index(['created_at']);
    });
  }

  // Extend kyc_submissions with additional forensic / scoring columns if they do not yet exist
  const hasKyc = await knex.schema.hasTable('kyc_submissions');
  if (hasKyc) {
    const columns = await knex('information_schema.columns')
      .select('COLUMN_NAME')
      .where({ table_name: 'kyc_submissions', table_schema: knex.client.config.connection.database });
    const colSet = new Set(columns.map(c => c.COLUMN_NAME));
    await knex.schema.alterTable('kyc_submissions', t => {
      if (!colSet.has('doc_country')) t.string('doc_country', 2); // ISO country code
      if (!colSet.has('doc_type')) t.string('doc_type');
      if (!colSet.has('doc_hash')) t.string('doc_hash'); // hash/fingerprint of primary doc to detect reuse
      if (!colSet.has('escalation_level')) t.integer('escalation_level').defaultTo(0);
      if (!colSet.has('fail_reason_code')) t.string('fail_reason_code');
      if (!colSet.has('risk_score_at_submission')) t.integer('risk_score_at_submission');
    });
  }
};

exports.down = async function(knex) {
  // Revert additive changes (drop new tables and try to drop added KYC columns)
  const hasRiskEvents = await knex.schema.hasTable('risk_events');
  if (hasRiskEvents) await knex.schema.dropTable('risk_events');
  const hasState = await knex.schema.hasTable('user_verification_state');
  if (hasState) await knex.schema.dropTable('user_verification_state');
  const hasKyc = await knex.schema.hasTable('kyc_submissions');
  if (hasKyc) {
    // Attempt to drop columns if they exist
    const columns = await knex('information_schema.columns')
      .select('COLUMN_NAME')
      .where({ table_name: 'kyc_submissions', table_schema: knex.client.config.connection.database });
    const colSet = new Set(columns.map(c => c.COLUMN_NAME));
    await knex.schema.alterTable('kyc_submissions', t => {
      if (colSet.has('doc_country')) t.dropColumn('doc_country');
      if (colSet.has('doc_type')) t.dropColumn('doc_type');
      if (colSet.has('doc_hash')) t.dropColumn('doc_hash');
      if (colSet.has('escalation_level')) t.dropColumn('escalation_level');
      if (colSet.has('fail_reason_code')) t.dropColumn('fail_reason_code');
      if (colSet.has('risk_score_at_submission')) t.dropColumn('risk_score_at_submission');
    });
  }
};
