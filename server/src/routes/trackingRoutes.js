const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  startSession,
  stopSession,
  getStatus,
  logLocation,
  logBatch,
  getLive,
  getHistory,
  getRoute,
  getDailySummary,
} = require('../controllers/trackingController');

// Salesperson routes
router.post('/start', authenticate, requireRole('salesperson'), startSession);
router.post('/stop', authenticate, requireRole('salesperson'), stopSession);
router.get('/status', authenticate, requireRole('salesperson'), getStatus);
router.post('/log', authenticate, requireRole('salesperson'), logLocation);
router.post('/log-batch', authenticate, requireRole('salesperson'), logBatch);

// Admin routes
router.get('/live', authenticate, requireRole('admin', 'inventory'), getLive);
router.get('/daily-summary', authenticate, requireRole('admin', 'inventory'), getDailySummary);
router.get('/history/:salesperson_id', authenticate, requireRole('admin', 'inventory'), getHistory);
router.get('/route/:session_id', authenticate, requireRole('admin', 'inventory'), getRoute);

module.exports = router;
