const express = require('express');
const router = express.Router();
const { createBatch, createBulkBatches, getAllBatches, getStockEntries, getBatchById, getBatchesByProduct } = require('../controllers/batchController');

router.post('/bulk', createBulkBatches);
router.post('/', createBatch);
router.get('/stock-entries', getStockEntries);
router.get('/', getAllBatches);
router.get('/product/:product_id', getBatchesByProduct);
router.get('/:id', getBatchById);

module.exports = router;
