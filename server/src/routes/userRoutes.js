const express = require('express');
const router = express.Router();
const { getAllUsers, createUser, updateUser, toggleUserStatus } = require('../controllers/userController');
const { authenticate, requireCapability } = require('../middleware/auth');

router.use(authenticate, requireCapability('user_management'));

router.get('/', getAllUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.patch('/:id/status', toggleUserStatus);

module.exports = router;
