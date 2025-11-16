/**
 * Feature 11: Product Reviews & Ratings System
 * - Customer reviews with star ratings
 * - Verified purchase badges
 * - Review voting (helpful/not helpful)
 * - Review moderation
 */
exports.up = async function (knex) {
  // Create product_reviews table
  if (!(await knex.schema.hasTable('product_reviews'))) {
    await knex.schema.createTable('product_reviews', (table) => {
      table.increments('id').primary();
      table.integer('product_id').unsigned().notNullable()
        .references('id').inTable('products').onDelete('CASCADE');
      table.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.integer('order_id').unsigned().nullable()
        .references('id').inTable('orders').onDelete('SET NULL');
      table.integer('rating').unsigned().notNullable(); // 1-5 stars
      table.string('title', 200).notNullable();
      table.text('comment').notNullable();
      table.boolean('is_verified_purchase').defaultTo(false);
      table.enum('status', ['PENDING', 'APPROVED', 'REJECTED']).defaultTo('PENDING');
      table.integer('helpful_count').unsigned().defaultTo(0);
      table.integer('not_helpful_count').unsigned().defaultTo(0);
      table.integer('moderated_by').unsigned().nullable()
        .references('id').inTable('users').onDelete('SET NULL');
      table.text('moderation_notes').nullable();
      table.timestamp('moderated_at').nullable();
      table.timestamps(true, true);
      
      table.index('product_id');
      table.index('user_id');
      table.index('status');
      table.index(['product_id', 'status']);
      table.index(['user_id', 'product_id']); // One review per user per product
    });
  }

  // Create review_votes table (track helpful/not helpful votes)
  if (!(await knex.schema.hasTable('review_votes'))) {
    await knex.schema.createTable('review_votes', (table) => {
      table.increments('id').primary();
      table.integer('review_id').unsigned().notNullable()
        .references('id').inTable('product_reviews').onDelete('CASCADE');
      table.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.enum('vote_type', ['HELPFUL', 'NOT_HELPFUL']).notNullable();
      table.timestamp('voted_at').defaultTo(knex.fn.now());
      
      table.index('review_id');
      table.index('user_id');
      table.unique(['review_id', 'user_id']); // One vote per user per review
    });
  }

  // Create review_images table (optional: allow users to upload images with reviews)
  if (!(await knex.schema.hasTable('review_images'))) {
    await knex.schema.createTable('review_images', (table) => {
      table.increments('id').primary();
      table.integer('review_id').unsigned().notNullable()
        .references('id').inTable('product_reviews').onDelete('CASCADE');
      table.string('image_url', 500).notNullable();
      table.integer('display_order').unsigned().defaultTo(0);
      table.timestamps(true, true);
      
      table.index('review_id');
    });
  }

  // Add rating statistics to products table
  if (await knex.schema.hasTable('products')) {
    const hasRatingAvg = await knex.schema.hasColumn('products', 'rating_average');
    const hasRatingCount = await knex.schema.hasColumn('products', 'rating_count');

    if (!hasRatingAvg) {
      await knex.schema.table('products', (table) => {
        table.decimal('rating_average', 3, 2).nullable();
      });
    }

    if (!hasRatingCount) {
      await knex.schema.table('products', (table) => {
        table.integer('rating_count').unsigned().defaultTo(0);
      });
    }
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('review_images');
  await knex.schema.dropTableIfExists('review_votes');
  await knex.schema.dropTableIfExists('product_reviews');

  if (await knex.schema.hasTable('products')) {
    await knex.schema.table('products', (table) => {
      table.dropColumn('rating_average');
      table.dropColumn('rating_count');
    });
  }
};
