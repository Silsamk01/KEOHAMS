const db = require('../config/db');
const SupportService = require('../services/supportService');

class SupportController {
  /**
   * Create ticket
   * POST /api/support/tickets
   */
  static async createTicket(req, res) {
    const trx = await db.transaction();
    try {
      const userId = req.user.id;
      const { categoryId, priority, subject, description, orderId } = req.body;

      if (!subject || !description) {
        return res.status(400).json({ error: 'Subject and description are required' });
      }

      const result = await SupportService.createTicket(
        userId,
        { categoryId, priority, subject, description, orderId },
        trx
      );

      await trx.commit();
      res.json({
        success: true,
        message: 'Ticket created successfully',
        data: result
      });
    } catch (error) {
      await trx.rollback();
      console.error('Create ticket error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get ticket details
   * GET /api/support/tickets/:ticketId
   */
  static async getTicketDetails(req, res) {
    try {
      const { ticketId } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';

      const result = await SupportService.getTicketDetails(ticketId, userId, isAdmin);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get ticket details error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Add message to ticket
   * POST /api/support/tickets/:ticketId/messages
   */
  static async addMessage(req, res) {
    const trx = await db.transaction();
    try {
      const { ticketId } = req.params;
      const userId = req.user.id;
      const { message, isInternal, attachments } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const result = await SupportService.addMessage(
        ticketId,
        userId,
        message,
        isInternal || false,
        attachments,
        trx
      );

      await trx.commit();
      res.json({
        success: true,
        message: 'Message added successfully',
        data: result
      });
    } catch (error) {
      await trx.rollback();
      console.error('Add message error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Update ticket status
   * PUT /api/support/tickets/:ticketId/status
   */
  static async updateTicketStatus(req, res) {
    const trx = await db.transaction();
    try {
      const { ticketId } = req.params;
      const { status } = req.body;
      const userId = req.user.id;

      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      const result = await SupportService.updateTicketStatus(ticketId, status, userId, trx);

      await trx.commit();
      res.json({
        success: true,
        message: 'Ticket status updated successfully',
        data: result
      });
    } catch (error) {
      await trx.rollback();
      console.error('Update ticket status error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Assign ticket (admin)
   * PUT /api/support/tickets/:ticketId/assign
   */
  static async assignTicket(req, res) {
    const trx = await db.transaction();
    try {
      const { ticketId } = req.params;
      const { adminId } = req.body;

      if (!adminId) {
        return res.status(400).json({ error: 'Admin ID is required' });
      }

      const result = await SupportService.assignTicket(ticketId, adminId, trx);

      await trx.commit();
      res.json({
        success: true,
        message: 'Ticket assigned successfully',
        data: result
      });
    } catch (error) {
      await trx.rollback();
      console.error('Assign ticket error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get user tickets
   * GET /api/support/tickets
   */
  static async getUserTickets(req, res) {
    try {
      const userId = req.user.id;
      const { status, page = 1, limit = 20 } = req.query;

      const result = await SupportService.getUserTickets(
        userId,
        status,
        parseInt(page),
        parseInt(limit)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get user tickets error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get all tickets (admin)
   * GET /api/support/admin/tickets
   */
  static async getAllTickets(req, res) {
    try {
      const { status, priority, categoryId, assignedTo, slaBreached, page = 1, limit = 20 } = req.query;

      const filters = {
        status,
        priority,
        categoryId,
        assignedTo,
        slaBreached
      };

      const result = await SupportService.getAllTickets(
        filters,
        parseInt(page),
        parseInt(limit)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get all tickets error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Rate ticket
   * POST /api/support/tickets/:ticketId/rate
   */
  static async rateTicket(req, res) {
    const trx = await db.transaction();
    try {
      const { ticketId } = req.params;
      const userId = req.user.id;
      const { rating, comment } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
      }

      const result = await SupportService.rateTicket(ticketId, userId, rating, comment, trx);

      await trx.commit();
      res.json({
        success: true,
        message: 'Thank you for your feedback',
        data: result
      });
    } catch (error) {
      await trx.rollback();
      console.error('Rate ticket error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get ticket categories
   * GET /api/support/categories
   */
  static async getCategories(req, res) {
    try {
      const categories = await db('ticket_categories')
        .where('active', true)
        .select('id', 'name', 'description', 'sla_hours');

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = SupportController;
