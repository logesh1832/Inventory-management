const express = require('express');
const router = express.Router();
const {
  getStockMovements,
  getLiveStock,
  getLiveStockByProduct,
  getStockReport,
  getDashboardStats,
  getMovementsBySupplier,
  getMovementsByCustomer,
  getProductMovements,
} = require('../controllers/inventoryController');

router.get('/dashboard-stats', getDashboardStats);
router.get('/live-stock', getLiveStock);
router.get('/live-stock/:product_id', getLiveStockByProduct);
router.get('/stock-report', getStockReport);
router.get('/movements-by-supplier', getMovementsBySupplier);
router.get('/movements-by-customer', getMovementsByCustomer);
router.get('/product-movements/:product_id', getProductMovements);
router.get('/', getStockMovements);

module.exports = router;
