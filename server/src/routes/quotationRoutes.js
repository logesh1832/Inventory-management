const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  createQuotation,
  getAllQuotations,
  getPendingQuotations,
  getQuotationById,
  updateQuotation,
  submitQuotation,
  recallQuotation,
  startReview,
  approveQuotation,
  rejectQuotation,
  convertToOrder,
  duplicateQuotation,
  stockCheck,
} = require('../controllers/quotationController');

router.use(authenticate);

// List & create
router.get('/pending', requireRole('admin', 'inventory'), getPendingQuotations);
router.get('/', getAllQuotations);
router.post('/', requireRole('salesperson', 'admin'), createQuotation);

// Single quotation actions
router.get('/:id', getQuotationById);
router.get('/:id/stock-check', requireRole('admin', 'inventory'), stockCheck);
router.put('/:id', updateQuotation);
router.patch('/:id/submit', requireRole('salesperson', 'admin'), submitQuotation);
router.patch('/:id/recall', requireRole('salesperson', 'admin'), recallQuotation);
router.post('/:id/duplicate', requireRole('salesperson', 'admin'), duplicateQuotation);

// Inventory team actions
router.patch('/:id/review', requireRole('admin', 'inventory'), startReview);
router.patch('/:id/approve', requireRole('admin', 'inventory'), approveQuotation);
router.patch('/:id/reject', requireRole('admin', 'inventory'), rejectQuotation);
router.post('/:id/convert', requireRole('admin', 'inventory'), convertToOrder);

module.exports = router;
