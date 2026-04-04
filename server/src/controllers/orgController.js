const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const DEFAULT_ADMIN_CAPABILITIES = [
  'dashboard', 'products', 'categories', 'customers',
  'material_in', 'movements', 'material_out', 'reports',
  'user_management', 'role_management', 'unit_management', 'customization',
];
const DEFAULT_INVENTORY_CAPABILITIES = [
  'dashboard', 'products', 'categories', 'material_in', 'movements', 'material_out', 'reports',
];
const DEFAULT_UNITS = ['Box', 'PCS', 'KG', 'MTR', 'LTR'];

// POST /api/orgs — create org + default roles + units + admin user
const createOrg = async (req, res, next) => {
  const { org_name, org_code, org_email, org_phone, address, admin_name, admin_password } = req.body;

  if (!org_name || !org_code || !org_email || !admin_name || !admin_password) {
    return res.status(400).json({
      error: 'org_name, org_code, org_email, admin_name, and admin_password are required',
    });
  }

  if (admin_password.length < 6) {
    return res.status(400).json({ error: 'Admin password must be at least 6 characters.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create org
    const orgResult = await client.query(
      `INSERT INTO organizations (org_code, org_name, org_email, org_phone, address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [org_code.trim().toUpperCase(), org_name.trim(), org_email.trim().toLowerCase(), org_phone || null, address || null]
    );
    const org = orgResult.rows[0];

    // Create default roles
    await client.query(
      `INSERT INTO roles (name, capabilities, is_system, org_id)
       VALUES ($1, $2, true, $3)`,
      ['admin', DEFAULT_ADMIN_CAPABILITIES, org.id]
    );
    await client.query(
      `INSERT INTO roles (name, capabilities, is_system, org_id)
       VALUES ($1, $2, true, $3)`,
      ['inventory', DEFAULT_INVENTORY_CAPABILITIES, org.id]
    );

    // Create default units
    for (const unitName of DEFAULT_UNITS) {
      await client.query(
        `INSERT INTO units (name, org_id) VALUES ($1, $2)`,
        [unitName, org.id]
      );
    }

    // Create first admin user
    const password_hash = await bcrypt.hash(admin_password, 10);
    const userResult = await client.query(
      `INSERT INTO users (name, email, password_hash, role, is_active, is_super_admin, org_id)
       VALUES ($1, $2, $3, 'admin', true, false, $4)
       RETURNING id, name, email, role, is_active, org_id`,
      [admin_name.trim(), org_email.trim().toLowerCase(), password_hash, org.id]
    );
    const adminUser = userResult.rows[0];

    await client.query('COMMIT');

    res.status(201).json({
      org: { id: org.id, org_code: org.org_code, org_name: org.org_name, org_email: org.org_email },
      admin_user: { email: adminUser.email, name: adminUser.name },
      message: 'Organization created successfully',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Organization code or email already exists.' });
    }
    next(err);
  } finally {
    client.release();
  }
};

// GET /api/orgs
const getAllOrgs = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT o.*,
             COUNT(u.id)::int AS user_count
      FROM organizations o
      LEFT JOIN users u ON u.org_id = o.id AND u.is_super_admin = false
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/orgs/:id
const getOrgById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT o.*, COUNT(u.id)::int AS user_count
       FROM organizations o
       LEFT JOIN users u ON u.org_id = o.id AND u.is_super_admin = false
       WHERE o.id = $1
       GROUP BY o.id`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// PUT /api/orgs/:id
const updateOrg = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { org_name, org_email, org_phone, address, is_active } = req.body;

    const result = await pool.query(
      `UPDATE organizations
       SET org_name = COALESCE($1, org_name),
           org_email = COALESCE($2, org_email),
           org_phone = COALESCE($3, org_phone),
           address = COALESCE($4, address),
           is_active = COALESCE($5, is_active),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [org_name || null, org_email || null, org_phone || null, address || null, is_active !== undefined ? is_active : null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// GET /api/orgs/:id/users
const getOrgUsers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, name, email, role, phone, is_active, created_at
       FROM users
       WHERE org_id = $1 AND is_super_admin = false
       ORDER BY created_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

module.exports = { createOrg, getAllOrgs, getOrgById, updateOrg, getOrgUsers };
