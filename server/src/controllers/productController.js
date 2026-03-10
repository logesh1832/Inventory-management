const pool = require('../config/db');

// POST /api/products
const createProduct = async (req, res, next) => {
  try {
    const { product_name, product_code, unit, unit_price, category, batch_tracking, qty_per_box } = req.body;

    if (!product_name || !product_code || !unit) {
      return res.status(400).json({ error: 'product_name, product_code, and unit are required' });
    }

    const result = await pool.query(
      `INSERT INTO products (product_name, product_code, unit, unit_price, category, batch_tracking, qty_per_box)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [product_name.trim(), product_code.trim(), unit.trim(), unit_price || 0, category?.trim() || null, batch_tracking || false, unit === 'Boxes' && qty_per_box ? Number(qty_per_box) : null]
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
    const { status, category } = req.query;
    let query = `SELECT p.*, COALESCE(s.available_stock, 0)::int as available_stock
                 FROM products p
                 LEFT JOIN (
                   SELECT product_id, SUM(quantity_remaining) as available_stock
                   FROM inventory_batches WHERE quantity_remaining > 0
                   GROUP BY product_id
                 ) s ON p.id = s.product_id`;
    const params = [];
    const conditions = [];

    if (status) {
      params.push(status);
      conditions.push(`p.status = $${params.length}`);
    }

    if (category) {
      params.push(category);
      conditions.push(`p.category = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY p.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/products/categories
const getCategories = async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category"
    );
    res.json(result.rows.map(r => r.category));
  } catch (err) {
    next(err);
  }
};

// GET /api/products/:id
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT p.*, COALESCE(s.available_stock, 0)::int as available_stock
       FROM products p
       LEFT JOIN (
         SELECT product_id, SUM(quantity_remaining) as available_stock
         FROM inventory_batches WHERE quantity_remaining > 0
         GROUP BY product_id
       ) s ON p.id = s.product_id
       WHERE p.id = $1`,
      [id]
    );

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
    const { product_name, unit, status, unit_price, category, batch_tracking, qty_per_box } = req.body;

    const result = await pool.query(
      `UPDATE products
       SET product_name = COALESCE($1, product_name),
           unit = COALESCE($2, unit),
           status = COALESCE($3, status),
           unit_price = COALESCE($4, unit_price),
           category = COALESCE($5, category),
           batch_tracking = $6,
           qty_per_box = $7
       WHERE id = $8
       RETURNING *`,
      [product_name, unit, status, unit_price, category, batch_tracking !== undefined ? batch_tracking : false, unit === 'Boxes' && qty_per_box ? Number(qty_per_box) : null, id]
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

    const product = await pool.query('SELECT id FROM products WHERE id = $1', [id]);
    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const batches = await pool.query(
      'SELECT id FROM inventory_batches WHERE product_id = $1 LIMIT 1',
      [id]
    );
    if (batches.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete product with associated batches' });
    }

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
  getCategories,
  getProductById,
  updateProduct,
  deleteProduct,
};
