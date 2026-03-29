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
const upload = require('../middleware/upload');

// All users can read products
router.get('/', getAllProducts);
router.get('/categories', getCategories);
router.get('/:id', getProductById);

// Only admin/inventory can modify
router.post('/', requireRole('admin', 'inventory'), upload.single('image'), createProduct);
router.put('/:id', requireRole('admin', 'inventory'), upload.single('image'), updateProduct);
router.delete('/:id', requireRole('admin', 'inventory'), deleteProduct);

module.exports = router;
