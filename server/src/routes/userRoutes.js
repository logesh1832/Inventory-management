const express = require('express');
const router = express.Router();
const { getAllUsers, createUser, updateUser, toggleUserStatus } = require('../controllers/userController');
const { authenticate, requireRole } = require('../middleware/auth');

// All user routes require admin role
router.use(authenticate, requireRole('admin'));

router.get('/', getAllUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.patch('/:id/status', toggleUserStatus);

module.exports = router;
