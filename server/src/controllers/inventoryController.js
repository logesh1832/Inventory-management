const pool = require('../config/db');

const getStockMovements = async (req, res, next) => {
  try {
    const { product_id, movement_type, from_date, to_date, search, page = 1, limit = 30 } = req.query;
    const org_id = req.user.org_id;

    const baseFrom = `
      FROM stock_movements sm
      JOIN products p ON p.id = sm.product_id
      LEFT JOIN inventory_batches ib ON ib.id = sm.batch_id
      LEFT JOIN customers c_supplier ON c_supplier.id = sm.supplier_id
      LEFT JOIN orders o ON sm.reference_type = 'ORDER' AND o.id = sm.reference_id
      LEFT JOIN customers c_order ON c_order.id = o.customer_id
    `;
    // Filter out legacy IN movements without supplier + scope to org
    const conditions = [
      "NOT (sm.movement_type = 'IN' AND sm.supplier_id IS NULL)",
      `sm.org_id = $1`,
    ];
    const params = [org_id];

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
      conditions.push(`(p.product_name ILIKE $${idx} OR p.product_code ILIKE $${idx} OR ib.batch_number ILIKE $${idx})`);
    }

    if (from_date) {
      params.push(from_date);
      conditions.push(`sm.created_at >= $${params.length}::date`);
    }

    if (to_date) {
      params.push(to_date);
      conditions.push(`sm.created_at < ($${params.length}::date + interval '1 day')`);
    }

    const whereClause = ` WHERE ` + conditions.join(' AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(CASE WHEN sm.movement_type = 'IN' THEN sm.quantity ELSE 0 END), 0)::int AS total_in,
              COALESCE(SUM(CASE WHEN sm.movement_type = 'OUT' THEN sm.quantity ELSE 0 END), 0)::int AS total_out
       ${baseFrom}${whereClause}`,
      params
    );
    const { count, total_in, total_out } = countResult.rows[0];
    const total = parseInt(count, 10);

    const offset = (Number(page) - 1) * Number(limit);
    params.push(Number(limit));
    params.push(offset);
    const selectFields = `sm.*, p.product_name, p.product_code, ib.batch_number,
      c_supplier.customer_name AS supplier_name,
      CASE WHEN sm.reference_type = 'ORDER' THEN o.invoice_number ELSE NULL END AS invoice_number,
      c_order.customer_name AS customer_name`;
    const dataQuery = `SELECT ${selectFields} ${baseFrom}${whereClause} ORDER BY sm.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(dataQuery, params);
    res.json({ data: result.rows, total, total_in, total_out, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
};

const getLiveStock = async (req, res, next) => {
  try {
    const org_id = req.user.org_id;
    const result = await pool.query(`
      SELECT
        p.id AS product_id,
        p.product_name,
        p.product_code,
        p.unit,
        COALESCE(SUM(ib.quantity_remaining), 0)::int AS total_stock
      FROM products p
      LEFT JOIN inventory_batches ib ON ib.product_id = p.id
      WHERE p.status = 'active' AND p.org_id = $1
      GROUP BY p.id, p.product_name, p.product_code, p.unit
      ORDER BY p.product_name ASC
    `, [org_id]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const getLiveStockByProduct = async (req, res, next) => {
  try {
    const { product_id } = req.params;
    const org_id = req.user.org_id;

    const productResult = await pool.query(
      'SELECT product_name, product_code, unit FROM products WHERE id = $1 AND org_id = $2',
      [product_id, org_id]
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
    const { product_id, low_stock_threshold, low_stock } = req.query;
    const org_id = req.user.org_id;

    let query = `
      SELECT
        p.id AS product_id,
        p.product_name,
        p.product_code,
        p.unit,
        p.sub_unit,
        p.qty_per_box,
        p.low_stock_threshold,
        COALESCE(SUM(ib.quantity_remaining), 0)::int AS total_stock
      FROM products p
      LEFT JOIN inventory_batches ib ON ib.product_id = p.id
      WHERE p.status = 'active' AND p.org_id = $1
    `;
    const params = [org_id];

    if (product_id) {
      params.push(product_id);
      query += ` AND p.id = $${params.length}`;
    }

    query += ` GROUP BY p.id, p.product_name, p.product_code, p.unit, p.sub_unit, p.qty_per_box, p.low_stock_threshold`;

    if (low_stock_threshold) {
      params.push(Number(low_stock_threshold));
      query += ` HAVING CASE
        WHEN p.sub_unit IS NOT NULL AND p.qty_per_box IS NOT NULL AND p.qty_per_box > 0
        THEN COALESCE(SUM(ib.quantity_remaining), 0)::numeric / p.qty_per_box
        ELSE COALESCE(SUM(ib.quantity_remaining), 0)
      END < $${params.length}`;
    } else if (low_stock) {
      query += ` HAVING CASE
        WHEN p.sub_unit IS NOT NULL AND p.qty_per_box IS NOT NULL AND p.qty_per_box > 0
        THEN COALESCE(SUM(ib.quantity_remaining), 0)::numeric / p.qty_per_box
        ELSE COALESCE(SUM(ib.quantity_remaining), 0)
      END < COALESCE(p.low_stock_threshold, 50)`;
    }

    query += ` ORDER BY p.product_name ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const getMovementsBySupplier = async (req, res, next) => {
  try {
    const { supplier_id, from_date, to_date, page = 1, limit = 20 } = req.query;
    const org_id = req.user.org_id;

    const baseFrom = `
      FROM stock_movements sm
      LEFT JOIN customers c ON c.id = sm.supplier_id
      WHERE sm.movement_type = 'IN' AND sm.supplier_id IS NOT NULL AND sm.org_id = $1
    `;
    const conditions = [];
    const params = [org_id];

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

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM (SELECT supplier_id, received_date ${baseFrom}${whereClause} GROUP BY supplier_id, received_date) sub`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const offset = (Number(page) - 1) * Number(limit);
    params.push(Number(limit));
    params.push(offset);

    const dataQuery = `
      SELECT
        sm.supplier_id,
        TO_CHAR(sm.received_date, 'YYYY-MM-DD') AS received_date,
        c.customer_name AS supplier_name,
        COUNT(*) AS item_count,
        SUM(sm.quantity) AS total_quantity,
        (array_agg(sm.voucher_number ORDER BY sm.created_at ASC))[1] AS voucher_number
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
    const org_id = req.user.org_id;

    const baseFrom = `
      FROM stock_movements sm
      JOIN orders o ON sm.reference_id = o.id AND sm.reference_type = 'ORDER'
      JOIN customers c ON c.id = o.customer_id
      WHERE sm.movement_type = 'OUT' AND sm.org_id = $1
    `;
    const conditions = [];
    const params = [org_id];

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

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM (SELECT o.id ${baseFrom}${whereClause} GROUP BY o.id) sub`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

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
    const org_id = req.user.org_id;

    const baseFrom = `
      FROM stock_movements sm
      JOIN products p ON p.id = sm.product_id
      LEFT JOIN inventory_batches ib ON ib.id = sm.batch_id
      LEFT JOIN customers c_supplier ON c_supplier.id = sm.supplier_id
      LEFT JOIN orders o ON sm.reference_type = 'ORDER' AND o.id = sm.reference_id
      LEFT JOIN customers c_order ON c_order.id = o.customer_id
      WHERE sm.product_id = $1 AND sm.org_id = $2
    `;
    const conditions = [];
    const params = [product_id, org_id];

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

    const countResult = await pool.query(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(CASE WHEN sm.movement_type = 'IN' THEN sm.quantity ELSE 0 END), 0)::int AS total_in,
              COALESCE(SUM(CASE WHEN sm.movement_type = 'OUT' THEN sm.quantity ELSE 0 END), 0)::int AS total_out
       ${baseFrom}${whereClause}`,
      params
    );
    const { count, total_in, total_out } = countResult.rows[0];
    const total = parseInt(count, 10);

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

module.exports = { getStockMovements, getLiveStock, getLiveStockByProduct, getStockReport, getMovementsBySupplier, getMovementsByCustomer, getProductMovements };
