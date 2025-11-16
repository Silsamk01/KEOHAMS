/**
 * Migration: Customer Support Ticketing System
 * Creates ticket management system with categories, priorities, and SLA tracking
 */

exports.up = async function(knex) {
  // Create ticket_categories table
  const hasTicketCategories = await knex.schema.hasTable('ticket_categories');
  if (!hasTicketCategories) {
    await knex.schema.createTable('ticket_categories', (table) => {
      table.increments('id').primary();
      table.string('name', 100).notNullable().unique();
      table.text('description');
      table.integer('sla_hours').defaultTo(24).comment('SLA response time in hours');
      table.boolean('active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  // Create support_tickets table
  const hasSupportTickets = await knex.schema.hasTable('support_tickets');
  if (!hasSupportTickets) {
    await knex.schema.createTable('support_tickets', (table) => {
      table.increments('id').primary();
      table.string('ticket_number', 50).notNullable().unique();
      table.integer('user_id').unsigned().notNullable();
      table.integer('category_id').unsigned();
      table.enum('priority', ['LOW', 'MEDIUM', 'HIGH', 'URGENT']).defaultTo('MEDIUM');
      table.enum('status', ['OPEN', 'IN_PROGRESS', 'AWAITING_CUSTOMER', 'RESOLVED', 'CLOSED']).defaultTo('OPEN');
      table.string('subject', 255).notNullable();
      table.text('description').notNullable();
      table.integer('assigned_to').unsigned().comment('Admin user ID');
      table.integer('order_id').unsigned().comment('Related order if applicable');
      table.timestamp('first_response_at').nullable();
      table.timestamp('resolved_at').nullable();
      table.timestamp('closed_at').nullable();
      table.timestamp('due_date').nullable().comment('SLA due date');
      table.boolean('sla_breached').defaultTo(false);
      table.integer('satisfaction_rating').comment('1-5 rating');
      table.text('satisfaction_comment');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      table.foreign('category_id').references('ticket_categories.id').onDelete('SET NULL');
      table.foreign('assigned_to').references('users.id').onDelete('SET NULL');
      table.foreign('order_id').references('orders.id').onDelete('SET NULL');
      
      table.index(['user_id', 'status']);
      table.index(['assigned_to', 'status']);
      table.index('status');
      table.index('priority');
      table.index('ticket_number');
    });
  }

  // Create ticket_messages table
  const hasTicketMessages = await knex.schema.hasTable('ticket_messages');
  if (!hasTicketMessages) {
    await knex.schema.createTable('ticket_messages', (table) => {
      table.increments('id').primary();
      table.integer('ticket_id').unsigned().notNullable();
      table.integer('user_id').unsigned().notNullable();
      table.text('message').notNullable();
      table.boolean('is_internal').defaultTo(false).comment('Internal note not visible to customer');
      table.json('attachments').comment('Array of attachment URLs');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.foreign('ticket_id').references('support_tickets.id').onDelete('CASCADE');
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      
      table.index(['ticket_id', 'created_at']);
      table.index('user_id');
    });
  }

  // Create canned_responses table
  const hasCannedResponses = await knex.schema.hasTable('canned_responses');
  if (!hasCannedResponses) {
    await knex.schema.createTable('canned_responses', (table) => {
      table.increments('id').primary();
      table.string('title', 255).notNullable();
      table.text('content').notNullable();
      table.integer('category_id').unsigned();
      table.boolean('active').defaultTo(true);
      table.integer('created_by').unsigned();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.foreign('category_id').references('ticket_categories.id').onDelete('SET NULL');
      table.foreign('created_by').references('users.id').onDelete('SET NULL');
      
      table.index('category_id');
    });
  }

  // Insert default ticket categories
  const hasCategories = await knex('ticket_categories').count('* as count').first();
  if (hasCategories.count === 0) {
    await knex('ticket_categories').insert([
      { name: 'Order Issue', description: 'Issues related to orders', sla_hours: 24 },
      { name: 'Payment Problem', description: 'Payment and billing issues', sla_hours: 12 },
      { name: 'Product Question', description: 'Questions about products', sla_hours: 48 },
      { name: 'Technical Support', description: 'Website and technical issues', sla_hours: 24 },
      { name: 'Account Help', description: 'Account and login issues', sla_hours: 24 },
      { name: 'Shipping', description: 'Shipping and delivery inquiries', sla_hours: 24 },
      { name: 'Return/Refund', description: 'Returns and refunds', sla_hours: 24 },
      { name: 'Other', description: 'General inquiries', sla_hours: 48 }
    ]);
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('canned_responses');
  await knex.schema.dropTableIfExists('ticket_messages');
  await knex.schema.dropTableIfExists('support_tickets');
  await knex.schema.dropTableIfExists('ticket_categories');
};
