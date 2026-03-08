const pool = require('../config/db');

// POST /api/batches — single batch create (kept for compatibility)
const createBatch = async (req, res, next) => {
  try {
    const { product_id, batch_number, quantity_received, received_date, supplier_id } = req.body;

    if (!product_id || !batch_number || quantity_received == null || !received_date) {
      return res.status(400).json({ error: 'product_id, batch_number, quantity_received, and received_date are required' });
    }

    if (quantity_received <= 0) {
      return res.status(400).json({ error: 'quantity_received must be greater than 0' });
    }

    const productCheck = await pool.query('SELECT id FROM products WHERE id = $1', [product_id]);
    if (productCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Product not found' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const batchResult = await client.query(
        `INSERT INTO inventory_batches (product_id, batch_number, quantity_received, quantity_remaining, received_date)
         VALUES ($1, $2, $3, $3, $4)
         RETURNING *`,
        [product_id, batch_number, quantity_received, received_date]
      );
      const batch = batchResult.rows[0];

      await client.query(
        `INSERT INTO stock_movements (product_id, batch_id, quantity, movement_type, reference_type, reference_id, supplier_id, received_date)
         VALUES ($1, $2, $3, 'IN', 'BATCH', $2, $4, $5)`,
        [product_id, batch.id, quantity_received, supplier_id || null, received_date]
      );

      await client.query('COMMIT');
      res.status(201).json(batch);
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Batch number already exists' });
    }
    next(err);
  }
};

// POST /api/batches/bulk — create/update multiple batch items at once
const createBulkBatches = async (req, res, next) => {
  try {
    const { supplier_id, received_date, items } = req.body;

    if (!supplier_id) {
      return res.status(400).json({ error: 'Supplier is required' });
    }
    if (!received_date) {
      return res.status(400).json({ error: 'Received date is required' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
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
    const results = [];

    try {
      await client.query('BEGIN');

      for (const item of items) {
        const qty = Number(item.quantity);

        if (item.existing_batch_id) {
          // Update existing batch — add to quantity
          const batchResult = await client.query(
            `UPDATE inventory_batches
             SET quantity_received = quantity_received + $1,
                 quantity_remaining = quantity_remaining + $1
             WHERE id = $2
             RETURNING *`,
            [qty, item.existing_batch_id]
          );

          if (batchResult.rows.length === 0) {
            throw new Error(`Batch not found: ${item.existing_batch_id}`);
          }

          const batch = batchResult.rows[0];

          // Each stock entry records the supplier separately
          await client.query(
            `INSERT INTO stock_movements (product_id, batch_id, quantity, movement_type, reference_type, reference_id, supplier_id, received_date)
             VALUES ($1, $2, $3, 'IN', 'BATCH', $2, $4, $5)`,
            [batch.product_id, batch.id, qty, supplier_id, received_date]
          );

          results.push({ action: 'updated', batch });
        } else {
          // Create new batch or batch-less stock entry
          const batchNumber = item.new_batch_number ? item.new_batch_number.trim() : null;

          const batchResult = await client.query(
            `INSERT INTO inventory_batches (product_id, batch_number, quantity_received, quantity_remaining, received_date, manufacture_date, expiry_date)
             VALUES ($1, $2, $3, $3, $4, $5, $6)
             RETURNING *`,
            [item.product_id, batchNumber || null, qty, received_date, item.manufacture_date || null, item.expiry_date || null]
          );

          const batch = batchResult.rows[0];

          await client.query(
            `INSERT INTO stock_movements (product_id, batch_id, quantity, movement_type, reference_type, reference_id, supplier_id, received_date)
             VALUES ($1, $2, $3, 'IN', 'BATCH', $2, $4, $5)`,
            [item.product_id, batch.id, qty, supplier_id, received_date]
          );

          results.push({ action: 'created', batch });
        }
      }

      await client.query('COMMIT');
      res.status(201).json({ message: `${results.length} batch(es) processed`, results });
    } catch (txErr) {
      await client.query('ROLLBACK');
      if (txErr.code === '23505') {
        return res.status(409).json({ error: 'Duplicate batch number found. Each batch number must be unique.' });
      }
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

// GET /api/batches — list batches (master records)
const getAllBatches = async (req, res, next) => {
  try {
    const { product_id } = req.query;
    let query = `
      SELECT b.*, p.product_name
      FROM inventory_batches b
      JOIN products p ON p.id = b.product_id
    `;
    const params = [];

    if (product_id) {
      params.push(product_id);
      query += ` WHERE b.product_id = $1`;
    }

    query += ` ORDER BY b.received_date DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/batches/stock-entries — list all IN movements with supplier info
const getStockEntries = async (req, res, next) => {
  try {
    const { product_id, supplier_id } = req.query;
    const params = [];
    const conditions = ["sm.movement_type = 'IN'"];

    if (product_id) {
      params.push(product_id);
      conditions.push(`sm.product_id = $${params.length}`);
    }
    if (supplier_id) {
      params.push(supplier_id);
      conditions.push(`sm.supplier_id = $${params.length}`);
    }

    const query = `
      SELECT sm.id, sm.quantity, sm.created_at, sm.received_date,
             p.product_name, p.product_code, p.batch_tracking,
             ib.batch_number, ib.quantity_remaining, ib.manufacture_date, ib.expiry_date,
             c.customer_name AS supplier_name
      FROM stock_movements sm
      JOIN products p ON p.id = sm.product_id
      LEFT JOIN inventory_batches ib ON ib.id = sm.batch_id
      LEFT JOIN customers c ON c.id = sm.supplier_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY sm.created_at DESC
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const getBatchById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT b.*, p.product_name
       FROM inventory_batches b
       JOIN products p ON p.id = b.product_id
       WHERE b.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const getBatchesByProduct = async (req, res, next) => {
  try {
    const { product_id } = req.params;
    const result = await pool.query(
      `SELECT b.*, p.product_name
       FROM inventory_batches b
       JOIN products p ON p.id = b.product_id
       WHERE b.product_id = $1
       ORDER BY b.received_date DESC`,
      [product_id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

module.exports = { createBatch, createBulkBatches, getAllBatches, getStockEntries, getBatchById, getBatchesByProduct };
