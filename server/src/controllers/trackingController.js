const pool = require('../config/db');

// Haversine distance in km
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateTotalDistance(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(
      parseFloat(points[i - 1].latitude),
      parseFloat(points[i - 1].longitude),
      parseFloat(points[i].latitude),
      parseFloat(points[i].longitude)
    );
  }
  return Math.round(total * 100) / 100;
}

// POST /api/tracking/start
const startSession = async (req, res, next) => {
  try {
    const spId = req.user.id;

    // Auto-stop stale sessions (no location for 2+ hours)
    await pool.query(
      `UPDATE gps_tracking_sessions
       SET status = 'STOPPED', ended_at = NOW()
       WHERE salesperson_id = $1 AND status = 'ACTIVE'
         AND started_at < NOW() - INTERVAL '2 hours'
         AND NOT EXISTS (
           SELECT 1 FROM gps_location_logs
           WHERE session_id = gps_tracking_sessions.id
             AND recorded_at > NOW() - INTERVAL '2 hours'
         )`,
      [spId]
    );

    // Check for existing active session
    const existing = await pool.query(
      "SELECT id FROM gps_tracking_sessions WHERE salesperson_id = $1 AND status = 'ACTIVE'",
      [spId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Tracking session already active', session_id: existing.rows[0].id });
    }

    const result = await pool.query(
      `INSERT INTO gps_tracking_sessions (salesperson_id, status)
       VALUES ($1, 'ACTIVE') RETURNING *`,
      [spId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// POST /api/tracking/stop
const stopSession = async (req, res, next) => {
  try {
    const spId = req.user.id;

    const session = await pool.query(
      "SELECT id FROM gps_tracking_sessions WHERE salesperson_id = $1 AND status = 'ACTIVE'",
      [spId]
    );
    if (session.rows.length === 0) {
      return res.status(400).json({ error: 'No active tracking session found' });
    }

    const sessionId = session.rows[0].id;

    // Get all points for distance calculation
    const points = await pool.query(
      'SELECT latitude, longitude FROM gps_location_logs WHERE session_id = $1 ORDER BY recorded_at ASC',
      [sessionId]
    );

    const totalDistance = calculateTotalDistance(points.rows);

    const result = await pool.query(
      `UPDATE gps_tracking_sessions
       SET status = 'STOPPED', ended_at = NOW(), total_distance_km = $1
       WHERE id = $2
       RETURNING *`,
      [totalDistance, sessionId]
    );

    const pointCount = points.rows.length;
    const sess = result.rows[0];
    const durationMs = new Date(sess.ended_at) - new Date(sess.started_at);
    const durationHrs = Math.round((durationMs / (1000 * 60 * 60)) * 10) / 10;

    res.json({
      ...sess,
      point_count: pointCount,
      duration_hours: durationHrs,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/tracking/status
const getStatus = async (req, res, next) => {
  try {
    const spId = req.user.id;

    // Auto-stop stale sessions
    await pool.query(
      `UPDATE gps_tracking_sessions
       SET status = 'STOPPED', ended_at = NOW()
       WHERE salesperson_id = $1 AND status = 'ACTIVE'
         AND started_at < NOW() - INTERVAL '2 hours'
         AND NOT EXISTS (
           SELECT 1 FROM gps_location_logs
           WHERE session_id = gps_tracking_sessions.id
             AND recorded_at > NOW() - INTERVAL '2 hours'
         )`,
      [spId]
    );

    const result = await pool.query(
      `SELECT s.*,
              (SELECT COUNT(*)::int FROM gps_location_logs WHERE session_id = s.id) AS point_count
       FROM gps_tracking_sessions s
       WHERE s.salesperson_id = $1 AND s.status = 'ACTIVE'
       LIMIT 1`,
      [spId]
    );

    res.json(result.rows[0] || null);
  } catch (err) {
    next(err);
  }
};

// POST /api/tracking/log
const logLocation = async (req, res, next) => {
  try {
    const spId = req.user.id;
    const { latitude, longitude, accuracy } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }

    const session = await pool.query(
      "SELECT id FROM gps_tracking_sessions WHERE salesperson_id = $1 AND status = 'ACTIVE'",
      [spId]
    );
    if (session.rows.length === 0) {
      return res.status(400).json({ error: 'No active tracking session' });
    }

    await pool.query(
      `INSERT INTO gps_location_logs (session_id, salesperson_id, latitude, longitude, accuracy)
       VALUES ($1, $2, $3, $4, $5)`,
      [session.rows[0].id, spId, latitude, longitude, accuracy || null]
    );

    res.json({ logged: true });
  } catch (err) {
    next(err);
  }
};

// POST /api/tracking/log-batch
const logBatch = async (req, res, next) => {
  try {
    const spId = req.user.id;
    const { points } = req.body;

    if (!Array.isArray(points) || points.length === 0) {
      return res.status(400).json({ error: 'points array is required' });
    }

    const session = await pool.query(
      "SELECT id FROM gps_tracking_sessions WHERE salesperson_id = $1 AND status = 'ACTIVE'",
      [spId]
    );
    if (session.rows.length === 0) {
      return res.status(400).json({ error: 'No active tracking session' });
    }

    const sessionId = session.rows[0].id;

    for (const pt of points) {
      await pool.query(
        `INSERT INTO gps_location_logs (session_id, salesperson_id, latitude, longitude, accuracy, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [sessionId, spId, pt.latitude, pt.longitude, pt.accuracy || null, pt.recorded_at || new Date()]
      );
    }

    res.json({ logged: true, count: points.length });
  } catch (err) {
    next(err);
  }
};

// GET /api/tracking/live — Admin: all active salespersons with latest location
const getLive = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (s.salesperson_id)
              s.salesperson_id,
              u.name AS salesperson_name,
              u.phone,
              l.latitude AS latest_latitude,
              l.longitude AS latest_longitude,
              l.recorded_at AS last_updated,
              s.started_at AS session_started_at,
              s.id AS session_id
       FROM gps_tracking_sessions s
       JOIN users u ON s.salesperson_id = u.id
       JOIN gps_location_logs l ON l.session_id = s.id
       WHERE s.status = 'ACTIVE'
       ORDER BY s.salesperson_id, l.recorded_at DESC`
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/tracking/history/:salesperson_id
const getHistory = async (req, res, next) => {
  try {
    const { salesperson_id } = req.params;
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const sessions = await pool.query(
      `SELECT s.*,
              (SELECT COUNT(*)::int FROM gps_location_logs WHERE session_id = s.id) AS point_count
       FROM gps_tracking_sessions s
       WHERE s.salesperson_id = $1
         AND s.started_at::date = $2
       ORDER BY s.started_at ASC`,
      [salesperson_id, date]
    );

    // Get all points for each session
    const sessionsWithPoints = [];
    for (const sess of sessions.rows) {
      const points = await pool.query(
        'SELECT latitude, longitude, accuracy, recorded_at FROM gps_location_logs WHERE session_id = $1 ORDER BY recorded_at ASC',
        [sess.id]
      );
      sessionsWithPoints.push({
        ...sess,
        points: points.rows,
      });
    }

    res.json(sessionsWithPoints);
  } catch (err) {
    next(err);
  }
};

// GET /api/tracking/route/:session_id
const getRoute = async (req, res, next) => {
  try {
    const { session_id } = req.params;

    const result = await pool.query(
      'SELECT latitude, longitude, accuracy, recorded_at FROM gps_location_logs WHERE session_id = $1 ORDER BY recorded_at ASC',
      [session_id]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/tracking/daily-summary
const getDailySummary = async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT
         u.id AS salesperson_id,
         u.name AS salesperson_name,
         COUNT(s.id)::int AS total_sessions,
         COALESCE(SUM(s.total_distance_km), 0)::decimal(8,2) AS total_distance_km,
         MIN(s.started_at) AS first_start,
         MAX(s.ended_at) AS last_stop,
         (SELECT COUNT(*)::int FROM gps_location_logs gl
          JOIN gps_tracking_sessions gs ON gl.session_id = gs.id
          WHERE gs.salesperson_id = u.id AND gs.started_at::date = $1) AS total_points
       FROM users u
       LEFT JOIN gps_tracking_sessions s ON s.salesperson_id = u.id AND s.started_at::date = $1
       WHERE u.role = 'salesperson' AND u.is_active = true
       GROUP BY u.id, u.name
       ORDER BY u.name`,
      [date]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  startSession,
  stopSession,
  getStatus,
  logLocation,
  logBatch,
  getLive,
  getHistory,
  getRoute,
  getDailySummary,
};
