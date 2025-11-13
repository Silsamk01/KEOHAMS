/**
 * Standardized Error Response Utilities
 * Ensures all API errors return consistent JSON format
 */

/**
 * Standard error response structure
 * @param {string} message - Human-readable error message
 * @param {string} code - Machine-readable error code
 * @param {number} status - HTTP status code
 * @param {Object} details - Additional error details
 * @returns {Object} Formatted error object
 */
function errorResponse(message, code = 'ERROR', status = 500, details = {}) {
  return {
    success: false,
    error: {
      message,
      code,
      status,
      ...details
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Standard success response structure
 * @param {*} data - Response data
 * @param {string} message - Optional success message
 * @param {Object} meta - Optional metadata (pagination, etc.)
 * @returns {Object} Formatted success object
 */
function successResponse(data, message = null, meta = {}) {
  const response = {
    success: true,
    data
  };

  if (message) {
    response.message = message;
  }

  if (Object.keys(meta).length > 0) {
    response.meta = meta;
  }

  return response;
}

/**
 * Common error response builders
 */
const errors = {
  // Authentication errors (401)
  unauthorized: (message = 'Authentication required') => 
    errorResponse(message, 'UNAUTHORIZED', 401),

  invalidToken: () => 
    errorResponse('Invalid or expired token', 'INVALID_TOKEN', 401),

  sessionExpired: () => 
    errorResponse('Session expired. Please sign in again.', 'SESSION_EXPIRED', 401),

  // Authorization errors (403)
  forbidden: (message = 'Access denied') => 
    errorResponse(message, 'FORBIDDEN', 403),

  insufficientPermissions: () => 
    errorResponse('Insufficient permissions', 'INSUFFICIENT_PERMISSIONS', 403),

  kycRequired: (status = 'NOT_SUBMITTED') => 
    errorResponse(
      'KYC verification required',
      'KYC_REQUIRED',
      403,
      { kycStatus: status, redirectTo: '/kyc-enhanced' }
    ),

  verificationRequired: (currentStatus, requiredTier) => 
    errorResponse(
      'Account verification required',
      'VERIFICATION_REQUIRED',
      403,
      { currentStatus, requiredTier }
    ),

  accountLocked: () => 
    errorResponse(
      'Account locked. Please contact support.',
      'ACCOUNT_LOCKED',
      423
    ),

  // Not found errors (404)
  notFound: (resource = 'Resource') => 
    errorResponse(`${resource} not found`, 'NOT_FOUND', 404),

  // Validation errors (400)
  badRequest: (message = 'Invalid request') => 
    errorResponse(message, 'BAD_REQUEST', 400),

  validationError: (fields = {}) => 
    errorResponse(
      'Validation failed',
      'VALIDATION_ERROR',
      400,
      { fields }
    ),

  missingFields: (fields = []) => 
    errorResponse(
      `Missing required fields: ${fields.join(', ')}`,
      'MISSING_FIELDS',
      400,
      { fields }
    ),

  // Conflict errors (409)
  conflict: (message = 'Resource already exists') => 
    errorResponse(message, 'CONFLICT', 409),

  duplicateEntry: (field) => 
    errorResponse(
      `${field} already exists`,
      'DUPLICATE_ENTRY',
      409,
      { field }
    ),

  // Rate limiting (429)
  rateLimitExceeded: (retryAfter = null) => 
    errorResponse(
      'Too many requests. Please try again later.',
      'RATE_LIMIT_EXCEEDED',
      429,
      retryAfter ? { retryAfter } : {}
    ),

  // Server errors (500)
  internal: (message = 'Internal server error') => 
    errorResponse(message, 'INTERNAL_ERROR', 500),

  serviceUnavailable: (service = 'Service') => 
    errorResponse(
      `${service} temporarily unavailable`,
      'SERVICE_UNAVAILABLE',
      503
    ),

  // Custom error
  custom: (message, code, status = 500, details = {}) => 
    errorResponse(message, code, status, details)
};

/**
 * Express error handler middleware
 * Catches all errors and formats them consistently
 */
function errorHandler(err, req, res, next) {
  // Log error for debugging
  const logger = require('./logger');
  logger.error({
    err,
    method: req.method,
    path: req.path,
    userId: req.user?.sub
  }, 'Request error');

  // Check if response already sent
  if (res.headersSent) {
    return next(err);
  }

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json(
      errors.validationError(err.details || {})
    );
  }

  if (err.name === 'UnauthorizedError' || err.status === 401) {
    return res.status(401).json(errors.unauthorized(err.message));
  }

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json(
      errors.duplicateEntry('Entry')
    );
  }

  // Default to 500 internal error
  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'An unexpected error occurred' 
    : err.message;

  res.status(status).json(
    errorResponse(message, err.code || 'ERROR', status)
  );
}

/**
 * Express middleware to send error responses
 * Usage: res.error(errors.notFound('User'))
 */
function attachErrorResponders(req, res, next) {
  res.success = (data, message, meta) => {
    return res.json(successResponse(data, message, meta));
  };

  res.error = (errorObj) => {
    return res.status(errorObj.error.status).json(errorObj);
  };

  next();
}

module.exports = {
  errorResponse,
  successResponse,
  errors,
  errorHandler,
  attachErrorResponders
};
