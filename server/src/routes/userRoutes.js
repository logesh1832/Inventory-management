const express = require('express');
const router = express.Router();
const { getAllUsers, createUser, updateUser, toggleUserStatus } = require('../controllers/userController');
const { authenticate, requireRole } = require('../middleware/auth');

// User routes require admin or inventory role
router.use(authenticate, requireRole('admin', 'inventory'));

router.get('/', getAllUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.patch('/:id/status', toggleUserStatus);

module.exports = router;
