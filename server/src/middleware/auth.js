const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'gree-inventory-secret-key-2026';

// Verify JWT token
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'Access denied. No token provided.' } });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: { message: 'Invalid or expired token.' } });
  }
};

// Check role(s) — legacy, use requireCapability for dynamic roles
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { message: 'Not authenticated.' } });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: { message: 'Access denied. Insufficient permissions.' } });
    }
    next();
  };
};

// Check capability — supports dynamic roles
// Admin role always has full access
const requireCapability = (...requiredCaps) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { message: 'Not authenticated.' } });
    }
    if (req.user.role === 'admin') return next();
    const userCaps = req.user.capabilities || [];
    if (requiredCaps.some((cap) => userCaps.includes(cap))) return next();
    return res.status(403).json({ error: { message: 'Access denied. Insufficient permissions.' } });
  };
};

module.exports = { authenticate, requireRole, requireCapability, JWT_SECRET };
