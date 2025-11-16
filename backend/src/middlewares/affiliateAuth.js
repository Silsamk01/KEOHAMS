const { verify } = require('../utils/jwt');
const db = require('../config/db');

/**
 * Require affiliate authentication
 */
async function requireAffiliateAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  
  if (!token) {
    return res.status(401).json({ 
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  try {
    const payload = verify(token);
    
    // Check if token is for affiliate (not shop user)
    if (payload.type !== 'affiliate' && payload.role !== 'AFFILIATE') {
      return res.status(403).json({ 
        message: 'Invalid token type. Affiliate token required.',
        code: 'INVALID_TOKEN_TYPE'
      });
    }
    
    // Fetch affiliate from database
    const affiliate = await db('affiliates')
      .where({ id: payload.sub })
      .whereNull('deleted_at')
      .first();
    
    if (!affiliate) {
      return res.status(401).json({ 
        message: 'Affiliate account not found',
        code: 'AFFILIATE_NOT_FOUND'
      });
    }
    
    // Check if account is active
    if (affiliate.is_active_account === false || affiliate.is_active_account === 0) {
      return res.status(403).json({ 
        message: 'Affiliate account is inactive',
        code: 'ACCOUNT_INACTIVE'
      });
    }
    
    // Check token version
    if (payload.tv && affiliate.token_version && payload.tv !== affiliate.token_version) {
      return res.status(401).json({ 
        message: 'Session expired. Please login again.',
        code: 'SESSION_EXPIRED'
      });
    }
    
    // Attach affiliate to request
    req.affiliate = {
      id: affiliate.id,
      email: affiliate.email,
      name: affiliate.name,
      referral_code: affiliate.referral_code,
      role: 'AFFILIATE',
      type: 'affiliate'
    };
    
    return next();
  } catch (e) {
    return res.status(401).json({ 
      message: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
  }
}

/**
 * Optional affiliate authentication - attaches affiliate if token present
 */
async function tryAffiliateAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  
  if (!token) {
    return next();
  }
  
  try {
    const payload = verify(token);
    
    // Only process affiliate tokens
    if (payload.type !== 'affiliate' && payload.role !== 'AFFILIATE') {
      return next();
    }
    
    const affiliate = await db('affiliates')
      .where({ id: payload.sub })
      .whereNull('deleted_at')
      .first();
    
    if (affiliate && 
        affiliate.is_active_account !== false && 
        affiliate.is_active_account !== 0 &&
        (!payload.tv || !affiliate.token_version || payload.tv === affiliate.token_version)) {
      req.affiliate = {
        id: affiliate.id,
        email: affiliate.email,
        name: affiliate.name,
        referral_code: affiliate.referral_code,
        role: 'AFFILIATE',
        type: 'affiliate'
      };
    }
  } catch (e) {
    // Ignore errors for optional auth
  }
  
  next();
}

/**
 * Require affiliate to own resource or be admin
 */
function requireAffiliateSelfOrAdmin(req, res, next) {
  if (!req.affiliate) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  const requestedId = req.params.affiliate_id || req.params.id;
  
  if (req.affiliate.role === 'ADMIN' || req.affiliate.id === parseInt(requestedId)) {
    return next();
  }
  
  return res.status(403).json({ message: 'Forbidden' });
}

module.exports = {
  requireAffiliateAuth,
  tryAffiliateAuth,
  requireAffiliateSelfOrAdmin
};

