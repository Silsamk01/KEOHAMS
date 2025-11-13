/**
 * Public Blog Routes
 * No authentication required - reads from public database
 */
const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/publicBlogController');

// Public endpoints (no auth required)
router.get('/', asyncHandler(ctrl.listPublic));
router.get('/categories', asyncHandler(ctrl.getPublicCategories));
router.get('/tags', asyncHandler(ctrl.getPublicTags));
router.get('/slug/:slug', asyncHandler(ctrl.getPublicBySlug));

module.exports = router;
