const pool = require('../config/db');

const createOrder = async (req, res, next) => {
  try {
    const { customer_id, order_date, items, reference_number, party_name } = req.body;
    const org_id = req.user.org_id;

    if (!customer_id) {
      return res.status(400).json({ error: 'customer_id is required' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array' });
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.product_id) {
        return res.status(400).json({ error: `Row ${i + 1}: Product is required` });
      }
      if (!item.quantity || item.quantity <= 0) {
        return res.status(400).json({ error: `Row ${i + 1}: Quantity must be greater than 0` });
      }
    }

    const customerCheck = await pool.query('SELECT id FROM customers WHERE id = $1 AND org_id = $2', [customer_id, org_id]);
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Generate invoice number per org
      const lastOrder = await client.query(
        'SELECT invoice_number FROM orders WHERE org_id = $1 ORDER BY created_at DESC LIMIT 1',
        [org_id]
      );
      let nextNumber = 1;
      if (lastOrder.rows.length > 0) {
        const lastNum = parseInt(lastOrder.rows[0].invoice_number.replace(/^(INV-|MO-)/, ''), 10);
        if (!isNaN(lastNum)) nextNumber = lastNum + 1;
      }
      const invoiceNumber = `MO-${String(nextNumber).padStart(4, '0')}`;

      // Insert order
      const orderResult = await client.query(
        `INSERT INTO orders (invoice_number, customer_id, order_date, status, reference_number, party_name, org_id)
         VALUES ($1, $2, $3, 'completed', $4, $5, $6)
         RETURNING *`,
        [invoiceNumber, customer_id, order_date || new Date().toISOString().split('T')[0], reference_number || null, party_name || null, org_id]
      );
      const order = orderResult.rows[0];

      const deductionDetails = [];

      for (const item of items) {
        const qty = Number(item.quantity);

        // Insert order item
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, org_id)
           VALUES ($1, $2, $3, $4)`,
          [order.id, item.product_id, qty, org_id]
        );

        if (item.batch_id) {
          // Manual batch selection
          const batchResult = await client.query(
            `SELECT id, batch_number, quantity_remaining
             FROM inventory_batches
             WHERE id = $1 AND product_id = $2 AND quantity_remaining > 0 AND org_id = $3
             FOR UPDATE`,
            [item.batch_id, item.product_id, org_id]
          );

          if (batchResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Batch not found or empty for product ${item.product_id}` });
          }

          const batch = batchResult.rows[0];
          if (batch.quantity_remaining < qty) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              error: `Insufficient stock in batch ${batch.batch_number}. Available: ${batch.quantity_remaining}, Requested: ${qty}`,
            });
          }

          await client.query(
            'UPDATE inventory_batches SET quantity_remaining = quantity_remaining - $1 WHERE id = $2',
            [qty, batch.id]
          );

          await client.query(
            `INSERT INTO stock_movements (product_id, batch_id, quantity, movement_type, reference_type, reference_id, org_id)
             VALUES ($1, $2, $3, 'OUT', 'ORDER', $4, $5)`,
            [item.product_id, batch.id, qty, order.id, org_id]
          );

          deductionDetails.push({
            product_id: item.product_id,
            quantity: qty,
            deductions: [{ batch_id: batch.id, batch_number: batch.batch_number, quantity_deducted: qty }],
          });
        } else {
          // FIFO deduction
          const batchesResult = await client.query(
            `SELECT id, batch_number, quantity_remaining
             FROM inventory_batches
             WHERE product_id = $1 AND quantity_remaining > 0 AND org_id = $2
             ORDER BY received_date ASC, created_at ASC
             FOR UPDATE`,
            [item.product_id, org_id]
          );

          const totalAvailable = batchesResult.rows.reduce((sum, b) => sum + b.quantity_remaining, 0);
          if (totalAvailable < qty) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              error: `Insufficient stock for product ${item.product_id}. Available: ${totalAvailable}, Requested: ${qty}`,
            });
          }

          let remaining = qty;
          const itemDeductions = [];

          for (const batch of batchesResult.rows) {
            if (remaining <= 0) break;

            const deduct = Math.min(remaining, batch.quantity_remaining);

            await client.query(
              'UPDATE inventory_batches SET quantity_remaining = quantity_remaining - $1 WHERE id = $2',
              [deduct, batch.id]
            );

            await client.query(
              `INSERT INTO stock_movements (product_id, batch_id, quantity, movement_type, reference_type, reference_id, org_id)
               VALUES ($1, $2, $3, 'OUT', 'ORDER', $4, $5)`,
              [item.product_id, batch.id, deduct, order.id, org_id]
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
            quantity: qty,
            deductions: itemDeductions,
          });
        }
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
    const { customer_id, product_id, status, from_date, to_date, page = 1, limit = 20 } = req.query;
    const org_id = req.user.org_id;

    const baseFrom = `
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
    `;
    const conditions = [`o.org_id = $1`];
    const params = [org_id];

    if (customer_id) {
      params.push(customer_id);
      conditions.push(`o.customer_id = $${params.length}`);
    }
    if (product_id) {
      params.push(product_id);
      conditions.push(`EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.product_id = $${params.length})`);
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

    const whereClause = ' WHERE ' + conditions.join(' AND ');

    const countResult = await pool.query(`SELECT COUNT(*) ${baseFrom}${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const offset = (Number(page) - 1) * Number(limit);
    params.push(Number(limit));
    params.push(offset);
    const dataQuery = `SELECT o.*, c.customer_name ${baseFrom}${whereClause} ORDER BY o.invoice_number DESC NULLS LAST LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(dataQuery, params);
    res.json({ data: result.rows, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const org_id = req.user.org_id;

    const orderResult = await pool.query(
      `SELECT o.*, c.customer_name, c.phone, c.email, c.address
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       WHERE o.id = $1 AND o.org_id = $2`,
      [id, org_id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT oi.*, p.product_name, p.product_code, p.unit, p.sub_unit, p.qty_per_box, p.image_url
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [id]
    );

    const movementsResult = await pool.query(
      `SELECT sm.*, ib.batch_number
       FROM stock_movements sm
       LEFT JOIN inventory_batches ib ON ib.id = sm.batch_id
       WHERE sm.reference_type = 'ORDER' AND sm.reference_id = $1`,
      [id]
    );

    const mergedItems = [];
    for (const item of itemsResult.rows) {
      const existing = mergedItems.find((m) => m.product_id === item.product_id);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        mergedItems.push({ ...item, quantity: item.quantity });
      }
    }

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

    const itemsWithDeductions = mergedItems.map((item) => ({
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

// PUT /api/orders/:id
const updateOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { customer_id, order_date, items, reference_number, party_name } = req.body;
    const org_id = req.user.org_id;

    if (!customer_id) {
      return res.status(400).json({ error: 'customer_id is required' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array' });
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.product_id) {
        return res.status(400).json({ error: `Row ${i + 1}: Product is required` });
      }
      if (!item.quantity || item.quantity <= 0) {
        return res.status(400).json({ error: `Row ${i + 1}: Quantity must be greater than 0` });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orderCheck = await client.query('SELECT * FROM orders WHERE id = $1 AND org_id = $2 FOR UPDATE', [id, org_id]);
      if (orderCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Order not found' });
      }

      // Reverse existing stock deductions
      const oldMovements = await client.query(
        "SELECT * FROM stock_movements WHERE reference_type = 'ORDER' AND reference_id = $1 AND movement_type = 'OUT'",
        [id]
      );

      for (const mov of oldMovements.rows) {
        await client.query(
          'UPDATE inventory_batches SET quantity_remaining = quantity_remaining + $1 WHERE id = $2',
          [mov.quantity, mov.batch_id]
        );
      }

      await client.query("DELETE FROM stock_movements WHERE reference_type = 'ORDER' AND reference_id = $1", [id]);
      await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);

      await client.query(
        'UPDATE orders SET customer_id = $1, order_date = $2, reference_number = $3, party_name = $4 WHERE id = $5 AND org_id = $6',
        [customer_id, order_date || new Date().toISOString().split('T')[0], reference_number || null, party_name || null, id, org_id]
      );

      const deductionDetails = [];

      for (const item of items) {
        const qty = Number(item.quantity);

        await client.query(
          'INSERT INTO order_items (order_id, product_id, quantity, org_id) VALUES ($1, $2, $3, $4)',
          [id, item.product_id, qty, org_id]
        );

        if (item.batch_id) {
          const batchResult = await client.query(
            `SELECT id, batch_number, quantity_remaining
             FROM inventory_batches
             WHERE id = $1 AND product_id = $2 AND quantity_remaining > 0 AND org_id = $3
             FOR UPDATE`,
            [item.batch_id, item.product_id, org_id]
          );

          if (batchResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Batch not found or empty for product ${item.product_id}` });
          }

          const batch = batchResult.rows[0];
          if (batch.quantity_remaining < qty) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              error: `Insufficient stock in batch ${batch.batch_number}. Available: ${batch.quantity_remaining}, Requested: ${qty}`,
            });
          }

          await client.query(
            'UPDATE inventory_batches SET quantity_remaining = quantity_remaining - $1 WHERE id = $2',
            [qty, batch.id]
          );

          await client.query(
            `INSERT INTO stock_movements (product_id, batch_id, quantity, movement_type, reference_type, reference_id, org_id)
             VALUES ($1, $2, $3, 'OUT', 'ORDER', $4, $5)`,
            [item.product_id, batch.id, qty, id, org_id]
          );

          deductionDetails.push({
            product_id: item.product_id,
            quantity: qty,
            deductions: [{ batch_id: batch.id, batch_number: batch.batch_number, quantity_deducted: qty }],
          });
        } else {
          const batchesResult = await client.query(
            `SELECT id, batch_number, quantity_remaining
             FROM inventory_batches
             WHERE product_id = $1 AND quantity_remaining > 0 AND org_id = $2
             ORDER BY received_date ASC, created_at ASC
             FOR UPDATE`,
            [item.product_id, org_id]
          );

          const totalAvailable = batchesResult.rows.reduce((sum, b) => sum + b.quantity_remaining, 0);
          if (totalAvailable < qty) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              error: `Insufficient stock for product ${item.product_id}. Available: ${totalAvailable}, Requested: ${qty}`,
            });
          }

          let remaining = qty;
          const itemDeductions = [];

          for (const batch of batchesResult.rows) {
            if (remaining <= 0) break;

            const deduct = Math.min(remaining, batch.quantity_remaining);

            await client.query(
              'UPDATE inventory_batches SET quantity_remaining = quantity_remaining - $1 WHERE id = $2',
              [deduct, batch.id]
            );

            await client.query(
              `INSERT INTO stock_movements (product_id, batch_id, quantity, movement_type, reference_type, reference_id, org_id)
               VALUES ($1, $2, $3, 'OUT', 'ORDER', $4, $5)`,
              [item.product_id, batch.id, deduct, id, org_id]
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
            quantity: qty,
            deductions: itemDeductions,
          });
        }
      }

      await client.query('COMMIT');

      const updatedOrder = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
      res.json({ order: updatedOrder.rows[0], items: deductionDetails });
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

// DELETE /api/orders/:id
const deleteOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const org_id = req.user.org_id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orderCheck = await client.query('SELECT * FROM orders WHERE id = $1 AND org_id = $2 FOR UPDATE', [id, org_id]);
      if (orderCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Order not found' });
      }

      const movements = await client.query(
        "SELECT * FROM stock_movements WHERE reference_type = 'ORDER' AND reference_id = $1 AND movement_type = 'OUT'",
        [id]
      );

      for (const mov of movements.rows) {
        await client.query(
          'UPDATE inventory_batches SET quantity_remaining = quantity_remaining + $1 WHERE id = $2',
          [mov.quantity, mov.batch_id]
        );
      }

      await client.query("DELETE FROM stock_movements WHERE reference_type = 'ORDER' AND reference_id = $1", [id]);
      await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);
      await client.query('DELETE FROM orders WHERE id = $1 AND org_id = $2', [id, org_id]);

      await client.query('COMMIT');
      res.json({ message: 'Order deleted successfully' });
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

module.exports = { createOrder, getAllOrders, getOrderById, updateOrder, deleteOrder };
