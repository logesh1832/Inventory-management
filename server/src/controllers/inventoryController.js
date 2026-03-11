const pool = require('../config/db');

const getStockMovements = async (req, res, next) => {
  try {
    const { product_id, movement_type, from_date, to_date, search, page = 1, limit = 20 } = req.query;

    const baseFrom = `
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

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      const idx = params.length;
      conditions.push(`(p.product_name ILIKE $${idx} OR ib.batch_number ILIKE $${idx} OR o.invoice_number ILIKE $${idx} OR sm.movement_type ILIKE $${idx})`);
    }

    // Default to today if no date filters provided
    const effectiveFromDate = from_date || to_date ? from_date : new Date().toISOString().split('T')[0];
    const effectiveToDate = from_date || to_date ? to_date : new Date().toISOString().split('T')[0];

    if (effectiveFromDate) {
      params.push(effectiveFromDate);
      conditions.push(`sm.created_at >= $${params.length}::date`);
    }

    if (effectiveToDate) {
      params.push(effectiveToDate);
      conditions.push(`sm.created_at < ($${params.length}::date + interval '1 day')`);
    }

    const whereClause = conditions.length > 0 ? ` WHERE ` + conditions.join(' AND ') : '';

    // Get total count
    const countResult = await pool.query(`SELECT COUNT(*) ${baseFrom}${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated data
    const offset = (Number(page) - 1) * Number(limit);
    params.push(Number(limit));
    params.push(offset);
    const selectFields = `sm.*, p.product_name, ib.batch_number, CASE WHEN sm.reference_type = 'ORDER' THEN o.invoice_number ELSE NULL END AS invoice_number`;
    const dataQuery = `SELECT ${selectFields} ${baseFrom}${whereClause} ORDER BY sm.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(dataQuery, params);
    res.json({ data: result.rows, total, page: Number(page), limit: Number(limit) });
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

const getMovementsBySupplier = async (req, res, next) => {
  try {
    const { supplier_id, from_date, to_date, page = 1, limit = 20 } = req.query;

    const baseFrom = `
      FROM stock_movements sm
      LEFT JOIN customers c ON c.id = sm.supplier_id
      WHERE sm.movement_type = 'IN'
    `;
    const conditions = [];
    const params = [];

    if (supplier_id) {
      params.push(supplier_id);
      conditions.push(`sm.supplier_id = $${params.length}`);
    }

    if (from_date) {
      params.push(from_date);
      conditions.push(`sm.received_date >= $${params.length}::date`);
    }

    if (to_date) {
      params.push(to_date);
      conditions.push(`sm.received_date <= $${params.length}::date`);
    }

    const whereClause = conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '';

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM (SELECT supplier_id, received_date ${baseFrom}${whereClause} GROUP BY supplier_id, received_date) sub`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated data
    const offset = (Number(page) - 1) * Number(limit);
    params.push(Number(limit));
    params.push(offset);

    const dataQuery = `
      SELECT
        sm.supplier_id,
        TO_CHAR(sm.received_date, 'YYYY-MM-DD') AS received_date,
        c.customer_name AS supplier_name,
        COUNT(*) AS item_count,
        SUM(sm.quantity) AS total_quantity
      ${baseFrom}${whereClause}
      GROUP BY sm.supplier_id, sm.received_date, c.customer_name
      ORDER BY sm.received_date DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await pool.query(dataQuery, params);
    res.json({ data: result.rows, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
};

const getMovementsByCustomer = async (req, res, next) => {
  try {
    const { customer_id, from_date, to_date, page = 1, limit = 20 } = req.query;

    const baseFrom = `
      FROM stock_movements sm
      JOIN orders o ON sm.reference_id = o.id AND sm.reference_type = 'ORDER'
      JOIN customers c ON c.id = o.customer_id
      WHERE sm.movement_type = 'OUT'
    `;
    const conditions = [];
    const params = [];

    if (customer_id) {
      params.push(customer_id);
      conditions.push(`o.customer_id = $${params.length}`);
    }

    if (from_date) {
      params.push(from_date);
      conditions.push(`o.order_date >= $${params.length}::date`);
    }

    if (to_date) {
      params.push(to_date);
      conditions.push(`o.order_date <= $${params.length}::date`);
    }

    const whereClause = conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '';

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM (SELECT o.id ${baseFrom}${whereClause} GROUP BY o.id) sub`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated data
    const offset = (Number(page) - 1) * Number(limit);
    params.push(Number(limit));
    params.push(offset);

    const dataQuery = `
      SELECT
        o.id AS order_id,
        o.invoice_number,
        TO_CHAR(o.order_date, 'YYYY-MM-DD') AS order_date,
        c.customer_name,
        COUNT(DISTINCT sm.product_id) AS item_count,
        SUM(sm.quantity) AS total_quantity
      ${baseFrom}${whereClause}
      GROUP BY o.id, o.invoice_number, o.order_date, c.customer_name
      ORDER BY o.order_date DESC, o.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await pool.query(dataQuery, params);
    res.json({ data: result.rows, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
};

const getProductMovements = async (req, res, next) => {
  try {
    const { product_id } = req.params;
    const { from_date, to_date, movement_type, page = 1, limit = 20 } = req.query;

    const baseFrom = `
      FROM stock_movements sm
      JOIN products p ON p.id = sm.product_id
      LEFT JOIN inventory_batches ib ON ib.id = sm.batch_id
      LEFT JOIN customers c_supplier ON c_supplier.id = sm.supplier_id
      LEFT JOIN orders o ON sm.reference_type = 'ORDER' AND o.id = sm.reference_id
      LEFT JOIN customers c_order ON c_order.id = o.customer_id
      WHERE sm.product_id = $1
    `;
    const conditions = [];
    const params = [product_id];

    if (from_date) {
      params.push(from_date);
      conditions.push(`sm.created_at >= $${params.length}::date`);
    }

    if (to_date) {
      params.push(to_date);
      conditions.push(`sm.created_at < ($${params.length}::date + interval '1 day')`);
    }

    if (movement_type) {
      params.push(movement_type);
      conditions.push(`sm.movement_type = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '';

    // Get total count + aggregated totals
    const countResult = await pool.query(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(CASE WHEN sm.movement_type = 'IN' THEN sm.quantity ELSE 0 END), 0)::int AS total_in,
              COALESCE(SUM(CASE WHEN sm.movement_type = 'OUT' THEN sm.quantity ELSE 0 END), 0)::int AS total_out
       ${baseFrom}${whereClause}`,
      params
    );
    const { count, total_in, total_out } = countResult.rows[0];
    const total = parseInt(count, 10);

    // Get paginated data
    const offset = (Number(page) - 1) * Number(limit);
    params.push(Number(limit));
    params.push(offset);

    const dataQuery = `
      SELECT
        sm.*,
        p.product_name,
        p.product_code,
        ib.batch_number,
        c_supplier.customer_name AS supplier_name,
        o.invoice_number,
        c_order.customer_name AS customer_name
      ${baseFrom}${whereClause}
      ORDER BY sm.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await pool.query(dataQuery, params);
    res.json({ data: result.rows, total, total_in, total_out, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
};

module.exports = { getStockMovements, getLiveStock, getLiveStockByProduct, getStockReport, getDashboardStats, getMovementsBySupplier, getMovementsByCustomer, getProductMovements };
