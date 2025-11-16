const db = require('../config/db');

class SupportService {
  /**
   * Generate unique ticket number
   */
  static async generateTicketNumber() {
    const prefix = 'TKT';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Calculate SLA due date
   */
  static calculateDueDate(slaHours) {
    const dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + slaHours);
    return dueDate;
  }

  /**
   * Create support ticket
   */
  static async createTicket(userId, data, trx = null) {
    const dbConn = trx || db;

    const { categoryId, priority, subject, description, orderId } = data;

    // Get SLA hours from category
    let slaHours = 24;
    if (categoryId) {
      const category = await dbConn('ticket_categories')
        .where('id', categoryId)
        .first('sla_hours');
      if (category) {
        slaHours = category.sla_hours;
      }
    }

    const ticketNumber = await this.generateTicketNumber();
    const dueDate = this.calculateDueDate(slaHours);

    const [ticketId] = await dbConn('support_tickets').insert({
      ticket_number: ticketNumber,
      user_id: userId,
      category_id: categoryId,
      priority: priority || 'MEDIUM',
      subject,
      description,
      order_id: orderId,
      due_date: dueDate,
      status: 'OPEN'
    });

    // Add initial message
    await dbConn('ticket_messages').insert({
      ticket_id: ticketId,
      user_id: userId,
      message: description,
      is_internal: false
    });

    return {
      ticket_id: ticketId,
      ticket_number: ticketNumber,
      due_date: dueDate
    };
  }

  /**
   * Add message to ticket
   */
  static async addMessage(ticketId, userId, message, isInternal = false, attachments = null, trx = null) {
    const dbConn = trx || db;

    // Check if this is first response from admin
    const ticket = await dbConn('support_tickets')
      .where('id', ticketId)
      .first('first_response_at', 'status');

    const user = await dbConn('users')
      .where('id', userId)
      .first('role');

    const [messageId] = await dbConn('ticket_messages').insert({
      ticket_id: ticketId,
      user_id: userId,
      message,
      is_internal: isInternal,
      attachments: attachments ? JSON.stringify(attachments) : null
    });

    // If admin's first response, update ticket
    if (user.role === 'admin' && !ticket.first_response_at && !isInternal) {
      await dbConn('support_tickets')
        .where('id', ticketId)
        .update({
          first_response_at: dbConn.fn.now(),
          status: ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status,
          updated_at: dbConn.fn.now()
        });
    } else {
      await dbConn('support_tickets')
        .where('id', ticketId)
        .update({ updated_at: dbConn.fn.now() });
    }

    return { message_id: messageId };
  }

  /**
   * Update ticket status
   */
  static async updateTicketStatus(ticketId, status, userId, trx = null) {
    const dbConn = trx || db;

    const updates = {
      status,
      updated_at: dbConn.fn.now()
    };

    if (status === 'RESOLVED') {
      updates.resolved_at = dbConn.fn.now();
    } else if (status === 'CLOSED') {
      updates.closed_at = dbConn.fn.now();
    }

    await dbConn('support_tickets')
      .where('id', ticketId)
      .update(updates);

    return { ticket_id: ticketId, status };
  }

  /**
   * Assign ticket to admin
   */
  static async assignTicket(ticketId, adminId, trx = null) {
    const dbConn = trx || db;

    await dbConn('support_tickets')
      .where('id', ticketId)
      .update({
        assigned_to: adminId,
        status: 'IN_PROGRESS',
        updated_at: dbConn.fn.now()
      });

    return { ticket_id: ticketId, assigned_to: adminId };
  }

