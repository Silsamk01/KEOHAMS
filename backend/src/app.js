const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { notFound, errorHandler: legacyErrorHandler } = require('./middlewares/error');
const { errorHandler, attachErrorResponders } = require('./utils/errorResponse');
const security = require('./middlewares/security');
const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const productRoutes = require('./routes/products');
const healthRoutes = require('./routes/health');
const adminRoutes = require('./routes/admin');
const blogRoutes = require('./routes/blog');
const publicBlogRoutes = require('./routes/publicBlog');
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
const enhancedKYCRoutes = require('./routes/enhancedKYC');
const affiliateRoutes = require('./routes/affiliate');
const affiliateAuthRoutes = require('./routes/affiliateAuth');
const { cache } = require('./middlewares/redisCache'); // Use Redis-based cache
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
app.use(security.helmetConfig);
// Content Security Policy: allow only the exact external domains we use
app.use(
	helmet.contentSecurityPolicy({
		useDefaults: true,
		directives: {
			defaultSrc: ["'self'"],
			// Allow API/XHR and Socket.IO websocket connections
			connectSrc: [
				"'self'",
				'https://cdn.jsdelivr.net',
				'https://fonts.googleapis.com',
				'https://fonts.gstatic.com',
				'https://cdnjs.cloudflare.com',
				'ws:',
				'wss:'
			],
			// Allow inline script blocks used across pages (e.g., small bootstrapping snippets)
			scriptSrc: [
				"'self'",
				"'unsafe-inline'",
				"'unsafe-eval'", // Required for some libraries
				'https://cdn.jsdelivr.net'
			],
			// Allow inline event handlers for onclick, onload, etc.
			scriptSrcAttr: ["'unsafe-inline'"],
			styleSrc: [
				"'self'",
				"'unsafe-inline'", // allow inline style attributes used in pages
				'https://cdn.jsdelivr.net',
				'https://fonts.googleapis.com',
				'https://cdnjs.cloudflare.com'
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
				'https://cdnjs.cloudflare.com',
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
app.use(security.hppProtection); // HTTP Parameter Pollution protection
app.use(security.xssProtection); // XSS protection
app.use(compression({ threshold: 1024 })); // compress responses >1KB
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
// Attach user if token present but do not require
app.use(tryAuth);
// Attach standardized error response helpers
app.use(attachErrorResponders);

// Rate limits (security-enhanced)
const notifLimiter = rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false });
const chatLimiter = rateLimit({ windowMs: 60 * 1000, limit: 200, standardHeaders: true, legacyHeaders: false });
const kycLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false }); // 50 requests per 15 min for KYC
const authGeneralLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }); // 100 requests per 15 min
app.use('/api/auth', authGeneralLimiter); // General auth endpoints
app.use('/api/auth/login', security.authLimiter); // Strict limit on login attempts only
app.use('/api/auth/register', security.authLimiter); // Strict limit on registration
app.use('/api/notifications', notifLimiter);
app.use('/api/chats', chatLimiter);
app.use('/api/payment', security.paymentLimiter); // 10 requests per hour
app.use('/api/kyc', kycLimiter); // KYC operations - 50 per 15 min

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
// Cached GET heavy-read endpoints (short TTL)
app.use('/api/categories', cache(5 * 60 * 1000), categoryRoutes); // 5 min
app.use('/api/products', cache(30 * 1000), productRoutes); // 30s (list pagination still dynamic via query cache key)
app.use('/api/admin', adminRoutes);
app.use('/api/blog', cache(60 * 1000), blogRoutes); // Authenticated blog (private portal)
app.use('/api/public/blog', cache(2 * 60 * 1000), publicBlogRoutes); // Public blog (no auth, public DB)
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
app.use('/api/kyc/enhanced', enhancedKYCRoutes);
// Register affiliate auth routes BEFORE affiliate routes to avoid route conflicts
app.use('/api/affiliate/auth', affiliateAuthRoutes);
app.use('/api/affiliate', affiliateRoutes);
app.use('/api/newsletter', require('./routes/newsletter'));
app.use('/api/settings', require('./routes/platformSettings'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/orders', require('./routes/orderManagement'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/search', require('./routes/search'));
app.use('/api/support', require('./routes/support'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/currency-management', require('./routes/currencyManagement'));
app.use('/api/security', require('./routes/security'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/reviews', require('./routes/reviews'));

// Static for uploaded media (support both backend/uploads and backend/src/uploads just in case)
const uploadsPrimary = path.join(__dirname, '..', 'uploads');
const uploadsAlt = path.join(__dirname, 'uploads'); // this is backend/src/uploads

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
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');

// Serve production-built assets if available in production
if (process.env.NODE_ENV === 'production') {
	app.use('/dist', express.static(frontendDist, { etag: true, maxAge: '7d', immutable: false }));
	// Rewrite /src/js/*.js to built files in /dist/*.js to avoid editing HTML in production
	app.get('/src/js/:file', (req, res, next) => {
		const candidate = path.join(frontendDist, req.params.file);
		res.sendFile(candidate, (err) => {
			if (err) return next(); // fallback to /src below (dev)
		});
	});
}

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

// Notifications clean route -> redirect to dashboard notifications pane
app.get('/notifications', (req, res) => {
  res.redirect(302, '/dashboard?pane=notifications');
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
app.get('/blog-public', (req, res) => {
	res.sendFile(path.join(frontendPages, 'blog-public.html'));
});
app.get('/blog-public/:slug', (req, res) => {
	res.sendFile(path.join(frontendPages, 'blog-public-post.html'));
});
app.get('/blog/:slug', (req, res) => {
	res.sendFile(path.join(frontendPages, 'blog-post.html'));
});

// Redirect .html version to clean URL (disable direct .html access)
app.get('/kyc-enhanced.html', (req, res) => {
	res.redirect(301, '/kyc-enhanced');
});

app.get('/pages/kyc-enhanced.html', (req, res) => {
	res.redirect(301, '/kyc-enhanced');
});

// KYC Enhanced submission page (customer-facing)
app.get('/kyc-enhanced', (req, res) => {
	res.set({
		'Cache-Control': 'no-store, no-cache, must-revalidate, private',
		'Pragma': 'no-cache',
		'Expires': '0'
	});
	res.sendFile(path.join(frontendPages, 'kyc-enhanced.html'));
});

// Affiliate Routes
app.get('/affiliate-dashboard', (req, res) => {
	res.set({
		'Cache-Control': 'no-store, no-cache, must-revalidate, private',
		'Pragma': 'no-cache',
		'Expires': '0'
	});
	res.sendFile(path.join(frontendPages, 'affiliate-dashboard.html'));
});

app.get('/affiliate-register', (req, res) => {
	res.sendFile(path.join(frontendPages, 'affiliate-register.html'));
});

app.get('/affiliate-login', (req, res) => {
	res.sendFile(path.join(frontendPages, 'affiliate-login.html'));
});

app.get('/affiliate-forgot-password', (req, res) => {
	res.sendFile(path.join(frontendPages, 'affiliate-forgot-password.html'));
});

// Affiliate email verification route
app.get('/affiliate-verify', (req, res) => {
	res.sendFile(path.join(frontendPages, 'affiliate-verify.html'));
});

// Terms & Conditions and Privacy Policy pages
app.get('/terms-and-conditions', (req, res) => {
	res.sendFile(path.join(frontendPages, 'terms-and-conditions.html'));
});

app.get('/privacy-policy', (req, res) => {
	res.sendFile(path.join(frontendPages, 'privacy-policy.html'));
});

// (no user dashboard route)

// 404 and error handlers
app.use(notFound);
app.use(errorHandler);

module.exports = app;
