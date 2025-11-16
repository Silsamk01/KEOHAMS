const express = require('express');
const router = express.Router();
const securityController = require('../controllers/securityController');
const { authenticate } = require('../middlewares/auth');

// User routes - requires authentication
router.get('/audit-log', authenticate, securityController.getAuditLog);
router.post('/gdpr/export', authenticate, securityController.requestDataExport);
router.post('/gdpr/delete', authenticate, securityController.requestDataDeletion);

// Admin routes - requires admin role
router.post('/gdpr/process-export/:request_id', authenticate, securityController.processDataExport);
router.post('/account/:user_id/lock', authenticate, securityController.lockAccount);
router.post('/account/:user_id/unlock', authenticate, securityController.unlockAccount);
router.get('/events', authenticate, securityController.getAllSecurityEvents);
router.get('/login-attempts', authenticate, securityController.getLoginAttempts);

module.exports = router;