  /**
   * Get ticket details with messages
   */
  static async getTicketDetails(ticketId, userId, isAdmin = false) {
    const ticket = await db('support_tickets')
      .leftJoin('users', 'support_tickets.user_id', 'users.id')
      .leftJoin('ticket_categories', 'support_tickets.category_id', 'ticket_categories.id')
      .leftJoin('users as assigned_user', 'support_tickets.assigned_to', 'assigned_user.id')
      .where('support_tickets.id', ticketId)
      .select(
        'support_tickets.*',
        'users.name as user_name',
        'users.email as user_email',
        'ticket_categories.name as category_name',
        'assigned_user.name as assigned_to_name'
      )
      .first();

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Security check - users can only view their own tickets
    if (!isAdmin && ticket.user_id !== userId) {
      throw new Error('Unauthorized access to ticket');
    }

    // Get messages
    let messagesQuery = db('ticket_messages')
      .leftJoin('users', 'ticket_messages.user_id', 'users.id')
      .where('ticket_messages.ticket_id', ticketId)
      .select(
        'ticket_messages.*',
        'users.name as user_name',
        'users.role as user_role'
      )
      .orderBy('ticket_messages.created_at', 'asc');

    // Filter internal messages for non-admin users
    if (!isAdmin) {
      messagesQuery = messagesQuery.where('ticket_messages.is_internal', false);
    }

    const messages = await messagesQuery;

    return { ticket, messages };
  }

  /**
   * Get user tickets
   */
  static async getUserTickets(userId, status = null, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    let query = db('support_tickets')
      .leftJoin('ticket_categories', 'support_tickets.category_id', 'ticket_categories.id')
      .where('support_tickets.user_id', userId)
      .select(
        'support_tickets.*',
        'ticket_categories.name as category_name'
      );

    if (status) {
      query = query.where('support_tickets.status', status);
    }

    const total = await query.clone().count('* as count').first();
    const tickets = await query
      .orderBy('support_tickets.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return {
      tickets,
      pagination: {
        page,
        limit,
        total: total.count,
        totalPages: Math.ceil(total.count / limit)
      }
    };
  }

  /**
   * Get all tickets (admin)
   */
  static async getAllTickets(filters = {}, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    let query = db('support_tickets')
      .leftJoin('users', 'support_tickets.user_id', 'users.id')
      .leftJoin('ticket_categories', 'support_tickets.category_id', 'ticket_categories.id')
      .leftJoin('users as assigned_user', 'support_tickets.assigned_to', 'assigned_user.id')
      .select(
        'support_tickets.*',
        'users.name as user_name',
        'users.email as user_email',
        'ticket_categories.name as category_name',
        'assigned_user.name as assigned_to_name'
      );

    if (filters.status) {
      query = query.where('support_tickets.status', filters.status);
    }

    if (filters.priority) {
      query = query.where('support_tickets.priority', filters.priority);
    }

    if (filters.categoryId) {
      query = query.where('support_tickets.category_id', filters.categoryId);
    }

    if (filters.assignedTo) {
      query = query.where('support_tickets.assigned_to', filters.assignedTo);
    }

    if (filters.slaBreached === 'true') {
      query = query.where('support_tickets.sla_breached', true);
    }

    const total = await query.clone().count('* as count').first();
    const tickets = await query
      .orderBy('support_tickets.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return {
      tickets,
      pagination: {
        page,
        limit,
        total: total.count,
        totalPages: Math.ceil(total.count / limit)
      }
    };
  }

  /**
   * Check and update SLA breaches
   */
  static async checkSLABreaches() {
    const breachedTickets = await db('support_tickets')
      .where('status', 'OPEN')
      .orWhere('status', 'IN_PROGRESS')
      .where('due_date', '<', db.fn.now())
      .where('sla_breached', false)
      .select('id');

    for (const ticket of breachedTickets) {
      await db('support_tickets')
        .where('id', ticket.id)
        .update({ sla_breached: true });
    }

    return { breached_count: breachedTickets.length };
  }

  /**
   * Rate ticket (customer satisfaction)
   */
  static async rateTicket(ticketId, userId, rating, comment = null, trx = null) {
    const dbConn = trx || db;

    const ticket = await dbConn('support_tickets')
      .where('id', ticketId)
      .where('user_id', userId)
      .first();

    if (!ticket) {
      throw new Error('Ticket not found or unauthorized');
    }

    if (ticket.status !== 'CLOSED') {
      throw new Error('Can only rate closed tickets');
    }

    await dbConn('support_tickets')
      .where('id', ticketId)
      .update({
        satisfaction_rating: rating,
        satisfaction_comment: comment,
        updated_at: dbConn.fn.now()
      });

    return { ticket_id: ticketId, rating };
  }
}

module.exports = SupportService;
