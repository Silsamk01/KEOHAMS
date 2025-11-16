/**
 * Migration: Search and Filtering System
 * Adds fulltext search indexes, search history, and recently viewed tracking
 */

exports.up = async function(knex) {
  // Create fulltext indexes on products table
  await knex.raw('ALTER TABLE products ADD FULLTEXT INDEX ft_product_search (title, description)');

  // Create search_history table
  const hasSearchHistory = await knex.schema.hasTable('search_history');
  if (!hasSearchHistory) {
    await knex.schema.createTable('search_history', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned();
      table.string('search_query', 255).notNullable();
      table.integer('results_count').defaultTo(0);
      table.string('filters', 500).comment('JSON string of applied filters');
      table.timestamp('searched_at').defaultTo(knex.fn.now());

      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      
      table.index(['user_id', 'searched_at']);
      table.index('search_query');
    });
  }

  // Create recently_viewed table
  const hasRecentlyViewed = await knex.schema.hasTable('recently_viewed');
  if (!hasRecentlyViewed) {
    await knex.schema.createTable('recently_viewed', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned();
      table.integer('product_id').unsigned().notNullable();
      table.timestamp('viewed_at').defaultTo(knex.fn.now());
      table.integer('view_count').defaultTo(1);

      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      table.foreign('product_id').references('products.id').onDelete('CASCADE');
      
      table.unique(['user_id', 'product_id']);
      table.index(['user_id', 'viewed_at']);
      table.index('product_id');
    });
  }

  // Create popular_searches table (for autocomplete)
  const hasPopularSearches = await knex.schema.hasTable('popular_searches');
  if (!hasPopularSearches) {
    await knex.schema.createTable('popular_searches', (table) => {
      table.increments('id').primary();
      table.string('search_term', 255).notNullable().unique();
      table.integer('search_count').defaultTo(1);
      table.integer('result_count_avg').defaultTo(0);
      table.timestamp('last_searched').defaultTo(knex.fn.now());
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('search_count');
      table.index('search_term');
    });
  }

  // Add search-related columns to products table if they don't exist
  const hasTags = await knex.schema.hasColumn('products', 'tags');
  const hasSearchKeywords = await knex.schema.hasColumn('products', 'search_keywords');

  await knex.schema.table('products', (table) => {
    if (!hasTags) {
      table.text('tags').comment('Comma-separated tags for filtering');
    }
    if (!hasSearchKeywords) {
      table.text('search_keywords').comment('Additional keywords for search optimization');
    }
  });
};

exports.down = async function(knex) {
  // Drop fulltext index
  await knex.raw('ALTER TABLE products DROP INDEX ft_product_search');

  // Drop tables
  await knex.schema.dropTableIfExists('popular_searches');
  await knex.schema.dropTableIfExists('recently_viewed');
  await knex.schema.dropTableIfExists('search_history');

  // Drop columns
  const hasTags = await knex.schema.hasColumn('products', 'tags');
  const hasSearchKeywords = await knex.schema.hasColumn('products', 'search_keywords');

  await knex.schema.table('products', (table) => {
    if (hasTags) table.dropColumn('tags');
    if (hasSearchKeywords) table.dropColumn('search_keywords');
  });
};
