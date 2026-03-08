const express = require('express');
const router = express.Router();
const {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController');
const { requireRole } = require('../middleware/auth');

// All users can read categories
router.get('/', getAllCategories);
router.get('/:id', getCategoryById);

// Only admin/inventory can modify
router.post('/', requireRole('admin', 'inventory'), createCategory);
router.put('/:id', requireRole('admin', 'inventory'), updateCategory);
router.delete('/:id', requireRole('admin', 'inventory'), deleteCategory);

module.exports = router;
