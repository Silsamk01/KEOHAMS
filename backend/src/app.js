const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { notFound, errorHandler } = require('./middlewares/error');
const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const productRoutes = require('./routes/products');
const healthRoutes = require('./routes/health');
const adminRoutes = require('./routes/admin');
const blogRoutes = require('./routes/blog');
const kycRoutes = require('./routes/kyc');
const ordersRoutes = require('./routes/orders');
const notificationsRoutes = require('./routes/notifications');
const chatRoutes = require('./routes/chats');

const app = express();

// Security & common middleware
app.use(helmet());
// Content Security Policy: allow only the exact external domains we use
app.use(
	helmet.contentSecurityPolicy({
		useDefaults: true,
		directives: {
			defaultSrc: ["'self'"],
			connectSrc: [
				"'self'",
				'https://cdn.jsdelivr.net',
				'https://fonts.googleapis.com',
				'https://fonts.gstatic.com'
			],
			scriptSrc: [
				"'self'",
				'https://cdn.jsdelivr.net'
			],
			styleSrc: [
				"'self'",
				"'unsafe-inline'", // allow inline style attributes used in pages
				'https://cdn.jsdelivr.net',
				'https://fonts.googleapis.com'
			],
			imgSrc: [
				"'self'",
				'data:',
				'blob:',
				'https://images.unsplash.com',
				'https://via.placeholder.com'
			],
			fontSrc: [
				"'self'",
				'https://fonts.gstatic.com',
				'data:'
			],
			objectSrc: ["'none'"],
			baseUri: ["'self'"],
			frameAncestors: ["'self'"],
			upgradeInsecureRequests: []
		}
	})
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// Note: xss-clean is incompatible with Express 5 (it reassigns req.query). We'll add a safe sanitizer later.
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limits (basic)
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/auth', authLimiter);

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/chats', chatRoutes);

// Static for uploaded media
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
// Serve company logo from repo root
app.get('/keohamlogo.jpg', (req, res) => {
	res.sendFile(path.join(__dirname, '..', '..', 'keohamlogo.jpg'));
});

// Serve frontend landing page from backend
const frontendPublic = path.join(__dirname, '..', '..', 'frontend', 'public');
const frontendSrc = path.join(__dirname, '..', '..', 'frontend', 'src');
const frontendPages = path.join(__dirname, '..', '..', 'frontend', 'pages');
app.use(express.static(frontendPublic));
app.use('/src', express.static(frontendSrc));
app.use('/pages', express.static(frontendPages));

// Base route -> serve index.html
app.get('/', (req, res) => {
	res.sendFile(path.join(frontendPublic, 'index.html'));
});

// Registration page
app.get('/register', (req, res) => {
	res.sendFile(path.join(frontendPages, 'register.html'));
});

// Email verification page
app.get('/verify', (req, res) => {
	res.sendFile(path.join(frontendPages, 'verify.html'));
});

// Forgot and Reset password pages
app.get('/forgot', (req, res) => {
	res.sendFile(path.join(frontendPages, 'forgot.html'));
});
app.get('/reset', (req, res) => {
	res.sendFile(path.join(frontendPages, 'reset.html'));
});

// Admin page shell
app.get('/admin', (req, res) => {
	res.set({
		'Cache-Control': 'no-store, no-cache, must-revalidate, private',
		'Pragma': 'no-cache',
		'Expires': '0'
	});
	res.sendFile(path.join(frontendPages, 'admin.html'));
});

// User dashboard
app.get('/dashboard', (req, res) => {
	res.set({
		'Cache-Control': 'no-store, no-cache, must-revalidate, private',
		'Pragma': 'no-cache',
		'Expires': '0'
	});
	res.sendFile(path.join(frontendPages, 'dashboard.html'));
});

// Shop and Cart pages
app.get('/shop', (req, res) => {
	res.sendFile(path.join(frontendPages, 'shop.html'));
});
app.get('/cart', (req, res) => {
	res.sendFile(path.join(frontendPages, 'cart.html'));
});


// Clean blog routes without .html extensions
app.get('/blog', (req, res) => {
	res.sendFile(path.join(frontendPages, 'blog.html'));
});
app.get('/blog/:slug', (req, res) => {
	res.sendFile(path.join(frontendPages, 'blog-post.html'));
});

// (no user dashboard route)

// 404 and error handlers
app.use(notFound);
app.use(errorHandler);

module.exports = app;
