const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const hpp = require('hpp');
const { body, validationResult } = require('express-validator');

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// General API rate limiter - 100 requests per 15 minutes
const apiLimiter = createRateLimiter(
  15 * 60 * 1000,
  100,
  'Too many requests from this IP, please try again later'
);

// Strict rate limiter for authentication - 5 attempts per 15 minutes
const authLimiter = createRateLimiter(
  15 * 60 * 1000,
  5,
  'Too many login attempts, please try again later'
);

// Payment rate limiter - 10 requests per hour
const paymentLimiter = createRateLimiter(
  60 * 60 * 1000,
  10,
  'Too many payment requests, please try again later'
);

// Sensitive operations - 3 attempts per hour
const sensitiveLimiter = createRateLimiter(
  60 * 60 * 1000,
  3,
  'Too many sensitive operations, please try again later'
);

// Helmet security headers
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// HTTP Parameter Pollution protection
const hppProtection = hpp();

// Input sanitization validators
const sanitizeInput = {
  email: () => body('email').isEmail().normalizeEmail().trim().escape(),
  
  password: () => body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  
  name: () => body('name')
    .isLength({ min: 2, max: 100 })
    .trim()
    .escape(),
  
  phone: () => body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Invalid phone number'),
  
  text: (field, minLength = 1, maxLength = 1000) => 
    body(field)
      .isLength({ min: minLength, max: maxLength })
      .trim()
      .escape(),
  
  numeric: (field) => body(field).isNumeric().toInt(),
  
  boolean: (field) => body(field).isBoolean().toBoolean(),
  
  url: (field) => body(field).isURL().trim(),
};

// Validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// XSS protection middleware
const xssProtection = (req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        // Remove potential script tags and dangerous patterns
        req.body[key] = req.body[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      }
    });
  }
  next();
};

// IP whitelist/blacklist middleware
const ipBlacklist = new Set();

const checkIpBlacklist = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (ipBlacklist.has(ip)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

const addToBlacklist = (ip) => {
  ipBlacklist.add(ip);
};

const removeFromBlacklist = (ip) => {
  ipBlacklist.delete(ip);
};

module.exports = {
  // Rate limiters
  apiLimiter,
  authLimiter,
  paymentLimiter,
  sensitiveLimiter,
  
  // Security middleware
  helmetConfig,
  hppProtection,
  xssProtection,
  
  // Input validation
  sanitizeInput,
  handleValidationErrors,
  
  // IP management
  checkIpBlacklist,
  addToBlacklist,
  removeFromBlacklist,
};
