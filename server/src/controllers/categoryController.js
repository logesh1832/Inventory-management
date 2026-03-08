const pool = require('../config/db');

// GET /api/categories
const getAllCategories = async (req, res, next) => {
  try {
    const { active } = req.query;
    let query = 'SELECT * FROM categories';
    const params = [];

    if (active === 'true') {
      query += ' WHERE is_active = true';
    }

    query += ' ORDER BY category_name ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/categories/:id
const getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// POST /api/categories
const createCategory = async (req, res, next) => {
  try {
    const { category_name, description } = req.body;

    if (!category_name || !category_name.trim()) {
      return res.status(400).json({ error: 'category_name is required' });
    }

    const result = await pool.query(
      `INSERT INTO categories (category_name, description)
       VALUES ($1, $2)
       RETURNING *`,
      [category_name.trim(), description?.trim() || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Category name already exists' });
    }
    next(err);
  }
};

// PUT /api/categories/:id
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category_name, description, is_active } = req.body;

    const result = await pool.query(
      `UPDATE categories
       SET category_name = COALESCE($1, category_name),
           description = COALESCE($2, description),
           is_active = COALESCE($3, is_active)
       WHERE id = $4
       RETURNING *`,
      [category_name?.trim() || null, description?.trim() || null, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Category name already exists' });
    }
    next(err);
  }
};

// DELETE /api/categories/:id (soft delete)
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
    if (category.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check if any products use this category
    const products = await pool.query(
      'SELECT id FROM products WHERE category = $1 LIMIT 1',
      [category.rows[0].category_name]
    );
    if (products.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete category with associated products' });
    }

    const result = await pool.query(
      'UPDATE categories SET is_active = false WHERE id = $1 RETURNING *',
      [id]
    );

    res.json({ message: 'Category deleted', category: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
