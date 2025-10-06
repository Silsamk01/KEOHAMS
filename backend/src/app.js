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
const quotationsRoutes = require('./routes/quotations');
const notificationsRoutes = require('./routes/notifications');
const chatRoutes = require('./routes/chats');
const userRoutes = require('./routes/user');
const currencyRoutes = require('./routes/currency');
const contactRoutes = require('./routes/contact');
const adminContactRoutes = require('./routes/adminContact');
const adminNotifReadRoutes = require('./routes/adminNotificationReads');
const verificationRoutes = require('./routes/verification');
const adminVerificationRoutes = require('./routes/adminVerification');
const { cache } = require('./middlewares/cache');
const { strictKycGate } = require('./middlewares/kyc');
const { tryAuth } = require('./middlewares/auth');

const app = express();
app.set('etag', 'strong'); // strong ETags for better cache validation
app.set('trust proxy', 1); // behind reverse proxy / load balancer

// Request ID middleware (simple, could be replaced by UUID if needed)
app.use((req, _res, next) => {
	req.id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
	next();
});

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
app.use(compression({ threshold: 1024 })); // compress responses >1KB
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
// Attach user if token present but do not require (used for STRICT_KYC gating later)
app.use(tryAuth);

// Rate limits (basic & targeted)
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const notifLimiter = rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false });
const chatLimiter = rateLimit({ windowMs: 60 * 1000, limit: 200, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth', authLimiter);
app.use('/api/notifications', notifLimiter);
app.use('/api/chats', chatLimiter);

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
// Cached GET heavy-read endpoints (short TTL)
app.use('/api/categories', cache(5 * 60 * 1000), categoryRoutes); // 5 min
app.use('/api/products', cache(30 * 1000), productRoutes); // 30s (list pagination still dynamic via query cache key)
app.use('/api/admin', adminRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/blog', cache(60 * 1000), blogRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/quotations', quotationsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/currency', cache(5 * 60 * 1000), currencyRoutes);
app.use('/api/user', userRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin/contact', adminContactRoutes);
app.use('/api/admin/notification-read-events', adminNotifReadRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/admin/verification', adminVerificationRoutes);

// Strict KYC enforcement (optional): if env STRICT_KYC=1 then require KYC_VERIFIED for most API routes.
// We apply AFTER public/unauth routes registered above and BEFORE static file serving.
if (process.env.STRICT_KYC === '1') {
  // Whitelisted API endpoints accessible before KYC approval
  const kycWhitelist = new Set([
    '/api/health',
    '/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/forgot', '/api/auth/reset',
    '/api/verification/state', '/api/verification/kyc/submit', '/api/verification/basic/submit',
    '/api/kyc/submit', '/api/kyc',
  ]);
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) return next();
    if (kycWhitelist.has(req.path)) return next();
    // Allow unauthenticated access to non-api (static assets) - already handled above
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    return strictKycGate()(req, res, next);
  });
}

// Static for uploaded media (support both backend/uploads and backend/src/uploads just in case)
const uploadsPrimary = path.join(__dirname, '..', 'uploads');
const uploadsAlt = path.join(__dirname, 'uploads'); // this is backend/src/uploads
// Secure KYC file serving for admin users only
// Serve KYC files for admins (use named wildcard param compatible with path-to-regexp)
// Expect simple filename (no slashes) as param; filenames generated by multer do not contain path separators
app.get('/admin/kyc-files/:file', require('./middlewares/auth').requireAuth, (req, res, next) => {
	if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Admin access required' });
	const filePath = req.params.file || '';
	const fullPath = path.resolve(uploadsPrimary, filePath);
	const uploadsPrimaryResolved = path.resolve(uploadsPrimary);
	// Security check: ensure resolved path is inside uploadsPrimary
	if (path.relative(uploadsPrimaryResolved, fullPath).startsWith('..')) {
		return res.status(403).json({ message: 'Invalid file path' });
	}
	res.sendFile(fullPath, (err) => {
		if (err) {
			// Try alternative path
			const altPath = path.resolve(uploadsAlt, filePath);
			const uploadsAltResolved = path.resolve(uploadsAlt);
			if (path.relative(uploadsAltResolved, altPath).startsWith('..')) {
				return res.status(403).json({ message: 'Invalid file path' });
			}
			res.sendFile(altPath, (sendErr) => {
				if (sendErr) return res.status(404).json({ message: 'File not found' });
			});
		}
	});
});

app.use('/uploads', (req, res, next) => {
	// try primary first, fallback to alt
	express.static(uploadsPrimary)(req, res, (err) => {
		if (err) return next(err);
		// If not found in primary, attempt alt
		express.static(uploadsAlt)(req, res, next);
	});
});
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

// Settings clean route (serve settings page)
app.get('/settings', (req, res) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.sendFile(path.join(frontendPages, 'settings.html'));
});

// Shop and Cart pages
app.get('/shop', (req, res) => {
	res.sendFile(path.join(frontendPages, 'shop.html'));
});
app.get('/cart', (req, res) => {
	res.sendFile(path.join(frontendPages, 'cart.html'));
});

// About & Contact pages (public)
app.get('/about', (req, res) => {
  res.sendFile(path.join(frontendPages, 'about.html'));
});
app.get('/contact', (req, res) => {
  res.sendFile(path.join(frontendPages, 'contact.html'));
});

// Full-page Chat
app.get('/chat', (req, res) => {
	res.set({
		'Cache-Control': 'no-store, no-cache, must-revalidate, private',
		'Pragma': 'no-cache',
		'Expires': '0'
	});
	res.sendFile(path.join(frontendPages, 'chat.html'));
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
