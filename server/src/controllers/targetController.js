const pool = require('../config/db');

// Auto-calculate period_end from period_type + period_start
const calcPeriodEnd = (type, start) => {
  const d = new Date(start);
  switch (type) {
    case 'MONTHLY': d.setMonth(d.getMonth() + 1); break;
    case 'QUARTERLY': d.setMonth(d.getMonth() + 3); break;
    case 'HALF_YEARLY': d.setMonth(d.getMonth() + 6); break;
    case 'YEARLY': d.setFullYear(d.getFullYear() + 1); break;
  }
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

// Lazy status update — check expired targets
const updateExpiredTargets = async () => {
  await pool.query(`
    UPDATE sales_targets SET status = 'COMPLETED', updated_at = NOW()
    WHERE status = 'ACTIVE' AND period_end < CURRENT_DATE AND achieved_amount >= target_amount
  `);
  await pool.query(`
    UPDATE sales_targets SET status = 'MISSED', updated_at = NOW()
    WHERE status = 'ACTIVE' AND period_end < CURRENT_DATE AND achieved_amount < target_amount
  `);
};

// POST /api/targets
const createTarget = async (req, res, next) => {
  try {
    const { salesperson_id, period_type, period_start, target_amount } = req.body;

    if (!salesperson_id || !period_type || !period_start || !target_amount) {
      return res.status(400).json({ error: 'salesperson_id, period_type, period_start, and target_amount are required' });
    }

    if (!['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'].includes(period_type)) {
      return res.status(400).json({ error: 'Invalid period_type' });
    }

    // Verify salesperson exists
    const spCheck = await pool.query("SELECT id FROM users WHERE id = $1 AND role = 'salesperson'", [salesperson_id]);
    if (spCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Salesperson not found' });
    }

    const period_end = calcPeriodEnd(period_type, period_start);

    const result = await pool.query(
      `INSERT INTO sales_targets (salesperson_id, period_type, period_start, period_end, target_amount, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [salesperson_id, period_type, period_start, period_end, target_amount, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A target already exists for this salesperson, period type, and start date' });
    }
    next(err);
  }
};

// GET /api/targets
const getAllTargets = async (req, res, next) => {
  try {
    await updateExpiredTargets();

    const { salesperson_id, period_type, status } = req.query;
    const params = [];
    const conditions = [];

    // Salesperson sees only their own
    if (req.user.role === 'salesperson') {
      params.push(req.user.id);
      conditions.push(`t.salesperson_id = $${params.length}`);
    } else if (salesperson_id) {
      params.push(salesperson_id);
      conditions.push(`t.salesperson_id = $${params.length}`);
    }

    if (period_type) {
      params.push(period_type);
      conditions.push(`t.period_type = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`t.status = $${params.length}`);
    }

    let query = `SELECT t.*, u.name as salesperson_name, u.phone as salesperson_phone
                 FROM sales_targets t
                 JOIN users u ON t.salesperson_id = u.id`;
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY t.period_start DESC, u.name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/targets/my-progress — salesperson's active targets
const getMyProgress = async (req, res, next) => {
  try {
    await updateExpiredTargets();

    // Get active targets — recalculate achieved from actual orders
    const targets = await pool.query(
      `SELECT t.* FROM sales_targets t
       WHERE t.salesperson_id = $1 AND t.status = 'ACTIVE'
       ORDER BY t.period_end ASC`,
      [req.user.id]
    );

    const result = [];
    for (const target of targets.rows) {
      // Calculate achieved from converted orders in this period
      const achieved = await pool.query(
        `SELECT COALESCE(SUM(q.total_amount), 0) as total
         FROM quotations q
         WHERE q.salesperson_id = $1
           AND q.status = 'CONVERTED_TO_ORDER'
           AND q.updated_at >= $2
           AND q.updated_at <= ($3::date + interval '1 day')`,
        [req.user.id, target.period_start, target.period_end]
      );

      const achieved_amount = parseFloat(achieved.rows[0].total);

      // Update achieved in DB
      await pool.query(
        'UPDATE sales_targets SET achieved_amount = $1, updated_at = NOW() WHERE id = $2',
        [achieved_amount, target.id]
      );

      // Get contributing orders
      const orders = await pool.query(
        `SELECT q.quotation_number, q.total_amount, q.updated_at as converted_at,
                c.customer_name
         FROM quotations q
         JOIN customers c ON q.customer_id = c.id
         WHERE q.salesperson_id = $1
           AND q.status = 'CONVERTED_TO_ORDER'
           AND q.updated_at >= $2
           AND q.updated_at <= ($3::date + interval '1 day')
         ORDER BY q.updated_at DESC`,
        [req.user.id, target.period_start, target.period_end]
      );

      const days_remaining = Math.max(0, Math.ceil((new Date(target.period_end) - new Date()) / (1000 * 60 * 60 * 24)));
      const percentage = target.target_amount > 0 ? Math.round((achieved_amount / parseFloat(target.target_amount)) * 100) : 0;

      result.push({
        ...target,
        achieved_amount,
        remaining_amount: Math.max(0, parseFloat(target.target_amount) - achieved_amount),
        percentage,
        days_remaining,
        contributing_orders: orders.rows,
      });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
};

// GET /api/targets/report — admin report
const getTargetReport = async (req, res, next) => {
  try {
    await updateExpiredTargets();

    const { period_type, period_start } = req.query;
    const params = [];
    const conditions = [];

    if (period_type) {
      params.push(period_type);
      conditions.push(`t.period_type = $${params.length}`);
    }
    if (period_start) {
      params.push(period_start);
      conditions.push(`t.period_start = $${params.length}`);
    }

    let query = `SELECT t.*, u.name as salesperson_name
                 FROM sales_targets t
                 JOIN users u ON t.salesperson_id = u.id`;
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY CASE WHEN t.target_amount > 0 THEN t.achieved_amount / t.target_amount ELSE 0 END DESC';

    const result = await pool.query(query, params);

    // Recalculate achieved for each
    const targets = [];
    for (const t of result.rows) {
      const achieved = await pool.query(
        `SELECT COALESCE(SUM(q.total_amount), 0) as total
         FROM quotations q
         WHERE q.salesperson_id = $1
           AND q.status = 'CONVERTED_TO_ORDER'
           AND q.updated_at >= $2
           AND q.updated_at <= ($3::date + interval '1 day')`,
        [t.salesperson_id, t.period_start, t.period_end]
      );
      const achieved_amount = parseFloat(achieved.rows[0].total);
      const percentage = parseFloat(t.target_amount) > 0 ? Math.round((achieved_amount / parseFloat(t.target_amount)) * 100) : 0;
      targets.push({ ...t, achieved_amount, percentage });
    }

    const total_target = targets.reduce((s, t) => s + parseFloat(t.target_amount), 0);
    const total_achieved = targets.reduce((s, t) => s + t.achieved_amount, 0);

    res.json({
      targets,
      summary: {
        total_target,
        total_achieved,
        overall_percentage: total_target > 0 ? Math.round((total_achieved / total_target) * 100) : 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/targets/:id
const updateTarget = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { target_amount } = req.body;

    if (!target_amount || target_amount <= 0) {
      return res.status(400).json({ error: 'target_amount must be positive' });
    }

    const current = await pool.query('SELECT * FROM sales_targets WHERE id = $1', [id]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'Target not found' });

    const result = await pool.query(
      'UPDATE sales_targets SET target_amount = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [target_amount, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/targets/:id
const deleteTarget = async (req, res, next) => {
  try {
    const { id } = req.params;
    const current = await pool.query('SELECT * FROM sales_targets WHERE id = $1', [id]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'Target not found' });

    if (parseFloat(current.rows[0].achieved_amount) > 0) {
      return res.status(400).json({ error: 'Cannot delete target with achievements' });
    }

    await pool.query('DELETE FROM sales_targets WHERE id = $1', [id]);
    res.json({ message: 'Target deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { createTarget, getAllTargets, getMyProgress, getTargetReport, updateTarget, deleteTarget };
