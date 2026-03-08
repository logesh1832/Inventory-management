const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  createArea, getAllAreas, updateArea, deleteArea,
  assignArea, removeAssignment, getAssignments, getSalespersonAreas,
  checkLocation, getAreaReport,
} = require('../controllers/areaController');

router.use(authenticate);

// Assignment routes (before :id params)
router.get('/assignments', requireRole('admin'), getAssignments);
router.post('/assign', requireRole('admin'), assignArea);
router.delete('/assign/:id', requireRole('admin'), removeAssignment);

// Salesperson areas
router.get('/salesperson/:id', getSalespersonAreas);

// Location check
router.post('/check-location', checkLocation);

// Report
router.get('/report', requireRole('admin', 'inventory'), getAreaReport);

// CRUD
router.get('/', getAllAreas);
router.post('/', requireRole('admin'), createArea);
router.put('/:id', requireRole('admin'), updateArea);
router.delete('/:id', requireRole('admin'), deleteArea);

module.exports = router;
