const { verify } = require('../utils/jwt');
const db = require('../config/db');
const User = require('../models/user');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const payload = verify(token);
    // Fetch fresh user snapshot to ensure still exists & active
  const user = await db(User.TABLE).where({ id: payload.sub }).first();
    if (!user || user.deleted_at || user.is_deleted) {
      return res.status(401).json({ message: 'Account removed' });
    }
    if (user.is_active === 0 || user.is_active === false) {
      return res.status(401).json({ message: 'Account inactive' });
    }
    // Attach minimal safe subset; preserve original claims
    if (payload.tv && user.token_version && payload.tv !== user.token_version) {
      return res.status(401).json({ message: 'Session expired' });
    }
    req.user = { ...payload, role: user.role, status: user.status, tv: user.token_version };
    return next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

function requireSelfOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const targetUserId = parseInt(req.params.user_id);
  const currentUserId = parseInt(req.user.sub);
  
  // Allow if user is accessing their own data or if user is admin
  if (currentUserId === targetUserId || req.user.role === 'ADMIN') {
    return next();
  }
  
  return res.status(403).json({ message: 'Forbidden' });
}

/**
 * Try to read JWT if sent; do not error if absent/invalid. Sets req.user when valid.
 */
async function tryAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = verify(token);
    const user = await db(User.TABLE).where({ id: payload.sub }).first();
    if (user && !user.deleted_at && !user.is_deleted && user.is_active !== 0 && user.is_active !== false) {
      if (payload.tv && user.token_version && payload.tv !== user.token_version) {
        // token version mismatch -> treat as anonymous
      } else {
        req.user = { ...payload, role: user.role, status: user.status, tv: user.token_version };
      }
    }
  } catch (_e) {
    // ignore
  }
  next();
}

// Aliases for compatibility
const authenticate = requireAuth;
const verifyToken = requireAuth;
const optionalAuth = tryAuth;

module.exports = { 
  requireAuth, 
  requireRole, 
  requireSelfOrAdmin, 
  tryAuth,
  authenticate,
  verifyToken,
  optionalAuth
};
