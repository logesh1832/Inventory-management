const express = require('express');
const router = express.Router();
const { createBatch, getAllBatches, getBatchById, getBatchesByProduct } = require('../controllers/batchController');

router.post('/', createBatch);
router.get('/', getAllBatches);
router.get('/product/:product_id', getBatchesByProduct);
router.get('/:id', getBatchById);

module.exports = router;
