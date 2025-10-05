const router = require('express').Router();
const ctrl = require('../controllers/productController');
const asyncHandler = require('../utils/asyncHandler');
const { upload } = require('../middlewares/upload');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { sendMail } = require('../utils/email');
const db = require('../config/db');

router.get('/', asyncHandler(ctrl.list));
router.get('/:id', asyncHandler(ctrl.get));
router.post('/', requireAuth, requireRole('ADMIN'), upload.fields([{ name: 'images' }, { name: 'videos' }]), asyncHandler(ctrl.create));
router.put('/:id', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.update));
router.delete('/:id', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.remove));

// Product inquiry (optional next step implementation)
router.post('/:id/inquiry', requireAuth, asyncHandler(async (req, res) => {
	const { id } = req.params;
	const { message } = req.body;
	const product = await db('products').where({ id }).first();
	if (!product) return res.status(404).json({ message: 'Product not found' });
	const user = await db('users').where({ id: req.user.sub }).first();
	const mailTo = process.env.ADMIN_EMAIL || 'admin@example.com';
	await sendMail({
		to: mailTo,
		subject: `Product inquiry: ${product.title} (#${product.id})`,
		html: `<p><strong>From:</strong> ${user?.name || 'User'} (${user?.email})</p>
					 <p><strong>Product:</strong> ${product.title} (ID ${product.id})</p>
					 <p><strong>Message:</strong></p><p>${(message||'').replace(/</g,'&lt;')}</p>`
	});
	res.json({ message: 'Inquiry sent' });
}));

module.exports = router;
