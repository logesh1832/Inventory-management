const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'gree-inventory-secret-key-2026';

// Verify JWT token and attach req.user with org info
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'Access denied. No token provided.' } });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    // If org user, check org is still active
    if (!decoded.is_super_admin && decoded.org_id) {
      const orgCheck = await pool.query('SELECT is_active FROM organizations WHERE id = $1', [decoded.org_id]);
      if (orgCheck.rows.length === 0 || !orgCheck.rows[0].is_active) {
        return res.status(403).json({ error: { message: 'Your organization is inactive. Contact support.' } });
      }
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: { message: 'Invalid or expired token.' } });
  }
};

// Check role(s) — super admin bypasses role checks
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { message: 'Not authenticated.' } });
    }
    if (req.user.is_super_admin) return next();
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: { message: 'Access denied. Insufficient permissions.' } });
    }
    next();
  };
};

// Super admin only middleware
const requireSuperAdmin = (req, res, next) => {
  if (!req.user || !req.user.is_super_admin) {
    return res.status(403).json({ error: { message: 'Access denied. Super admin only.' } });
  }
  next();
};

module.exports = { authenticate, requireRole, requireSuperAdmin, JWT_SECRET };
