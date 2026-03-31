const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireSuperAdmin } = require('../middleware/auth');
const { getInventoryDashboard, getPlatformDashboard } = require('../controllers/dashboardController');

router.use(authenticate);

router.get('/inventory', requireRole('admin', 'inventory'), getInventoryDashboard);
router.get('/platform', requireSuperAdmin, getPlatformDashboard);

module.exports = router;
