const express = require('express');
const router = express.Router();
const { createBatch, createBulkBatches, getAllBatches, getStockEntries, getStockEntryById, getStockEntrySiblings, updateStockEntry, getBatchById, getBatchesByProduct } = require('../controllers/batchController');

router.post('/bulk', createBulkBatches);
router.post('/', createBatch);
router.get('/stock-entries/:id/siblings', getStockEntrySiblings);
router.get('/stock-entries/:id', getStockEntryById);
router.put('/stock-entries/:id', updateStockEntry);
router.get('/stock-entries', getStockEntries);
router.get('/', getAllBatches);
router.get('/product/:product_id', getBatchesByProduct);
router.get('/:id', getBatchById);

module.exports = router;
