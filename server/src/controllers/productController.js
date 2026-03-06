const pool = require('../config/db');

// POST /api/products
const createProduct = async (req, res, next) => {
  try {
    const { product_name, product_code, unit } = req.body;

    if (!product_name || !product_code || !unit) {
      return res.status(400).json({ error: 'product_name, product_code, and unit are required' });
    }

    const result = await pool.query(
      `INSERT INTO products (product_name, product_code, unit)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [product_name.trim(), product_code.trim(), unit.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Product code already exists' });
    }
    next(err);
  }
};

// GET /api/products
const getAllProducts = async (req, res, next) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM products';
    const params = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/products/:id
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// PUT /api/products/:id
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { product_name, unit, status } = req.body;

    const result = await pool.query(
      `UPDATE products
       SET product_name = COALESCE($1, product_name),
           unit = COALESCE($2, unit),
           status = COALESCE($3, status)
       WHERE id = $4
       RETURNING *`,
      [product_name, unit, status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/products/:id (soft delete)
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if product exists
    const product = await pool.query('SELECT id FROM products WHERE id = $1', [id]);
    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check for associated batches
    const batches = await pool.query(
      'SELECT id FROM inventory_batches WHERE product_id = $1 LIMIT 1',
      [id]
    );
    if (batches.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete product with associated batches' });
    }

    // Soft delete
    const result = await pool.query(
      `UPDATE products SET status = 'inactive' WHERE id = $1 RETURNING *`,
      [id]
    );

    res.json({ message: 'Product deleted', product: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};
