const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  checkIn,
  checkOut,
  getActive,
  getMyVisits,
  getAllVisits,
  getSummary,
  getCustomerVisits,
} = require('../controllers/visitController');

// Salesperson routes
router.post('/check-in', authenticate, requireRole('salesperson'), checkIn);
router.post('/check-out/:visit_id', authenticate, requireRole('salesperson'), checkOut);
router.get('/active', authenticate, requireRole('salesperson'), getActive);
router.get('/my-visits', authenticate, requireRole('salesperson'), getMyVisits);

// Admin routes
router.get('/summary', authenticate, requireRole('admin', 'inventory'), getSummary);
router.get('/customer/:customer_id', authenticate, getCustomerVisits);
router.get('/', authenticate, requireRole('admin', 'inventory'), getAllVisits);

module.exports = router;
