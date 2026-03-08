const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { getInventoryDashboard } = require('../controllers/dashboardController');

router.use(authenticate);

router.get('/inventory', requireRole('admin', 'inventory'), getInventoryDashboard);

module.exports = router;
