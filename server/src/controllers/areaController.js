const pool = require('../config/db');

// --- Geo-fence algorithms ---

function isPointInPolygon(lat, lng, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > lng) !== (yj > lng))
      && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isPointInArea(lat, lng, area) {
  if (area.boundary_type === 'POLYGON') {
    return isPointInPolygon(lat, lng, area.boundary_polygon);
  }
  if (area.boundary_type === 'CIRCLE') {
    return haversineDistance(lat, lng, parseFloat(area.center_latitude), parseFloat(area.center_longitude)) <= parseFloat(area.radius_km);
  }
  return false;
}

// Exported for use in customerController
const checkGeoFence = async (salespersonId, latitude, longitude) => {
  const areas = await pool.query(
    `SELECT sa.* FROM sales_areas sa
     JOIN salesperson_areas spa ON sa.id = spa.area_id
     WHERE spa.salesperson_id = $1 AND spa.is_active = true AND sa.is_active = true`,
    [salespersonId]
  );

  // No areas assigned = no restriction
  if (areas.rows.length === 0) {
    return { allowed: true, matching_area: null };
  }

  for (const area of areas.rows) {
    if (isPointInArea(latitude, longitude, area)) {
      return { allowed: true, matching_area: area.area_name };
    }
  }

  return { allowed: false, matching_area: null };
};

