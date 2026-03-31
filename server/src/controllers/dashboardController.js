const pool = require('../config/db');

// GET /api/dashboard/inventory
const getInventoryDashboard = async (req, res, next) => {
  try {
    const org_id = req.user.org_id;

    const [
      productsRes,
      stockValueRes,
      customersRes,
      ordersRes,
      lowStockRes,
      recentOrdersRes,
      movementsRes,
      stockRes,
      usersRes,
      materialInRes,
    ] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM products WHERE status = 'active' AND org_id = $1", [org_id]),
      pool.query(
        `SELECT COALESCE(SUM(ib.quantity_remaining * COALESCE(p.unit_price, 0)), 0) AS total
         FROM inventory_batches ib
         JOIN products p ON ib.product_id = p.id
         WHERE p.org_id = $1`,
        [org_id]
      ),
      pool.query('SELECT COUNT(*)::int AS count FROM customers WHERE org_id = $1', [org_id]),
      pool.query('SELECT COUNT(*)::int AS count FROM orders WHERE org_id = $1', [org_id]),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM (
           SELECT p.id FROM products p
           LEFT JOIN inventory_batches ib ON ib.product_id = p.id
           WHERE p.status = 'active' AND p.org_id = $1
           GROUP BY p.id, p.low_stock_threshold, p.sub_unit, p.qty_per_box
           HAVING CASE
             WHEN p.sub_unit IS NOT NULL AND p.qty_per_box IS NOT NULL AND p.qty_per_box > 0
             THEN COALESCE(SUM(ib.quantity_remaining), 0)::numeric / p.qty_per_box
             ELSE COALESCE(SUM(ib.quantity_remaining), 0)
           END < COALESCE(p.low_stock_threshold, 50)
         ) sub`,
        [org_id]
      ),
      pool.query(
        `SELECT o.id, o.invoice_number, o.order_date, o.status, c.customer_name
         FROM orders o
         JOIN customers c ON c.id = o.customer_id
         WHERE o.org_id = $1
         ORDER BY o.created_at DESC LIMIT 10`,
        [org_id]
      ),
      pool.query(
        `SELECT sm.*, p.product_name, ib.batch_number
         FROM stock_movements sm
         JOIN products p ON p.id = sm.product_id
         LEFT JOIN inventory_batches ib ON ib.id = sm.batch_id
         WHERE sm.org_id = $1
         ORDER BY sm.created_at DESC LIMIT 5`,
        [org_id]
      ),
      pool.query(
        `SELECT p.id AS product_id, p.product_name, p.product_code, p.unit,
                COALESCE(SUM(ib.quantity_remaining), 0)::int AS total_stock
         FROM products p
         LEFT JOIN inventory_batches ib ON ib.product_id = p.id
         WHERE p.status = 'active' AND p.org_id = $1
         GROUP BY p.id, p.product_name, p.product_code, p.unit
         ORDER BY p.product_name ASC`,
        [org_id]
      ),
      pool.query("SELECT COUNT(*)::int AS count FROM users WHERE is_active = true AND org_id = $1 AND is_super_admin = false", [org_id]),
      pool.query(
        "SELECT COUNT(DISTINCT voucher_number)::int AS count FROM stock_movements WHERE movement_type = 'IN' AND supplier_id IS NOT NULL AND org_id = $1",
        [org_id]
      ),
    ]);

    res.json({
      total_products: productsRes.rows[0].count,
      total_stock_value: parseFloat(stockValueRes.rows[0].total),
      total_customers: customersRes.rows[0].count,
      total_orders: ordersRes.rows[0].count,
      total_material_in: materialInRes.rows[0].count,
      low_stock_count: lowStockRes.rows[0].count,
      recent_orders: recentOrdersRes.rows,
      recent_movements: movementsRes.rows,
      stock_summary: stockRes.rows,
      total_users: usersRes.rows[0].count,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/dashboard/platform — super admin platform stats
const getPlatformDashboard = async (req, res, next) => {
  try {
    const [orgsRes, usersRes, activeOrgsRes] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM organizations'),
      pool.query('SELECT COUNT(*)::int AS count FROM users WHERE is_super_admin = false'),
      pool.query('SELECT COUNT(*)::int AS count FROM organizations WHERE is_active = true'),
    ]);

    const orgs = await pool.query(
      `SELECT o.id, o.org_code, o.org_name, o.is_active,
              COUNT(u.id)::int AS user_count
       FROM organizations o
       LEFT JOIN users u ON u.org_id = o.id AND u.is_super_admin = false
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT 10`
    );

    res.json({
      total_orgs: orgsRes.rows[0].count,
      active_orgs: activeOrgsRes.rows[0].count,
      total_users: usersRes.rows[0].count,
      recent_orgs: orgs.rows,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getInventoryDashboard, getPlatformDashboard };
