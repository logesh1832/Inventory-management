const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { getCustomization, updateCustomization, uploadLogo, uploadFavicon, uploadIcon } = require('../controllers/orgCustomizationController');

// All routes require authentication
router.use(authenticate);

// GET  — readable by all org users (Layout needs it for all users)
router.get('/', getCustomization);

// PUT / POST — admin only
router.put('/', requireRole('admin'), updateCustomization);
router.post('/logo', requireRole('admin'), ...uploadLogo);
router.post('/icon', requireRole('admin'), ...uploadIcon);
router.post('/favicon', requireRole('admin'), ...uploadFavicon);

module.exports = router;
