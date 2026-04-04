const express = require('express');
const router = express.Router();
const { authenticate, requireCapability, requireSuperAdmin } = require('../middleware/auth');
const { getInventoryDashboard, getPlatformDashboard } = require('../controllers/dashboardController');

router.use(authenticate);

router.get('/inventory', requireCapability('dashboard'), getInventoryDashboard);
router.get('/platform', requireSuperAdmin, getPlatformDashboard);

module.exports = router;