// POST /api/areas
const createArea = async (req, res, next) => {
  try {
    const { area_name, description, boundary_type, boundary_polygon, center_latitude, center_longitude, radius_km } = req.body;

    if (!area_name || !area_name.trim()) {
      return res.status(400).json({ error: 'area_name is required' });
    }
    if (!['POLYGON', 'CIRCLE'].includes(boundary_type)) {
      return res.status(400).json({ error: 'boundary_type must be POLYGON or CIRCLE' });
    }

    if (boundary_type === 'POLYGON') {
      if (!boundary_polygon || !Array.isArray(boundary_polygon) || boundary_polygon.length < 3) {
        return res.status(400).json({ error: 'Polygon requires at least 3 coordinate pairs' });
      }
    }

    if (boundary_type === 'CIRCLE') {
      if (center_latitude == null || center_longitude == null || !radius_km) {
        return res.status(400).json({ error: 'Circle requires center_latitude, center_longitude, and radius_km' });
      }
    }

    const result = await pool.query(
      `INSERT INTO sales_areas (area_name, description, boundary_type, boundary_polygon, center_latitude, center_longitude, radius_km, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        area_name.trim(),
        description?.trim() || null,
        boundary_type,
        boundary_type === 'POLYGON' ? JSON.stringify(boundary_polygon) : null,
        boundary_type === 'CIRCLE' ? center_latitude : null,
        boundary_type === 'CIRCLE' ? center_longitude : null,
        boundary_type === 'CIRCLE' ? radius_km : null,
        req.user.id,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// GET /api/areas
const getAllAreas = async (req, res, next) => {
  try {
    let query, params = [];

    if (req.user.role === 'salesperson') {
      query = `SELECT sa.*, COUNT(spa2.id) as salesperson_count
               FROM sales_areas sa
               JOIN salesperson_areas spa ON sa.id = spa.area_id AND spa.salesperson_id = $1 AND spa.is_active = true
               LEFT JOIN salesperson_areas spa2 ON sa.id = spa2.area_id AND spa2.is_active = true
               WHERE sa.is_active = true
               GROUP BY sa.id
               ORDER BY sa.area_name`;
      params = [req.user.id];
    } else {
      query = `SELECT sa.*, COUNT(spa.id) as salesperson_count
               FROM sales_areas sa
               LEFT JOIN salesperson_areas spa ON sa.id = spa.area_id AND spa.is_active = true
               WHERE sa.is_active = true
               GROUP BY sa.id
               ORDER BY sa.area_name`;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// PUT /api/areas/:id
const updateArea = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { area_name, description, boundary_type, boundary_polygon, center_latitude, center_longitude, radius_km } = req.body;

    const current = await pool.query('SELECT * FROM sales_areas WHERE id = $1 AND is_active = true', [id]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'Area not found' });

    const type = boundary_type || current.rows[0].boundary_type;

    const result = await pool.query(
      `UPDATE sales_areas SET
        area_name = COALESCE($1, area_name),
        description = COALESCE($2, description),
        boundary_type = $3,
        boundary_polygon = $4,
        center_latitude = $5,
        center_longitude = $6,
        radius_km = $7
       WHERE id = $8
       RETURNING *`,
      [
        area_name?.trim(),
        description?.trim(),
        type,
        type === 'POLYGON' ? JSON.stringify(boundary_polygon || current.rows[0].boundary_polygon) : null,
        type === 'CIRCLE' ? (center_latitude ?? current.rows[0].center_latitude) : null,
        type === 'CIRCLE' ? (center_longitude ?? current.rows[0].center_longitude) : null,
        type === 'CIRCLE' ? (radius_km ?? current.rows[0].radius_km) : null,
        id,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/areas/:id (soft delete)
const deleteArea = async (req, res, next) => {
  try {
    const { id } = req.params;

    const current = await pool.query('SELECT * FROM sales_areas WHERE id = $1 AND is_active = true', [id]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'Area not found' });

    const assignments = await pool.query(
      'SELECT COUNT(*) FROM salesperson_areas WHERE area_id = $1 AND is_active = true', [id]
    );

    await pool.query('UPDATE sales_areas SET is_active = false WHERE id = $1', [id]);
    await pool.query('UPDATE salesperson_areas SET is_active = false WHERE area_id = $1', [id]);

    res.json({
      message: 'Area deleted',
      had_assignments: parseInt(assignments.rows[0].count) > 0,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/areas/assign
const assignArea = async (req, res, next) => {
  try {
    const { salesperson_id, area_id } = req.body;

    if (!salesperson_id || !area_id) {
      return res.status(400).json({ error: 'salesperson_id and area_id are required' });
    }

    const sp = await pool.query("SELECT id FROM users WHERE id = $1 AND role = 'salesperson'", [salesperson_id]);
    if (sp.rows.length === 0) return res.status(400).json({ error: 'Salesperson not found' });

    const area = await pool.query('SELECT id FROM sales_areas WHERE id = $1 AND is_active = true', [area_id]);
    if (area.rows.length === 0) return res.status(400).json({ error: 'Area not found' });

    // Upsert — reactivate if previously deactivated
    const result = await pool.query(
      `INSERT INTO salesperson_areas (salesperson_id, area_id, assigned_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (salesperson_id, area_id) DO UPDATE SET is_active = true, assigned_at = NOW(), assigned_by = $3
       RETURNING *`,
      [salesperson_id, area_id, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/areas/assign/:id
const removeAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE salesperson_areas SET is_active = false WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });

    res.json({ message: 'Assignment removed' });
  } catch (err) {
    next(err);
  }
};

// GET /api/areas/assignments
const getAssignments = async (req, res, next) => {
  try {
    const { area_id, salesperson_id } = req.query;
    const params = [];
    const conditions = ['spa.is_active = true'];

    if (area_id) {
      params.push(area_id);
      conditions.push(`spa.area_id = $${params.length}`);
    }
    if (salesperson_id) {
      params.push(salesperson_id);
      conditions.push(`spa.salesperson_id = $${params.length}`);
    }

    const result = await pool.query(
      `SELECT spa.*, u.name as salesperson_name, u.phone as salesperson_phone, sa.area_name
       FROM salesperson_areas spa
       JOIN users u ON spa.salesperson_id = u.id
       JOIN sales_areas sa ON spa.area_id = sa.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY sa.area_name, u.name`,
      params
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/areas/salesperson/:id
const getSalespersonAreas = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT sa.* FROM sales_areas sa
       JOIN salesperson_areas spa ON sa.id = spa.area_id
       WHERE spa.salesperson_id = $1 AND spa.is_active = true AND sa.is_active = true
       ORDER BY sa.area_name`,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// POST /api/areas/check-location
const checkLocation = async (req, res, next) => {
  try {
    const { latitude, longitude, salesperson_id } = req.body;

    if (latitude == null || longitude == null || !salesperson_id) {
      return res.status(400).json({ error: 'latitude, longitude, and salesperson_id are required' });
    }

    const result = await checkGeoFence(salesperson_id, latitude, longitude);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// GET /api/areas/report
const getAreaReport = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT sa.id, sa.area_name, sa.boundary_type,
              COUNT(DISTINCT spa.salesperson_id) as salesperson_count,
              COUNT(DISTINCT c.id) as customer_count,
              COALESCE(SUM(
                CASE WHEN q.status = 'CONVERTED_TO_ORDER' THEN q.total_amount ELSE 0 END
              ), 0) as total_revenue
       FROM sales_areas sa
       LEFT JOIN salesperson_areas spa ON sa.id = spa.area_id AND spa.is_active = true
       LEFT JOIN customers c ON c.created_by = spa.salesperson_id AND c.latitude IS NOT NULL
       LEFT JOIN quotations q ON q.salesperson_id = spa.salesperson_id AND q.customer_id = c.id
       WHERE sa.is_active = true
       GROUP BY sa.id
       ORDER BY sa.area_name`
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createArea, getAllAreas, updateArea, deleteArea,
  assignArea, removeAssignment, getAssignments, getSalespersonAreas,
  checkLocation, checkGeoFence, getAreaReport,
};
