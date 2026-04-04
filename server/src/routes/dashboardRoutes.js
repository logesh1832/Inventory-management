const express = require('express');
const router = express.Router();
const { authenticate, requireCapability } = require('../middleware/auth');
const { getInventoryDashboard } = require('../controllers/dashboardController');

router.use(authenticate);

router.get('/inventory', requireCapability('dashboard'), getInventoryDashboard);

module.exports = router;
