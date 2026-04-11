// Order routes — thin HTTP layer; delegates all logic to orderController
const express = require('express');
const router = express.Router();
const { createOrder, getAllOrders, getOrderById, updateOrder, deleteOrder, convertToMO, cancelHold } = require('../controllers/orderController');

router.post('/', createOrder);
router.get('/', getAllOrders);
router.get('/:id', getOrderById);
router.put('/:id', updateOrder);
router.delete('/:id', deleteOrder);
router.post('/:id/convert', convertToMO);
router.patch('/:id/cancel', cancelHold);

module.exports = router;
