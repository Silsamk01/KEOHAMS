const express = require('express');
const router = express.Router();
const SupportController = require('../controllers/supportController');
const { verifyToken } = require('../middlewares/auth');
const { isAdmin } = require('../middlewares/adminAuth');

// Public routes
router.get('/categories', SupportController.getCategories);

// Protected routes (require authentication)
router.use(verifyToken);

// Customer ticket management
router.post('/tickets', SupportController.createTicket);
router.get('/tickets', SupportController.getUserTickets);
router.get('/tickets/:ticketId', SupportController.getTicketDetails);
router.post('/tickets/:ticketId/messages', SupportController.addMessage);
router.put('/tickets/:ticketId/status', SupportController.updateTicketStatus);
router.post('/tickets/:ticketId/rate', SupportController.rateTicket);

// Admin ticket management
router.get('/admin/tickets', isAdmin, SupportController.getAllTickets);
router.put('/tickets/:ticketId/assign', isAdmin, SupportController.assignTicket);

module.exports = router;
