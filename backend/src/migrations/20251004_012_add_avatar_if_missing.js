exports.up = async function(knex){
  const has = await knex.schema.hasColumn('users','avatar_url');
  if(!has){
    await knex.schema.alterTable('users', t=>{ t.string('avatar_url').nullable().after('twofa_secret'); });
  }
};

exports.down = async function(knex){
  // No-op safe down (do not drop again to avoid accidental data loss if previous migration manages it)
};
