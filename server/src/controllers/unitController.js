const pool = require('../config/db');

// GET /api/units
const getAllUnits = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM units ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// POST /api/units
const createUnit = async (req, res, next) => {
  try {
    const { name, has_sub_unit, sub_unit_name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Unit name is required' });
    }

    const result = await pool.query(
      `INSERT INTO units (name, has_sub_unit, sub_unit_name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name.trim(), has_sub_unit || false, sub_unit_name?.trim() || null]
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
    const { name, has_sub_unit, sub_unit_name } = req.body;

    const result = await pool.query(
      `UPDATE units
       SET name = COALESCE($1, name),
           has_sub_unit = COALESCE($2, has_sub_unit),
           sub_unit_name = COALESCE($3, sub_unit_name)
       WHERE id = $4
       RETURNING *`,
      [name?.trim() || null, has_sub_unit, sub_unit_name?.trim() || null, id]
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

    const unit = await pool.query('SELECT * FROM units WHERE id = $1', [id]);
    if (unit.rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    // Check if any products use this unit name
    const products = await pool.query(
      'SELECT id FROM products WHERE unit = $1 LIMIT 1',
      [unit.rows[0].name]
    );
    if (products.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete unit with associated products' });
    }

    await pool.query('DELETE FROM units WHERE id = $1', [id]);

    res.json({ message: 'Unit deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllUnits,
  createUnit,
  updateUnit,
  deleteUnit,
};
