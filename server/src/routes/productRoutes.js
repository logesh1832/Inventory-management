const express = require('express');
const router = express.Router();
const {
  createProduct,
  getAllProducts,
  getCategories,
  getProductById,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const { requireRole } = require('../middleware/auth');

// All users can read products
router.get('/', getAllProducts);
router.get('/categories', getCategories);
router.get('/:id', getProductById);

// Only admin/inventory can modify
router.post('/', requireRole('admin', 'inventory'), createProduct);
router.put('/:id', requireRole('admin', 'inventory'), updateProduct);
router.delete('/:id', requireRole('admin', 'inventory'), deleteProduct);

module.exports = router;
