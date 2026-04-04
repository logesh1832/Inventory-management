const pool = require('../config/db');

// GET /api/roles
const getAllRoles = async (req, res, next) => {
  try {
    const org_id = req.user.org_id;
    const result = await pool.query('SELECT * FROM roles WHERE org_id = $1 ORDER BY name', [org_id]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// POST /api/roles
const createRole = async (req, res, next) => {
  try {
    const { name, capabilities } = req.body;
    const org_id = req.user.org_id;

    if (!name || !Array.isArray(capabilities)) {
      return res.status(400).json({ error: { message: 'Name and capabilities array are required.' } });
    }

    const result = await pool.query(
      'INSERT INTO roles (name, capabilities, org_id) VALUES ($1, $2, $3) RETURNING *',
      [name.trim().toLowerCase(), capabilities, org_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: { message: 'A role with this name already exists.' } });
    }
    next(err);
  }
};

// PUT /api/roles/:id
const updateRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, capabilities } = req.body;
    const org_id = req.user.org_id;

    const existing = await pool.query('SELECT * FROM roles WHERE id = $1 AND org_id = $2', [id, org_id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Role not found.' } });
    }

    const role = existing.rows[0];

    if (role.is_system && name && name.trim().toLowerCase() !== role.name) {
      return res.status(403).json({ error: { message: 'Cannot rename system roles.' } });
    }

    const newName = role.is_system ? role.name : (name ? name.trim().toLowerCase() : role.name);
    const newCapabilities = Array.isArray(capabilities) ? capabilities : role.capabilities;

    const result = await pool.query(
      'UPDATE roles SET name = $1, capabilities = $2 WHERE id = $3 AND org_id = $4 RETURNING *',
      [newName, newCapabilities, id, org_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: { message: 'A role with this name already exists.' } });
    }
    next(err);
  }
};

// DELETE /api/roles/:id
const deleteRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const org_id = req.user.org_id;

    const existing = await pool.query('SELECT * FROM roles WHERE id = $1 AND org_id = $2', [id, org_id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Role not found.' } });
    }

    const role = existing.rows[0];

    if (role.is_system) {
      return res.status(403).json({ error: { message: 'Cannot delete system roles.' } });
    }

    const usersWithRole = await pool.query('SELECT COUNT(*) FROM users WHERE role = $1 AND org_id = $2', [role.name, org_id]);
    if (parseInt(usersWithRole.rows[0].count) > 0) {
      return res.status(409).json({ error: { message: 'Cannot delete role. Users are still assigned to it.' } });
    }

    await pool.query('DELETE FROM roles WHERE id = $1 AND org_id = $2', [id, org_id]);
    res.json({ message: 'Role deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllRoles, createRole, updateRole, deleteRole };
