const pool = require('../config/db');

// Generate next quotation number QTN-0001
const generateQuotationNumber = async () => {
  const result = await pool.query(
    "SELECT quotation_number FROM quotations ORDER BY created_at DESC LIMIT 1"
  );
  if (result.rows.length === 0) return 'QTN-0001';
  const last = result.rows[0].quotation_number;
  const num = parseInt(last.replace('QTN-', ''), 10) + 1;
  return `QTN-${String(num).padStart(4, '0')}`;
};

// POST /api/quotations
const createQuotation = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { customer_id, quotation_date, notes, items } = req.body;
    const salesperson_id = req.user.id;

    if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
    if (!items || items.length === 0) return res.status(400).json({ error: 'At least one item is required' });

    // Verify customer belongs to salesperson
    if (req.user.role === 'salesperson') {
      const custCheck = await client.query(
        'SELECT id FROM customers WHERE id = $1 AND created_by = $2', [customer_id, salesperson_id]
      );
      if (custCheck.rows.length === 0) {
        return res.status(403).json({ error: 'You can only create quotations for your own customers' });
      }
    }

    await client.query('BEGIN');

    const quotation_number = await generateQuotationNumber();

    // Fetch product prices
    let total_amount = 0;
    const itemsWithPrice = [];
    for (const item of items) {
      const prodResult = await client.query('SELECT unit_price FROM products WHERE id = $1', [item.product_id]);
      if (prodResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Product not found: ${item.product_id}` });
      }
      const unit_price = parseFloat(prodResult.rows[0].unit_price);
      const total_price = unit_price * item.quantity;
      total_amount += total_price;
      itemsWithPrice.push({ ...item, unit_price, total_price });
    }

    const qResult = await client.query(
      `INSERT INTO quotations (quotation_number, customer_id, salesperson_id, quotation_date, notes, total_amount)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [quotation_number, customer_id, salesperson_id, quotation_date || new Date(), notes || null, total_amount]
    );
    const quotation = qResult.rows[0];

    for (const item of itemsWithPrice) {
      await client.query(
        `INSERT INTO quotation_items (quotation_id, product_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [quotation.id, item.product_id, item.quantity, item.unit_price, item.total_price]
      );
    }

    await client.query('COMMIT');

    // Return full quotation with items
    const full = await getQuotationFull(quotation.id);
    res.status(201).json(full);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// Helper to get full quotation with items
const getQuotationFull = async (id) => {
  const qResult = await pool.query(
    `SELECT q.*, c.customer_name, c.phone as customer_phone, c.address as customer_address,
            u.name as salesperson_name, u.phone as salesperson_phone,
            r.name as reviewed_by_name
     FROM quotations q
     JOIN customers c ON q.customer_id = c.id
     JOIN users u ON q.salesperson_id = u.id
     LEFT JOIN users r ON q.reviewed_by = r.id
     WHERE q.id = $1`,
    [id]
  );
  if (qResult.rows.length === 0) return null;

  const items = await pool.query(
    `SELECT qi.*, p.product_name, p.product_code, p.unit,
            COALESCE(s.available_stock, 0)::int as available_stock
     FROM quotation_items qi
     JOIN products p ON qi.product_id = p.id
     LEFT JOIN (
       SELECT product_id, SUM(quantity_remaining) as available_stock
       FROM inventory_batches WHERE quantity_remaining > 0
       GROUP BY product_id
     ) s ON qi.product_id = s.product_id
     WHERE qi.quotation_id = $1
     ORDER BY qi.created_at`,
    [id]
  );

  return { ...qResult.rows[0], items: items.rows };
};

// GET /api/quotations
const getAllQuotations = async (req, res, next) => {
  try {
    const { status, customer_id, from_date, to_date } = req.query;
    const params = [];
    const conditions = [];

    // Salesperson sees only their own
    if (req.user.role === 'salesperson') {
      params.push(req.user.id);
      conditions.push(`q.salesperson_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`q.status = $${params.length}`);
    }
    if (customer_id) {
      params.push(customer_id);
      conditions.push(`q.customer_id = $${params.length}`);
    }
    if (from_date) {
      params.push(from_date);
      conditions.push(`q.quotation_date >= $${params.length}`);
    }
    if (to_date) {
      params.push(to_date);
      conditions.push(`q.quotation_date <= $${params.length}`);
    }

    let query = `SELECT q.*, c.customer_name, u.name as salesperson_name,
                        (SELECT COUNT(*) FROM quotation_items qi WHERE qi.quotation_id = q.id) as item_count
                 FROM quotations q
                 JOIN customers c ON q.customer_id = c.id
                 JOIN users u ON q.salesperson_id = u.id`;

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY q.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/quotations/pending — count + list of SUBMITTED quotations
const getPendingQuotations = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT q.*, c.customer_name, u.name as salesperson_name,
              (SELECT COUNT(*) FROM quotation_items qi WHERE qi.quotation_id = q.id) as item_count
       FROM quotations q
       JOIN customers c ON q.customer_id = c.id
       JOIN users u ON q.salesperson_id = u.id
       WHERE q.status = 'SUBMITTED'
       ORDER BY q.quotation_date ASC`
    );
    res.json({ count: result.rows.length, quotations: result.rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/quotations/:id
const getQuotationById = async (req, res, next) => {
  try {
    const quotation = await getQuotationFull(req.params.id);
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    // Salesperson can only see their own
    if (req.user.role === 'salesperson' && quotation.salesperson_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(quotation);
  } catch (err) {
    next(err);
  }
};

// PUT /api/quotations/:id — edit quotation
const updateQuotation = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { customer_id, quotation_date, notes, items } = req.body;

    // Get current quotation
    const current = await client.query('SELECT * FROM quotations WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Quotation not found' });
    }
    const q = current.rows[0];

    // Salesperson can edit only their own, and only in editable states
    if (req.user.role === 'salesperson') {
      if (q.salesperson_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (!['DRAFT', 'SUBMITTED', 'REJECTED'].includes(q.status)) {
        return res.status(400).json({ error: 'Quotation cannot be edited in current status' });
      }
    }

    // Inventory team can edit in UNDER_REVIEW
    if (req.user.role === 'inventory') {
      if (!['UNDER_REVIEW'].includes(q.status)) {
        return res.status(400).json({ error: 'Quotation can only be edited during review' });
      }
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    await client.query('BEGIN');

    // Calculate totals with fresh prices
    let total_amount = 0;
    const itemsWithPrice = [];
    for (const item of items) {
      const prodResult = await client.query('SELECT unit_price FROM products WHERE id = $1', [item.product_id]);
      if (prodResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Product not found: ${item.product_id}` });
      }
      const unit_price = item.unit_price !== undefined ? parseFloat(item.unit_price) : parseFloat(prodResult.rows[0].unit_price);
      const total_price = unit_price * item.quantity;
      total_amount += total_price;
      itemsWithPrice.push({ ...item, unit_price, total_price });
    }

    // Reset status to DRAFT if salesperson edits a REJECTED quotation
    let newStatus = q.status;
    if (req.user.role === 'salesperson' && q.status === 'REJECTED') {
      newStatus = 'DRAFT';
    }

    await client.query(
      `UPDATE quotations SET customer_id = COALESCE($1, customer_id), quotation_date = COALESCE($2, quotation_date),
       notes = $3, total_amount = $4, status = $5, rejection_reason = CASE WHEN $5 = 'DRAFT' THEN NULL ELSE rejection_reason END,
       updated_at = NOW()
       WHERE id = $6`,
      [customer_id || q.customer_id, quotation_date || q.quotation_date, notes !== undefined ? notes : q.notes, total_amount, newStatus, id]
    );

    // Replace items
    await client.query('DELETE FROM quotation_items WHERE quotation_id = $1', [id]);
    for (const item of itemsWithPrice) {
      await client.query(
        `INSERT INTO quotation_items (quotation_id, product_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, item.product_id, item.quantity, item.unit_price, item.total_price]
      );
    }

    await client.query('COMMIT');

    const full = await getQuotationFull(id);
    res.json(full);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// PATCH /api/quotations/:id/submit
const submitQuotation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const q = await pool.query('SELECT * FROM quotations WHERE id = $1', [id]);
    if (q.rows.length === 0) return res.status(404).json({ error: 'Quotation not found' });

    if (req.user.role === 'salesperson' && q.rows[0].salesperson_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (q.rows[0].status !== 'DRAFT') {
      return res.status(400).json({ error: 'Only DRAFT quotations can be submitted' });
    }

    // Check has items
    const items = await pool.query('SELECT COUNT(*) FROM quotation_items WHERE quotation_id = $1', [id]);
    if (parseInt(items.rows[0].count) === 0) {
      return res.status(400).json({ error: 'Cannot submit quotation with no items' });
    }

    await pool.query(
      "UPDATE quotations SET status = 'SUBMITTED', updated_at = NOW() WHERE id = $1",
      [id]
    );

    const full = await getQuotationFull(id);
    res.json(full);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/quotations/:id/recall
const recallQuotation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const q = await pool.query('SELECT * FROM quotations WHERE id = $1', [id]);
    if (q.rows.length === 0) return res.status(404).json({ error: 'Quotation not found' });

    if (req.user.role === 'salesperson' && q.rows[0].salesperson_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (q.rows[0].status !== 'SUBMITTED') {
      return res.status(400).json({ error: 'Only SUBMITTED quotations can be recalled' });
    }

    await pool.query(
      "UPDATE quotations SET status = 'DRAFT', updated_at = NOW() WHERE id = $1",
      [id]
    );

    const full = await getQuotationFull(id);
    res.json(full);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/quotations/:id/review — inventory starts review
const startReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const q = await pool.query('SELECT * FROM quotations WHERE id = $1', [id]);
    if (q.rows.length === 0) return res.status(404).json({ error: 'Quotation not found' });

    if (q.rows[0].status !== 'SUBMITTED') {
      return res.status(400).json({ error: 'Only SUBMITTED quotations can be reviewed' });
    }

    await pool.query(
      "UPDATE quotations SET status = 'UNDER_REVIEW', reviewed_by = $1, updated_at = NOW() WHERE id = $2",
      [req.user.id, id]
    );

    const full = await getQuotationFull(id);
    res.json(full);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/quotations/:id/approve
const approveQuotation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const q = await pool.query('SELECT * FROM quotations WHERE id = $1', [id]);
    if (q.rows.length === 0) return res.status(404).json({ error: 'Quotation not found' });

    if (q.rows[0].status !== 'UNDER_REVIEW') {
      return res.status(400).json({ error: 'Only quotations under review can be approved' });
    }

    await pool.query(
      "UPDATE quotations SET status = 'APPROVED', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW() WHERE id = $2",
      [req.user.id, id]
    );

    const full = await getQuotationFull(id);
    res.json(full);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/quotations/:id/reject
const rejectQuotation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;

    if (!rejection_reason || rejection_reason.trim().length < 10) {
      return res.status(400).json({ error: 'Rejection reason is required (minimum 10 characters)' });
    }

    const q = await pool.query('SELECT * FROM quotations WHERE id = $1', [id]);
    if (q.rows.length === 0) return res.status(404).json({ error: 'Quotation not found' });

    if (q.rows[0].status !== 'UNDER_REVIEW') {
      return res.status(400).json({ error: 'Only quotations under review can be rejected' });
    }

    await pool.query(
      "UPDATE quotations SET status = 'REJECTED', rejection_reason = $1, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW() WHERE id = $3",
      [rejection_reason.trim(), req.user.id, id]
    );

    const full = await getQuotationFull(id);
    res.json(full);
  } catch (err) {
    next(err);
  }
};

// POST /api/quotations/:id/convert — convert to order with FIFO
const convertToOrder = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const q = await client.query('SELECT * FROM quotations WHERE id = $1', [id]);
    if (q.rows.length === 0) return res.status(404).json({ error: 'Quotation not found' });
    if (q.rows[0].status !== 'APPROVED') {
      return res.status(400).json({ error: 'Only APPROVED quotations can be converted to orders' });
    }

    const qItems = await client.query(
      `SELECT qi.*, p.product_name FROM quotation_items qi JOIN products p ON qi.product_id = p.id WHERE qi.quotation_id = $1`,
      [id]
    );

    await client.query('BEGIN');

    // Generate invoice number
    const lastOrder = await client.query("SELECT invoice_number FROM orders ORDER BY created_at DESC LIMIT 1");
    let invoiceNum = 'INV-0001';
    if (lastOrder.rows.length > 0) {
      const num = parseInt(lastOrder.rows[0].invoice_number.replace('INV-', ''), 10) + 1;
      invoiceNum = `INV-${String(num).padStart(4, '0')}`;
    }

    // Create order
    const orderResult = await client.query(
      `INSERT INTO orders (invoice_number, customer_id, order_date, status, quotation_id)
       VALUES ($1, $2, CURRENT_DATE, 'completed', $3) RETURNING *`,
      [invoiceNum, q.rows[0].customer_id, id]
    );
    const order = orderResult.rows[0];

    // FIFO deduction per item
    const insufficientItems = [];
    for (const item of qItems.rows) {
      const batches = await client.query(
        `SELECT id, batch_number, quantity_remaining FROM inventory_batches
         WHERE product_id = $1 AND quantity_remaining > 0
         ORDER BY received_date ASC, created_at ASC FOR UPDATE`,
        [item.product_id]
      );

      let remaining = item.quantity;
      let totalAvailable = batches.rows.reduce((sum, b) => sum + b.quantity_remaining, 0);

      if (totalAvailable < remaining) {
        insufficientItems.push({
          product_name: item.product_name,
          required: item.quantity,
          available: totalAvailable,
        });
        continue;
      }

      for (const batch of batches.rows) {
        if (remaining <= 0) break;
        const deduct = Math.min(remaining, batch.quantity_remaining);

        await client.query(
          'UPDATE inventory_batches SET quantity_remaining = quantity_remaining - $1 WHERE id = $2',
          [deduct, batch.id]
        );

        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity) VALUES ($1, $2, $3)`,
          [order.id, item.product_id, deduct]
        );

        await client.query(
          `INSERT INTO stock_movements (product_id, batch_id, quantity, movement_type, reference_type, reference_id)
           VALUES ($1, $2, $3, 'OUT', 'ORDER', $4)`,
          [item.product_id, batch.id, deduct, order.id]
        );

        remaining -= deduct;
      }
    }

    if (insufficientItems.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Insufficient stock for some items',
        insufficient_items: insufficientItems,
      });
    }

    // Update quotation status
    await client.query(
      "UPDATE quotations SET status = 'CONVERTED_TO_ORDER', reviewed_at = NOW(), updated_at = NOW() WHERE id = $1",
      [id]
    );

    await client.query('COMMIT');

    res.json({ message: 'Order created successfully', order_id: order.id, invoice_number: invoiceNum });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// POST /api/quotations/:id/duplicate
