const express = require('express');
const router = express.Router();
const { login, logout, getMe, forgotPassword, resetPassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/login', login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
