const pool = require('../config/db');

// GET /api/dashboard/inventory
const getInventoryDashboard = async (req, res, next) => {
  try {
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
    ] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM products WHERE status = 'active'"),
      pool.query(
        `SELECT COALESCE(SUM(ib.quantity_remaining * COALESCE(p.unit_price, 0)), 0) AS total
         FROM inventory_batches ib
         JOIN products p ON ib.product_id = p.id`
      ),
      pool.query('SELECT COUNT(*)::int AS count FROM customers'),
      pool.query('SELECT COUNT(*)::int AS count FROM orders'),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM (
           SELECT p.id FROM products p
           LEFT JOIN inventory_batches ib ON ib.product_id = p.id
           WHERE p.status = 'active'
           GROUP BY p.id
           HAVING COALESCE(SUM(ib.quantity_remaining), 0) < 50
         ) sub`
      ),
      pool.query(
        `SELECT o.id, o.invoice_number, o.order_date, o.status, c.customer_name
         FROM orders o
         JOIN customers c ON c.id = o.customer_id
         ORDER BY o.created_at DESC LIMIT 10`
      ),
      pool.query(
        `SELECT sm.*, p.product_name, ib.batch_number
         FROM stock_movements sm
         JOIN products p ON p.id = sm.product_id
         LEFT JOIN inventory_batches ib ON ib.id = sm.batch_id
         ORDER BY sm.created_at DESC LIMIT 5`
      ),
      pool.query(
        `SELECT p.id AS product_id, p.product_name, p.product_code, p.unit,
                COALESCE(SUM(ib.quantity_remaining), 0)::int AS total_stock
         FROM products p
         LEFT JOIN inventory_batches ib ON ib.product_id = p.id
         WHERE p.status = 'active'
         GROUP BY p.id, p.product_name, p.product_code, p.unit
         ORDER BY p.product_name ASC`
      ),
      pool.query("SELECT COUNT(*)::int AS count FROM users WHERE is_active = true"),
    ]);

    res.json({
      total_products: productsRes.rows[0].count,
      total_stock_value: parseFloat(stockValueRes.rows[0].total),
      total_customers: customersRes.rows[0].count,
      total_orders: ordersRes.rows[0].count,
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

module.exports = { getInventoryDashboard };
