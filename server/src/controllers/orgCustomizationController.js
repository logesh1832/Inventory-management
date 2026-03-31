const pool = require('../config/db');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const HEX_REGEX = /^#([0-9A-Fa-f]{6})$/;

// GET /api/org/customization
const getCustomization = async (req, res, next) => {
  try {
    const { org_id } = req.user;
    const result = await pool.query(
      `SELECT sidebar_color, accent_color, sidebar_logo_url, sidebar_icon_url, favicon_url, display_name, sidebar_tagline, org_name
       FROM organizations WHERE id = $1`,
      [org_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Organization not found.' } });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// PUT /api/org/customization
const updateCustomization = async (req, res, next) => {
  try {
    const { org_id } = req.user;
    const { sidebar_color, accent_color, display_name, sidebar_tagline } = req.body;

    if (sidebar_color && !HEX_REGEX.test(sidebar_color)) {
      return res.status(400).json({ error: { message: 'Invalid sidebar_color. Use #RRGGBB format.' } });
    }
    if (accent_color && !HEX_REGEX.test(accent_color)) {
      return res.status(400).json({ error: { message: 'Invalid accent_color. Use #RRGGBB format.' } });
    }

    const result = await pool.query(
      `UPDATE organizations
       SET sidebar_color    = COALESCE($1, sidebar_color),
           accent_color     = COALESCE($2, accent_color),
           display_name     = $3,
           sidebar_tagline  = $4,
           updated_at       = NOW()
       WHERE id = $5
       RETURNING sidebar_color, accent_color, sidebar_logo_url, sidebar_icon_url, favicon_url, display_name, sidebar_tagline, org_name`,
      [sidebar_color || null, accent_color || null, display_name ?? null, sidebar_tagline ?? null, org_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Multer factory for logo / favicon uploads
const createUploader = (type, allowedMimes, maxSize) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '../../uploads/orgs', req.user.org_id);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.png';
      cb(null, `${type}${ext}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error(`Invalid file type. Allowed: ${allowedMimes.join(', ')}`), { status: 400 }), false);
    }
  };

  return multer({ storage, fileFilter, limits: { fileSize: maxSize } });
};

const logoUploader = createUploader(
  'logo',
  ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
  2 * 1024 * 1024
);

const faviconUploader = createUploader(
  'favicon',
  ['image/png', 'image/jpeg', 'image/x-icon', 'image/svg+xml'],
  512 * 1024
);

const iconUploader = createUploader(
  'icon',
  ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
  1 * 1024 * 1024
);

// POST /api/org/customization/logo
const uploadLogo = [
  logoUploader.single('logo'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: { message: 'No file uploaded.' } });
      }
      const url = `/uploads/orgs/${req.user.org_id}/${req.file.filename}`;
      await pool.query(
        'UPDATE organizations SET sidebar_logo_url = $1, updated_at = NOW() WHERE id = $2',
        [url, req.user.org_id]
      );
      res.json({ sidebar_logo_url: url });
    } catch (err) {
      next(err);
    }
  },
];

// POST /api/org/customization/favicon
const uploadFavicon = [
  faviconUploader.single('favicon'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: { message: 'No file uploaded.' } });
      }
      const url = `/uploads/orgs/${req.user.org_id}/${req.file.filename}`;
      await pool.query(
        'UPDATE organizations SET favicon_url = $1, updated_at = NOW() WHERE id = $2',
        [url, req.user.org_id]
      );
      res.json({ favicon_url: url });
    } catch (err) {
      next(err);
    }
  },
];

// POST /api/org/customization/icon
const uploadIcon = [
  iconUploader.single('icon'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: { message: 'No file uploaded.' } });
      }
      const url = `/uploads/orgs/${req.user.org_id}/${req.file.filename}`;
      await pool.query(
        'UPDATE organizations SET sidebar_icon_url = $1, updated_at = NOW() WHERE id = $2',
        [url, req.user.org_id]
      );
      res.json({ sidebar_icon_url: url });
    } catch (err) {
      next(err);
    }
  },
];

module.exports = { getCustomization, updateCustomization, uploadLogo, uploadFavicon, uploadIcon };
