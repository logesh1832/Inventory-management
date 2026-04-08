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
const { requireCapability } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All users can read products
router.get('/', getAllProducts);
router.get('/categories', getCategories);
router.get('/:id', getProductById);

// Capability-based: any role with 'products' capability can modify
router.post('/', requireCapability('products'), upload.single('image'), createProduct);
router.put('/:id', requireCapability('products'), upload.single('image'), updateProduct);
router.delete('/:id', requireCapability('products'), deleteProduct);

module.exports = router;
