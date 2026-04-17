const pool = require('../config/db');

// POST /api/products
const createProduct = async (req, res, next) => {
  try {
    const { product_name, product_code, unit, sub_unit, category, batch_tracking, qty_per_box, low_stock_threshold } = req.body;
    const image_url = req.file ? `/uploads/products/${req.file.filename}` : null;

    if (!product_name || !unit) {
      return res.status(400).json({ error: 'product_name and unit are required' });
    }

    const code = product_code?.trim() || product_name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/-+$/, '');

    const result = await pool.query(
      `INSERT INTO products (product_name, product_code, unit, sub_unit, category, batch_tracking, qty_per_box, image_url, low_stock_threshold)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [product_name.trim(), code, unit.trim(), sub_unit?.trim() || null, category?.trim() || null, batch_tracking || false, sub_unit && qty_per_box ? Number(qty_per_box) : null, image_url, low_stock_threshold != null ? Number(low_stock_threshold) : 50]
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
    const { status, category, search, page, limit } = req.query;
    const base = `FROM products p
                 LEFT JOIN (
                   SELECT product_id, SUM(quantity_remaining) as available_stock
                   FROM inventory_batches WHERE quantity_remaining > 0
                   GROUP BY product_id
                 ) s ON p.id = s.product_id`;
    const params = [];
    const conditions = [];

    if (status) { params.push(status); conditions.push(`p.status = $${params.length}`); }
    if (category) { params.push(category); conditions.push(`p.category = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`p.product_name ILIKE $${params.length}`); }

    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';

    // No page param = return all (for dropdowns/other pages)
    if (!page) {
      const result = await pool.query(
        `SELECT p.*, COALESCE(s.available_stock, 0)::int as available_stock ${base}${where} ORDER BY p.created_at DESC`,
        params
      );
      return res.json(result.rows);
    }

    const pg = Math.max(1, parseInt(page) || 1);
    const lim = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pg - 1) * lim;

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT p.*, COALESCE(s.available_stock, 0)::int as available_stock ${base}${where} ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, lim, offset]),
      pool.query(`SELECT COUNT(*)::int as total FROM products p${where}`, params),
    ]);

    res.json({ data: dataRes.rows, total: countRes.rows[0].total });
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
    const { product_name, unit, sub_unit, status, category, batch_tracking, qty_per_box, low_stock_threshold } = req.body;
    const image_url = req.file ? `/uploads/products/${req.file.filename}` : null;

    const result = await pool.query(
      `UPDATE products
       SET product_name = COALESCE($1, product_name),
           unit = COALESCE($2, unit),
           sub_unit = $3,
           status = COALESCE($4, status),
           category = COALESCE($5, category),
           batch_tracking = $6,
           qty_per_box = $7,
           image_url = COALESCE($8, image_url),
           low_stock_threshold = COALESCE($9, low_stock_threshold)
       WHERE id = $10
       RETURNING *`,
      [product_name, unit, sub_unit?.trim() || null, status, category, batch_tracking !== undefined ? batch_tracking : false, sub_unit && qty_per_box ? Number(qty_per_box) : null, image_url, low_stock_threshold != null ? Number(low_stock_threshold) : null, id]
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
