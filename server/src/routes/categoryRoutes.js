const express = require('express');
const router = express.Router();
const {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController');
const { requireCapability } = require('../middleware/auth');

// All users can read categories
router.get('/', getAllCategories);
router.get('/:id', getCategoryById);

// Admin or users with categories capability can modify
router.post('/', requireCapability('categories'), createCategory);
router.put('/:id', requireCapability('categories'), updateCategory);
router.delete('/:id', requireCapability('categories'), deleteCategory);

module.exports = router;
