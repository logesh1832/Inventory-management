const pool = require('../config/db');

// Haversine distance in meters
function haversineDistanceM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Auto-close visits older than 4 hours
async function autoCloseStaleVisits(spId) {
  await pool.query(
    `UPDATE customer_visits
     SET check_out_at = check_in_at + INTERVAL '4 hours',
         duration_minutes = 240,
         notes = COALESCE(notes || E'\n', '') || 'Auto-closed: exceeded maximum visit duration'
     WHERE salesperson_id = $1 AND check_out_at IS NULL
       AND check_in_at < NOW() - INTERVAL '4 hours'`,
    [spId]
  );
}

// POST /api/visits/check-in
const checkIn = async (req, res, next) => {
  try {
    const spId = req.user.id;
    const { customer_id, latitude, longitude, visit_purpose } = req.body;

    if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
    if (!latitude || !longitude) return res.status(400).json({ error: 'GPS location is required' });
    if (!visit_purpose) return res.status(400).json({ error: 'visit_purpose is required' });

    // Auto-close stale visits
    await autoCloseStaleVisits(spId);

    // Check no active visit
    const active = await pool.query(
      'SELECT id FROM customer_visits WHERE salesperson_id = $1 AND check_out_at IS NULL',
      [spId]
    );
    if (active.rows.length > 0) {
      return res.status(400).json({ error: 'You already have an active visit. End it first.' });
    }

    // Validate customer
    const cust = await pool.query(
      'SELECT id, customer_name, latitude, longitude FROM customers WHERE id = $1 AND created_by = $2',
      [customer_id, spId]
    );
    if (cust.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found or not assigned to you' });
    }

    const customer = cust.rows[0];
    if (!customer.latitude || !customer.longitude) {
      return res.status(400).json({ error: 'Customer does not have a GPS location saved' });
    }

    // Calculate distance
    const distance = haversineDistanceM(
      parseFloat(latitude), parseFloat(longitude),
      parseFloat(customer.latitude), parseFloat(customer.longitude)
    );
    const distanceRounded = Math.round(distance * 100) / 100;
    const locationVerified = distance <= 500;

    // Link to active tracking session if exists
    const session = await pool.query(
      "SELECT id FROM gps_tracking_sessions WHERE salesperson_id = $1 AND status = 'ACTIVE' LIMIT 1",
      [spId]
    );
    const trackingSessionId = session.rows.length > 0 ? session.rows[0].id : null;

    const result = await pool.query(
      `INSERT INTO customer_visits
        (salesperson_id, customer_id, tracking_session_id, check_in_latitude, check_in_longitude,
         customer_latitude, customer_longitude, distance_from_customer_m, location_verified, visit_purpose)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [spId, customer_id, trackingSessionId, latitude, longitude,
       customer.latitude, customer.longitude, distanceRounded, locationVerified, visit_purpose]
    );

    const visit = result.rows[0];
    visit.customer_name = customer.customer_name;

    let warning = null;
    if (!locationVerified) {
      warning = `You are ${Math.round(distance)}m away from ${customer.customer_name}. Visit recorded but location not verified.`;
    }

    res.status(201).json({ ...visit, warning });
  } catch (err) {
    next(err);
  }
};

// POST /api/visits/check-out/:visit_id
const checkOut = async (req, res, next) => {
  try {
    const spId = req.user.id;
    const { visit_id } = req.params;
    const { notes, outcome } = req.body;

    const visit = await pool.query(
      'SELECT * FROM customer_visits WHERE id = $1 AND salesperson_id = $2',
      [visit_id, spId]
    );
    if (visit.rows.length === 0) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    if (visit.rows[0].check_out_at) {
      return res.status(400).json({ error: 'Visit already ended' });
    }

    const result = await pool.query(
      `UPDATE customer_visits
       SET check_out_at = NOW(),
           duration_minutes = EXTRACT(EPOCH FROM (NOW() - check_in_at)) / 60,
           notes = $1,
           outcome = $2
       WHERE id = $3
       RETURNING *`,
      [notes || null, outcome || null, visit_id]
    );

    // Attach customer name
    const cust = await pool.query('SELECT customer_name FROM customers WHERE id = $1', [result.rows[0].customer_id]);
    const updated = result.rows[0];
    updated.customer_name = cust.rows[0]?.customer_name;

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

// GET /api/visits/active
const getActive = async (req, res, next) => {
  try {
    const spId = req.user.id;
    await autoCloseStaleVisits(spId);

    const result = await pool.query(
      `SELECT v.*, c.customer_name
       FROM customer_visits v
       JOIN customers c ON v.customer_id = c.id
       WHERE v.salesperson_id = $1 AND v.check_out_at IS NULL
       LIMIT 1`,
      [spId]
    );

    res.json(result.rows[0] || null);
  } catch (err) {
    next(err);
  }
};

// GET /api/visits/my-visits
const getMyVisits = async (req, res, next) => {
  try {
    const spId = req.user.id;
    const { from_date, to_date, customer_id } = req.query;

    let query = `
      SELECT v.*, c.customer_name
      FROM customer_visits v
      JOIN customers c ON v.customer_id = c.id
      WHERE v.salesperson_id = $1`;
    const params = [spId];
    let idx = 2;

    if (from_date) {
      query += ` AND v.check_in_at >= $${idx}`;
      params.push(from_date);
      idx++;
    }
    if (to_date) {
      query += ` AND v.check_in_at < ($${idx}::date + INTERVAL '1 day')`;
      params.push(to_date);
      idx++;
    }
    if (customer_id) {
      query += ` AND v.customer_id = $${idx}`;
      params.push(customer_id);
      idx++;
    }

    query += ' ORDER BY v.check_in_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/visits — Admin: all visits
const getAllVisits = async (req, res, next) => {
  try {
    const { salesperson_id, customer_id, from_date, to_date, location_verified } = req.query;

    let query = `
      SELECT v.*, c.customer_name, u.name AS salesperson_name
      FROM customer_visits v
      JOIN customers c ON v.customer_id = c.id
      JOIN users u ON v.salesperson_id = u.id
      WHERE 1=1`;
    const params = [];
    let idx = 1;

    if (salesperson_id) {
      query += ` AND v.salesperson_id = $${idx}`;
      params.push(salesperson_id);
      idx++;
    }
    if (customer_id) {
      query += ` AND v.customer_id = $${idx}`;
      params.push(customer_id);
      idx++;
    }
    if (from_date) {
      query += ` AND v.check_in_at >= $${idx}`;
      params.push(from_date);
      idx++;
    }
    if (to_date) {
      query += ` AND v.check_in_at < ($${idx}::date + INTERVAL '1 day')`;
      params.push(to_date);
      idx++;
    }
    if (location_verified === 'true' || location_verified === 'false') {
      query += ` AND v.location_verified = $${idx}`;
      params.push(location_verified === 'true');
      idx++;
    }

    query += ' ORDER BY v.check_in_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/visits/summary — Admin: visit summary
const getSummary = async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const { salesperson_id } = req.query;

    let query = `
      SELECT
        u.id AS salesperson_id,
        u.name AS salesperson_name,
        COUNT(v.id)::int AS total_visits,
        COUNT(v.id) FILTER (WHERE v.location_verified = true)::int AS verified_visits,
        ROUND(AVG(v.duration_minutes))::int AS avg_duration_minutes,
        COALESCE(SUM(v.duration_minutes), 0)::int AS total_duration_minutes,
        COUNT(DISTINCT v.customer_id)::int AS unique_customers
      FROM users u
      LEFT JOIN customer_visits v ON v.salesperson_id = u.id AND v.check_in_at::date = $1
      WHERE u.role = 'salesperson' AND u.is_active = true`;
    const params = [date];
    let idx = 2;

    if (salesperson_id) {
      query += ` AND u.id = $${idx}`;
      params.push(salesperson_id);
      idx++;
    }

    query += ' GROUP BY u.id, u.name ORDER BY u.name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/visits/customer/:customer_id
const getCustomerVisits = async (req, res, next) => {
  try {
    const { customer_id } = req.params;

    const result = await pool.query(
      `SELECT v.*, u.name AS salesperson_name
       FROM customer_visits v
       JOIN users u ON v.salesperson_id = u.id
       WHERE v.customer_id = $1
       ORDER BY v.check_in_at DESC`,
      [customer_id]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  checkIn,
  checkOut,
  getActive,
  getMyVisits,
  getAllVisits,
  getSummary,
  getCustomerVisits,
};
