const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  createTarget,
  getAllTargets,
  getMyProgress,
  getTargetReport,
  updateTarget,
  deleteTarget,
} = require('../controllers/targetController');

router.use(authenticate);

router.get('/my-progress', requireRole('salesperson'), getMyProgress);
router.get('/report', requireRole('admin', 'inventory'), getTargetReport);
router.get('/', getAllTargets);
router.post('/', requireRole('admin'), createTarget);
router.put('/:id', requireRole('admin'), updateTarget);
router.delete('/:id', requireRole('admin'), deleteTarget);

module.exports = router;
