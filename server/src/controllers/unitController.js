const pool = require('../config/db');

// GET /api/units
const getAllUnits = async (req, res, next) => {
  try {
    const org_id = req.user.org_id;
    const result = await pool.query('SELECT * FROM units WHERE org_id = $1 ORDER BY name ASC', [org_id]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// POST /api/units
const createUnit = async (req, res, next) => {
  try {
    const { name } = req.body;
    const org_id = req.user.org_id;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Unit name is required' });
    }
    const result = await pool.query(
      `INSERT INTO units (name, org_id) VALUES ($1, $2) RETURNING *`,
      [name.trim(), org_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Unit name already exists' });
    }
    next(err);
  }
};

// PUT /api/units/:id
const updateUnit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const org_id = req.user.org_id;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Unit name is required' });
    }
    const result = await pool.query(
      `UPDATE units SET name = $1 WHERE id = $2 AND org_id = $3 RETURNING *`,
      [name.trim(), id, org_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Unit name already exists' });
    }
    next(err);
  }
};

// DELETE /api/units/:id
const deleteUnit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const org_id = req.user.org_id;
    const unit = await pool.query('SELECT * FROM units WHERE id = $1 AND org_id = $2', [id, org_id]);
    if (unit.rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    const products = await pool.query(
      'SELECT id FROM products WHERE (unit = $1 OR sub_unit = $1) AND org_id = $2 LIMIT 1',
      [unit.rows[0].name, org_id]
    );
    if (products.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete unit used by products' });
    }
    await pool.query('DELETE FROM units WHERE id = $1 AND org_id = $2', [id, org_id]);
    res.json({ message: 'Unit deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllUnits, createUnit, updateUnit, deleteUnit };
