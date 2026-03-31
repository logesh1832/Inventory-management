const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: { message: 'Email and password are required.' } });
    }

    const result = await pool.query(
      'SELECT id, name, email, password_hash, role, phone, is_active, is_super_admin, org_id FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: { message: 'Invalid email or password.' } });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: { message: 'Account is deactivated. Contact admin.' } });
    }

    // Block salesperson login (non-super-admin users with salesperson role)
    if (!user.is_super_admin && user.role === 'salesperson') {
      return res.status(403).json({ error: { message: 'Salesperson accounts are not permitted to login. Contact admin.' } });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: { message: 'Invalid email or password.' } });
    }

    let org = null;
    let capabilities = [];

    if (user.is_super_admin) {
      // Super admin — no org, full capabilities
      capabilities = ['super_admin'];
    } else {
      // Check org is active
      if (user.org_id) {
        const orgResult = await pool.query(
          'SELECT id, org_code, org_name, is_active FROM organizations WHERE id = $1',
          [user.org_id]
        );
        if (orgResult.rows.length === 0 || !orgResult.rows[0].is_active) {
          return res.status(403).json({ error: { message: 'Your organization is inactive. Contact support.' } });
        }
        org = orgResult.rows[0];
      }

      // Fetch role capabilities scoped to org
      const roleResult = await pool.query(
        'SELECT capabilities FROM roles WHERE name = $1 AND org_id = $2',
        [user.role, user.org_id]
      );
      capabilities = roleResult.rows.length > 0 ? roleResult.rows[0].capabilities : [];
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      is_super_admin: user.is_super_admin,
      org_id: user.org_id || null,
      org_code: org?.org_code || null,
      org_name: org?.org_name || null,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        is_super_admin: user.is_super_admin,
        org_id: user.org_id || null,
        org_code: org?.org_code || null,
        org_name: org?.org_name || null,
        capabilities,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/logout
const logout = async (req, res, next) => {
  try {
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, phone, is_active, is_super_admin, org_id, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'User not found.' } });
    }

    const user = result.rows[0];
    let org = null;
    let capabilities = [];

    if (user.is_super_admin) {
      capabilities = ['super_admin'];
    } else {
      if (user.org_id) {
        const orgResult = await pool.query(
          'SELECT id, org_code, org_name FROM organizations WHERE id = $1',
          [user.org_id]
        );
        if (orgResult.rows.length > 0) org = orgResult.rows[0];
      }

      const roleResult = await pool.query(
        'SELECT capabilities FROM roles WHERE name = $1 AND org_id = $2',
        [user.role, user.org_id]
      );
      capabilities = roleResult.rows.length > 0 ? roleResult.rows[0].capabilities : [];
    }

    res.json({
      ...user,
      org_code: org?.org_code || null,
      org_name: org?.org_name || null,
      capabilities,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, logout, getMe };
