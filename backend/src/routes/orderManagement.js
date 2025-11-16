const express = require('express');
const router = express.Router();
const OrderManagementController = require('../controllers/orderManagementController');
const { verifyToken } = require('../middlewares/auth');
const { isAdmin } = require('../middlewares/adminAuth');

// All routes require authentication
router.use(verifyToken);

// Order status and workflow
router.post('/:orderId/status', OrderManagementController.updateOrderStatus);
router.get('/:orderId/history', OrderManagementController.getStatusHistory);
router.get('/:orderId/fulfillment', OrderManagementController.getFulfillmentSummary);

// Shipping
router.post('/:orderId/ship', isAdmin, OrderManagementController.shipOrder);
router.post('/:orderId/shipments', isAdmin, OrderManagementController.createShipment);
router.get('/:orderId/shipments', OrderManagementController.getOrderShipments);

// Item fulfillment
router.put('/:orderId/items/:itemId/fulfillment', isAdmin, OrderManagementController.updateItemFulfillment);

// Cancellation
router.post('/:orderId/cancel', OrderManagementController.cancelOrder);

// Returns
router.post('/:orderId/returns', OrderManagementController.createReturn);
router.get('/:orderId/returns', OrderManagementController.getOrderReturns);
router.put('/returns/:returnId/process', isAdmin, OrderManagementController.processReturn);

// Notes
router.post('/:orderId/notes', OrderManagementController.addNote);
router.get('/:orderId/notes', OrderManagementController.getOrderNotes);

// Invoices
router.post('/:orderId/invoices', isAdmin, OrderManagementController.generateInvoice);
router.get('/:orderId/invoices', OrderManagementController.getOrderInvoices);

module.exports = router;
