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
    const { product_id, from_date, to_date, page = 1, limit = 20 } = req.query;

    const baseFrom = `
      FROM inventory_batches b
      JOIN products p ON p.id = b.product_id
    `;
    const conditions = [];
    const params = [];

    if (product_id) {
      params.push(product_id);
      conditions.push(`b.product_id = $${params.length}`);
    }

    // Default to today if no date filters provided
    const effectiveFromDate = from_date || to_date ? from_date : new Date().toISOString().split('T')[0];
    const effectiveToDate = from_date || to_date ? to_date : new Date().toISOString().split('T')[0];

    if (effectiveFromDate) {
      params.push(effectiveFromDate);
      conditions.push(`b.received_date >= $${params.length}`);
    }
    if (effectiveToDate) {
      params.push(effectiveToDate);
      conditions.push(`b.received_date <= $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

    const countResult = await pool.query(`SELECT COUNT(*) ${baseFrom}${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const offset = (Number(page) - 1) * Number(limit);
    params.push(Number(limit));
    params.push(offset);
    const dataQuery = `SELECT b.*, p.product_name ${baseFrom}${whereClause} ORDER BY b.received_date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(dataQuery, params);
    res.json({ data: result.rows, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
};

// GET /api/batches/stock-entries — list all IN movements with supplier info
const getStockEntries = async (req, res, next) => {
  try {
    const { product_id, supplier_id, from_date, to_date, page = 1, limit = 20 } = req.query;

    const baseFrom = `
      FROM stock_movements sm
      JOIN products p ON p.id = sm.product_id
      LEFT JOIN inventory_batches ib ON ib.id = sm.batch_id
      LEFT JOIN customers c ON c.id = sm.supplier_id
    `;
    const conditions = ["sm.movement_type = 'IN'"];
    const params = [];

    if (product_id) {
      params.push(product_id);
      conditions.push(`sm.product_id = $${params.length}`);
    }
    if (supplier_id) {
      params.push(supplier_id);
      conditions.push(`sm.supplier_id = $${params.length}`);
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

    const whereClause = ' WHERE ' + conditions.join(' AND ');

    const countResult = await pool.query(`SELECT COUNT(*) ${baseFrom}${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const offset = (Number(page) - 1) * Number(limit);
    params.push(Number(limit));
    params.push(offset);
    const selectFields = `sm.id, sm.quantity, sm.created_at, sm.received_date,
             p.product_name, p.product_code, p.batch_tracking,
             ib.batch_number, ib.quantity_remaining, ib.manufacture_date, ib.expiry_date,
             c.customer_name AS supplier_name`;
    const dataQuery = `SELECT ${selectFields} ${baseFrom}${whereClause} ORDER BY sm.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(dataQuery, params);
    res.json({ data: result.rows, total, page: Number(page), limit: Number(limit) });
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

// GET /api/batches/stock-entries/:id — get single stock entry for editing
const getStockEntryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT sm.id, sm.quantity, sm.supplier_id,
              COALESCE(sm.received_date, ib.received_date, sm.created_at::date) AS received_date,
              sm.product_id, sm.batch_id,
              p.product_name, p.product_code, p.batch_tracking,
              ib.batch_number, ib.manufacture_date, ib.expiry_date,
              c.customer_name AS supplier_name
       FROM stock_movements sm
       JOIN products p ON p.id = sm.product_id
       LEFT JOIN inventory_batches ib ON ib.id = sm.batch_id
       LEFT JOIN customers c ON c.id = sm.supplier_id
       WHERE sm.id = $1 AND sm.movement_type = 'IN'`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stock entry not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// PUT /api/batches/stock-entries/:id — update a stock entry
const updateStockEntry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity, supplier_id, received_date, batch_number, manufacture_date, expiry_date, move_to_batch_id } = req.body;

    if (!quantity || Number(quantity) <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const smResult = await client.query(
        "SELECT * FROM stock_movements WHERE id = $1 AND movement_type = 'IN' FOR UPDATE",
        [id]
      );
      if (smResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Stock entry not found' });
      }
      const sm = smResult.rows[0];
      const oldQty = sm.quantity;
      const newQty = Number(quantity);

      if (move_to_batch_id && move_to_batch_id !== sm.batch_id) {
        // Moving stock to a different batch
        // 1. Remove quantity from old batch
        await client.query(
          'UPDATE inventory_batches SET quantity_received = quantity_received - $1, quantity_remaining = quantity_remaining - $1 WHERE id = $2',
          [oldQty, sm.batch_id]
        );

        // Check old batch remaining doesn't go negative
        const oldBatchCheck = await client.query('SELECT quantity_remaining FROM inventory_batches WHERE id = $1', [sm.batch_id]);
        if (oldBatchCheck.rows[0].quantity_remaining < 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Cannot move: some stock from this batch has already been sold' });
        }

        // 2. Add quantity to new batch
        await client.query(
          'UPDATE inventory_batches SET quantity_received = quantity_received + $1, quantity_remaining = quantity_remaining + $1 WHERE id = $2',
          [newQty, move_to_batch_id]
        );

        // 3. Update stock movement to point to new batch
        await client.query(
          'UPDATE stock_movements SET quantity = $1, supplier_id = $2, received_date = $3, batch_id = $4 WHERE id = $5',
          [newQty, supplier_id || null, received_date || sm.received_date, move_to_batch_id, id]
        );
      } else {
        // Same batch — adjust quantities if changed
        const qtyDiff = newQty - oldQty;
        if (qtyDiff !== 0) {
          await client.query(
            'UPDATE inventory_batches SET quantity_received = quantity_received + $1, quantity_remaining = quantity_remaining + $1 WHERE id = $2',
            [qtyDiff, sm.batch_id]
          );

          const batchCheck = await client.query('SELECT quantity_remaining FROM inventory_batches WHERE id = $1', [sm.batch_id]);
          if (batchCheck.rows[0].quantity_remaining < 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Cannot reduce quantity below what has already been sold' });
          }
        }

        // Update batch details
        if (batch_number !== undefined) {
          await client.query(
            'UPDATE inventory_batches SET batch_number = $1, manufacture_date = $2, expiry_date = $3, received_date = $4 WHERE id = $5',
            [batch_number || null, manufacture_date || null, expiry_date || null, received_date || sm.received_date, sm.batch_id]
          );
        }

        // Update stock movement
        await client.query(
          'UPDATE stock_movements SET quantity = $1, supplier_id = $2, received_date = $3 WHERE id = $4',
          [newQty, supplier_id || null, received_date || sm.received_date, id]
        );
      }

      await client.query('COMMIT');
      res.json({ message: 'Stock entry updated successfully' });
    } catch (txErr) {
      await client.query('ROLLBACK');
      if (txErr.code === '23505') {
        return res.status(409).json({ error: 'Duplicate batch number for this product' });
      }
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

// GET /api/batches/stock-entries/:id/siblings — all entries with same supplier + received_date
const getStockEntrySiblings = async (req, res, next) => {
  try {
    const { id } = req.params;

    // First get the clicked entry to find supplier_id + received_date
    const ref = await pool.query(
      `SELECT sm.supplier_id, COALESCE(sm.received_date, ib.received_date, sm.created_at::date) AS received_date
       FROM stock_movements sm
       LEFT JOIN inventory_batches ib ON ib.id = sm.batch_id
       WHERE sm.id = $1 AND sm.movement_type = 'IN'`,
      [id]
    );
    if (ref.rows.length === 0) {
      return res.status(404).json({ error: 'Stock entry not found' });
    }
    const { supplier_id, received_date } = ref.rows[0];

    // Fetch all siblings
    const result = await pool.query(
      `SELECT sm.id, sm.quantity, sm.supplier_id,
              COALESCE(sm.received_date, ib.received_date, sm.created_at::date) AS received_date,
              sm.product_id, sm.batch_id,
              p.product_name, p.product_code, p.batch_tracking,
              ib.batch_number, ib.manufacture_date, ib.expiry_date,
              c.customer_name AS supplier_name
       FROM stock_movements sm
       JOIN products p ON p.id = sm.product_id
       LEFT JOIN inventory_batches ib ON ib.id = sm.batch_id
       LEFT JOIN customers c ON c.id = sm.supplier_id
       WHERE sm.movement_type = 'IN'
         AND sm.supplier_id = $1
         AND COALESCE(sm.received_date, ib.received_date, sm.created_at::date) = $2
       ORDER BY sm.created_at ASC`,
      [supplier_id, received_date]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

module.exports = { createBatch, createBulkBatches, getAllBatches, getStockEntries, getStockEntryById, getStockEntrySiblings, updateStockEntry, getBatchById, getBatchesByProduct };
