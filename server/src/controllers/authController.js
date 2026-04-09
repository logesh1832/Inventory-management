const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');
const { sendMail } = require('../lib/mailer');

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: { message: 'Email and password are required.' } });
    }

    const result = await pool.query(
      'SELECT id, name, email, password_hash, role, phone, is_active FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: { message: 'Invalid email or password.' } });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: { message: 'Account is deactivated. Contact admin.' } });
    }

    // Block salesperson login
    if (user.role === 'salesperson') {
      return res.status(403).json({ error: { message: 'Salesperson accounts are not permitted to login. Contact admin.' } });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: { message: 'Invalid email or password.' } });
    }

    // Fetch role capabilities
    const roleResult = await pool.query(
      'SELECT capabilities FROM roles WHERE name = $1',
      [user.role]
    );
    const capabilities = roleResult.rows.length > 0 ? roleResult.rows[0].capabilities : [];

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name, capabilities },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
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
      'SELECT id, name, email, role, phone, is_active, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'User not found.' } });
    }

    const user = result.rows[0];

    // Fetch role capabilities
    const roleResult = await pool.query(
      'SELECT capabilities FROM roles WHERE name = $1',
      [user.role]
    );
    user.capabilities = roleResult.rows.length > 0 ? roleResult.rows[0].capabilities : [];

    res.json(user);
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: { message: 'Email is required.' } });

    const result = await pool.query('SELECT id, name, email FROM users WHERE email = $1 AND is_active = true', [email.toLowerCase().trim()]);
    // Always return success to avoid email enumeration
    if (result.rows.length === 0) return res.json({ message: 'If that email exists, a reset link has been sent.' });

    const user = result.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query('UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3', [token, expires, user.id]);

    const origin = req.headers.origin || 'http://localhost:5173';
    const resetLink = `${origin}/reset-password?token=${token}`;

    await sendMail({
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:8px;">
          <h2 style="color:#1f2937;">Password Reset</h2>
          <p>Hi <strong>${user.name}</strong>,</p>
          <p>We received a request to reset your password. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
          <a href="${resetLink}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#f59e0b;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Reset Password</a>
          <p style="color:#6b7280;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: { message: 'Token and password are required.' } });
    if (password.length < 6) return res.status(400).json({ error: { message: 'Password must be at least 6 characters.' } });

    const result = await pool.query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: { message: 'Reset link is invalid or has expired.' } });

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [hash, result.rows[0].id]
    );

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, logout, getMe, forgotPassword, resetPassword };
