const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const getAllUsers = async (req, res, next) => {
  try {
    const org_id = req.user.org_id;
    const result = await pool.query(
      'SELECT id, name, email, role, phone, is_active, created_at FROM users WHERE org_id = $1 AND is_super_admin = false ORDER BY created_at DESC',
      [org_id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, phone } = req.body;
    const org_id = req.user.org_id;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: { message: 'Name, email, password, and role are required.' } });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: { message: 'Password must be at least 6 characters.' } });
    }

    // Validate role exists within this org
    const roleCheck = await pool.query('SELECT id FROM roles WHERE name = $1 AND org_id = $2', [role, org_id]);
    if (roleCheck.rows.length === 0) {
      return res.status(400).json({ error: { message: 'Invalid role for this organization.' } });
    }

    // Check duplicate email within org
    const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND org_id = $2', [email.toLowerCase().trim(), org_id]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: { message: 'A user with this email already exists in your organization.' } });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, phone, org_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, phone, is_active, created_at`,
      [name.trim(), email.toLowerCase().trim(), password_hash, role, phone || null, org_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, role, phone, password } = req.body;
    const org_id = req.user.org_id;

    if (!name || !email || !role) {
      return res.status(400).json({ error: { message: 'Name, email, and role are required.' } });
    }

    // Check duplicate email within org (excluding current user)
    const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND org_id = $2 AND id != $3', [email.toLowerCase().trim(), org_id, id]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: { message: 'A user with this email already exists in your organization.' } });
    }

    let result;
    if (password && password.length >= 6) {
      const password_hash = await bcrypt.hash(password, 10);
      result = await pool.query(
        `UPDATE users SET name = $1, email = $2, role = $3, phone = $4, password_hash = $5
         WHERE id = $6 AND org_id = $7 AND is_super_admin = false
         RETURNING id, name, email, role, phone, is_active, created_at`,
        [name.trim(), email.toLowerCase().trim(), role, phone || null, password_hash, id, org_id]
      );
    } else {
      result = await pool.query(
        `UPDATE users SET name = $1, email = $2, role = $3, phone = $4
         WHERE id = $5 AND org_id = $6 AND is_super_admin = false
         RETURNING id, name, email, role, phone, is_active, created_at`,
        [name.trim(), email.toLowerCase().trim(), role, phone || null, id, org_id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'User not found.' } });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const org_id = req.user.org_id;

    const result = await pool.query(
      `UPDATE users SET is_active = NOT is_active WHERE id = $1 AND org_id = $2 AND is_super_admin = false
       RETURNING id, name, email, role, phone, is_active, created_at`,
      [id, org_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'User not found.' } });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllUsers, createUser, updateUser, toggleUserStatus };
