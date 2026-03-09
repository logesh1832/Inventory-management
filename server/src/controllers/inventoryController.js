const pool = require('../config/db');

const getStockMovements = async (req, res, next) => {
  try {
    const { product_id, movement_type, from_date, to_date } = req.query;

    let query = `
      SELECT sm.*, p.product_name, ib.batch_number,
        CASE WHEN sm.reference_type = 'ORDER' THEN o.invoice_number ELSE NULL END AS invoice_number
      FROM stock_movements sm
      JOIN products p ON p.id = sm.product_id
      LEFT JOIN inventory_batches ib ON ib.id = sm.batch_id
      LEFT JOIN orders o ON sm.reference_type = 'ORDER' AND o.id = sm.reference_id
    `;
    const conditions = [];
    const params = [];

    if (product_id) {
      params.push(product_id);
      conditions.push(`sm.product_id = $${params.length}`);
    }

    if (movement_type) {
      params.push(movement_type);
      conditions.push(`sm.movement_type = $${params.length}`);
    }

    if (from_date) {
      params.push(from_date);
      conditions.push(`sm.created_at >= $${params.length}`);
    }

    if (to_date) {
      params.push(to_date);
      conditions.push(`sm.created_at < ($${params.length}::date + interval '1 day')`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY sm.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const getLiveStock = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        p.id AS product_id,
        p.product_name,
        p.product_code,
        p.unit,
        COALESCE(SUM(ib.quantity_remaining), 0)::int AS total_stock
      FROM products p
      LEFT JOIN inventory_batches ib ON ib.product_id = p.id
      WHERE p.status = 'active'
      GROUP BY p.id, p.product_name, p.product_code, p.unit
      ORDER BY p.product_name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const getLiveStockByProduct = async (req, res, next) => {
  try {
    const { product_id } = req.params;

    const productResult = await pool.query(
      'SELECT product_name, product_code, unit FROM products WHERE id = $1',
      [product_id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const batchesResult = await pool.query(
      `SELECT
        id AS batch_id,
        batch_number,
        quantity_received AS quantity_added,
        quantity_remaining,
        received_date
      FROM inventory_batches
      WHERE product_id = $1
      ORDER BY received_date ASC, created_at ASC`,
      [product_id]
    );

    const totalStock = batchesResult.rows.reduce((sum, b) => sum + b.quantity_remaining, 0);

    res.json({
      product: productResult.rows[0],
      total_stock: totalStock,
      batches: batchesResult.rows,
    });
  } catch (err) {
    next(err);
  }
};

const getStockReport = async (req, res, next) => {
  try {
    const { product_id, low_stock_threshold } = req.query;

    let query = `
      SELECT
        p.id AS product_id,
        p.product_name,
        p.product_code,
        p.unit,
        COALESCE(SUM(ib.quantity_remaining), 0)::int AS total_stock
      FROM products p
      LEFT JOIN inventory_batches ib ON ib.product_id = p.id
      WHERE p.status = 'active'
    `;
    const params = [];

    if (product_id) {
      params.push(product_id);
      query += ` AND p.id = $${params.length}`;
    }

    query += ` GROUP BY p.id, p.product_name, p.product_code, p.unit`;

    if (low_stock_threshold) {
      params.push(Number(low_stock_threshold));
      query += ` HAVING COALESCE(SUM(ib.quantity_remaining), 0) < $${params.length}`;
    }

    query += ` ORDER BY p.product_name ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const getDashboardStats = async (req, res, next) => {
  try {
    const [productsRes, stockRes, customersRes, ordersRes, movementsRes, recentOrdersRes] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM products WHERE status = 'active'"),
      pool.query('SELECT COALESCE(SUM(quantity_remaining), 0)::int AS total FROM inventory_batches'),
      pool.query('SELECT COUNT(*)::int AS count FROM customers'),
      pool.query('SELECT COUNT(*)::int AS count FROM orders'),
      pool.query(`
        SELECT sm.*, p.product_name, ib.batch_number
        FROM stock_movements sm
        JOIN products p ON p.id = sm.product_id
        LEFT JOIN inventory_batches ib ON ib.id = sm.batch_id
        ORDER BY sm.created_at DESC
        LIMIT 5
      `),
      pool.query(`
        SELECT o.*, c.customer_name
        FROM orders o
        JOIN customers c ON c.id = o.customer_id
        ORDER BY o.created_at DESC
        LIMIT 5
      `),
    ]);

    res.json({
      total_products: productsRes.rows[0].count,
      total_stock: stockRes.rows[0].total,
      total_customers: customersRes.rows[0].count,
      total_orders: ordersRes.rows[0].count,
      recent_movements: movementsRes.rows,
      recent_orders: recentOrdersRes.rows,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getStockMovements, getLiveStock, getLiveStockByProduct, getStockReport, getDashboardStats };
