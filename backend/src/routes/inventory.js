const express = require('express');
const router = express.Router();
const InventoryController = require('../controllers/inventoryController');
const { verifyToken } = require('../middlewares/auth');
const { isAdmin } = require('../middlewares/adminAuth');

// Public routes
router.get('/:productId/availability', InventoryController.getProductAvailability);

// Protected routes (require authentication)
router.use(verifyToken);

// Stock management
router.post('/:productId/stock', isAdmin, InventoryController.updateStock);
router.get('/:productId/history', InventoryController.getInventoryHistory);

// Reservations
router.post('/:productId/reserve', InventoryController.reserveStock);
router.post('/reservations/:reservationId/release', InventoryController.releaseReservation);
router.post('/reservations/:reservationId/fulfill', InventoryController.fulfillReservation);
router.post('/reservations/release-expired', isAdmin, InventoryController.releaseExpiredReservations);

// Low stock alerts (admin only)
router.get('/alerts/low-stock', isAdmin, InventoryController.getLowStockAlerts);
router.put('/alerts/:alertId/acknowledge', isAdmin, InventoryController.acknowledgeAlert);
router.put('/alerts/:alertId/resolve', isAdmin, InventoryController.resolveAlert);

// Inventory settings (admin only)
router.put('/:productId/settings', isAdmin, InventoryController.updateInventorySettings);

module.exports = router;
