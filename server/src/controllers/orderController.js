const pool = require('../config/db');

const createOrder = async (req, res, next) => {
  try {
    const { customer_id, order_date, items } = req.body;

    // Validate required fields
    if (!customer_id) {
      return res.status(400).json({ error: 'customer_id is required' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array' });
    }

    for (const item of items) {
      if (!item.product_id) {
        return res.status(400).json({ error: 'Each item must have a product_id' });
      }
      if (!item.quantity || item.quantity <= 0) {
        return res.status(400).json({ error: 'Each item must have a quantity greater than 0' });
      }
    }

    // Validate customer exists
    const customerCheck = await pool.query('SELECT id FROM customers WHERE id = $1', [customer_id]);
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Consolidate duplicate product_ids by summing quantities
    const consolidated = {};
    for (const item of items) {
      if (consolidated[item.product_id]) {
        consolidated[item.product_id] += Number(item.quantity);
      } else {
        consolidated[item.product_id] = Number(item.quantity);
      }
    }
    const mergedItems = Object.entries(consolidated).map(([product_id, quantity]) => ({
      product_id,
      quantity,
    }));

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Validate all products exist
      for (const item of mergedItems) {
        const productCheck = await client.query('SELECT id FROM products WHERE id = $1', [item.product_id]);
        if (productCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Product ${item.product_id} not found` });
        }
      }

      // Generate invoice number
      const lastOrder = await client.query(
        'SELECT invoice_number FROM orders ORDER BY created_at DESC LIMIT 1'
      );
      let nextNumber = 1;
      if (lastOrder.rows.length > 0) {
        const lastNum = parseInt(lastOrder.rows[0].invoice_number.replace('INV-', ''), 10);
        if (!isNaN(lastNum)) nextNumber = lastNum + 1;
      }
      const invoiceNumber = `INV-${String(nextNumber).padStart(4, '0')}`;

      // Insert order
      const orderResult = await client.query(
        `INSERT INTO orders (invoice_number, customer_id, order_date, status)
         VALUES ($1, $2, $3, 'completed')
         RETURNING *`,
        [invoiceNumber, customer_id, order_date || new Date().toISOString().split('T')[0]]
      );
      const order = orderResult.rows[0];

      const deductionDetails = [];

      // Process each item
      for (const item of mergedItems) {
        // Insert order item
        const orderItemResult = await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [order.id, item.product_id, item.quantity]
        );

        // Fetch available batches in FIFO order with row locking
        const batchesResult = await client.query(
          `SELECT id, batch_number, quantity_remaining
           FROM inventory_batches
           WHERE product_id = $1 AND quantity_remaining > 0
           ORDER BY received_date ASC, created_at ASC
           FOR UPDATE`,
          [item.product_id]
        );

        const totalAvailable = batchesResult.rows.reduce((sum, b) => sum + b.quantity_remaining, 0);
        if (totalAvailable < item.quantity) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: `Insufficient stock for product ${item.product_id}. Available: ${totalAvailable}, Requested: ${item.quantity}`,
          });
        }

        // FIFO deduction
        let remaining = item.quantity;
        const itemDeductions = [];

        for (const batch of batchesResult.rows) {
          if (remaining <= 0) break;

          const deduct = Math.min(remaining, batch.quantity_remaining);

          await client.query(
            'UPDATE inventory_batches SET quantity_remaining = quantity_remaining - $1 WHERE id = $2',
            [deduct, batch.id]
          );

          await client.query(
            `INSERT INTO stock_movements (product_id, batch_id, quantity, movement_type, reference_type, reference_id)
             VALUES ($1, $2, $3, 'OUT', 'ORDER', $4)`,
            [item.product_id, batch.id, deduct, order.id]
          );

          itemDeductions.push({
            batch_id: batch.id,
            batch_number: batch.batch_number,
            quantity_deducted: deduct,
          });

          remaining -= deduct;
        }

        deductionDetails.push({
          product_id: item.product_id,
          quantity: item.quantity,
          deductions: itemDeductions,
        });
      }

      await client.query('COMMIT');

      res.status(201).json({
        order,
        items: deductionDetails,
      });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

const getAllOrders = async (req, res, next) => {
  try {
    const { customer_id, status, from_date, to_date } = req.query;

    let query = `
      SELECT o.*, c.customer_name
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
    `;
    const conditions = [];
    const params = [];

    if (customer_id) {
      params.push(customer_id);
      conditions.push(`o.customer_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`o.status = $${params.length}`);
    }
    if (from_date) {
      params.push(from_date);
      conditions.push(`o.order_date >= $${params.length}`);
    }
    if (to_date) {
      params.push(to_date);
      conditions.push(`o.order_date <= $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY o.order_date DESC, o.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Order + customer
    const orderResult = await pool.query(
      `SELECT o.*, c.customer_name, c.phone, c.email, c.address
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       WHERE o.id = $1`,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Order items + products
    const itemsResult = await pool.query(
      `SELECT oi.*, p.product_name, p.product_code
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [id]
    );

    // Stock movements for this order
    const movementsResult = await pool.query(
      `SELECT sm.*, ib.batch_number
       FROM stock_movements sm
       LEFT JOIN inventory_batches ib ON ib.id = sm.batch_id
       WHERE sm.reference_type = 'ORDER' AND sm.reference_id = $1`,
      [id]
    );

    // Group movements by product_id and attach to items
    const movementsByProduct = {};
    for (const m of movementsResult.rows) {
      if (!movementsByProduct[m.product_id]) {
        movementsByProduct[m.product_id] = [];
      }
      movementsByProduct[m.product_id].push({
        batch_id: m.batch_id,
        batch_number: m.batch_number,
        quantity: m.quantity,
      });
    }

    const itemsWithDeductions = itemsResult.rows.map((item) => ({
      ...item,
      deductions: movementsByProduct[item.product_id] || [],
    }));

    res.json({
      ...order,
      items: itemsWithDeductions,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { createOrder, getAllOrders, getOrderById };
