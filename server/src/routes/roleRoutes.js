const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { getAllRoles, createRole, updateRole, deleteRole } = require('../controllers/roleController');

// All routes require authentication + admin or inventory role
router.use(authenticate, requireRole('admin', 'inventory'));

router.get('/', getAllRoles);
router.post('/', createRole);
router.put('/:id', updateRole);
router.delete('/:id', deleteRole);

module.exports = router;