const duplicateQuotation = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const q = await client.query('SELECT * FROM quotations WHERE id = $1', [id]);
    if (q.rows.length === 0) return res.status(404).json({ error: 'Quotation not found' });

    const items = await client.query('SELECT * FROM quotation_items WHERE quotation_id = $1', [id]);

    await client.query('BEGIN');

    const quotation_number = await generateQuotationNumber();
    const orig = q.rows[0];

    const newQ = await client.query(
      `INSERT INTO quotations (quotation_number, customer_id, salesperson_id, quotation_date, notes, total_amount)
       VALUES ($1, $2, $3, CURRENT_DATE, $4, $5) RETURNING *`,
      [quotation_number, orig.customer_id, req.user.id, orig.notes, orig.total_amount]
    );

    for (const item of items.rows) {
      await client.query(
        `INSERT INTO quotation_items (quotation_id, product_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [newQ.rows[0].id, item.product_id, item.quantity, item.unit_price, item.total_price]
      );
    }

    await client.query('COMMIT');

    const full = await getQuotationFull(newQ.rows[0].id);
    res.status(201).json(full);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// GET /api/quotations/:id/stock-check
const stockCheck = async (req, res, next) => {
  try {
    const items = await pool.query(
      `SELECT qi.product_id, p.product_name, qi.quantity as required_qty,
              COALESCE(s.available, 0)::int as available_qty,
              COALESCE(s.available, 0) >= qi.quantity as is_sufficient
       FROM quotation_items qi
       JOIN products p ON qi.product_id = p.id
       LEFT JOIN (
         SELECT product_id, SUM(quantity_remaining) as available
         FROM inventory_batches WHERE quantity_remaining > 0 GROUP BY product_id
       ) s ON qi.product_id = s.product_id
       WHERE qi.quotation_id = $1`,
      [req.params.id]
    );
    res.json(items.rows);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createQuotation,
  getAllQuotations,
  getPendingQuotations,
  getQuotationById,
  updateQuotation,
  submitQuotation,
  recallQuotation,
  startReview,
  approveQuotation,
  rejectQuotation,
  convertToOrder,
  duplicateQuotation,
  stockCheck,
};
