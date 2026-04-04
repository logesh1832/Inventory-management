const express = require('express');
const router = express.Router();
const { authenticate, requireCapability } = require('../middleware/auth');
const { getAllRoles, createRole, updateRole, deleteRole } = require('../controllers/roleController');

router.use(authenticate, requireCapability('role_management'));

router.get('/', getAllRoles);
router.post('/', createRole);
router.put('/:id', updateRole);
router.delete('/:id', deleteRole);

module.exports = router;
