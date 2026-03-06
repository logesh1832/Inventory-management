const express = require('express');
const router = express.Router();
const {
  getStockMovements,
  getLiveStock,
  getLiveStockByProduct,
  getStockReport,
  getDashboardStats,
} = require('../controllers/inventoryController');

router.get('/dashboard-stats', getDashboardStats);
router.get('/live-stock', getLiveStock);
router.get('/live-stock/:product_id', getLiveStockByProduct);
router.get('/stock-report', getStockReport);
router.get('/', getStockMovements);

module.exports = router;
