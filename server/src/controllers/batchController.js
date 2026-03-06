const pool = require('../config/db');

const createBatch = async (req, res, next) => {
  try {
    const { product_id, batch_number, quantity_received, received_date } = req.body;

    // Validate required fields
    if (!product_id || !batch_number || quantity_received == null || !received_date) {
      return res.status(400).json({ error: 'product_id, batch_number, quantity_received, and received_date are required' });
    }

    if (quantity_received <= 0) {
      return res.status(400).json({ error: 'quantity_received must be greater than 0' });
    }

    // Validate product exists
    const productCheck = await pool.query('SELECT id FROM products WHERE id = $1', [product_id]);
    if (productCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Product not found' });
    }

    // Use transaction: insert batch + stock movement
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
        `INSERT INTO stock_movements (product_id, batch_id, quantity, movement_type, reference_type, reference_id)
         VALUES ($1, $2, $3, 'IN', 'BATCH', $2)`,
        [product_id, batch.id, quantity_received]
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
       WHERE b.product_id = $1 AND b.quantity_remaining > 0
       ORDER BY b.received_date ASC`,
      [product_id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

module.exports = { createBatch, getAllBatches, getBatchById, getBatchesByProduct };
