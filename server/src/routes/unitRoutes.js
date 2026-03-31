const express = require('express');
const router = express.Router();
const {
  getAllUnits,
  createUnit,
  updateUnit,
  deleteUnit,
} = require('../controllers/unitController');
const { requireRole } = require('../middleware/auth');

// All authenticated users can read units
router.get('/', getAllUnits);

// Only admin/inventory can modify
router.post('/', requireRole('admin', 'inventory'), createUnit);
router.put('/:id', requireRole('admin', 'inventory'), updateUnit);
router.delete('/:id', requireRole('admin', 'inventory'), deleteUnit);

module.exports = router;
