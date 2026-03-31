const express = require('express');
const router = express.Router();
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const { createOrg, getAllOrgs, getOrgById, updateOrg, getOrgUsers } = require('../controllers/orgController');

router.use(authenticate, requireSuperAdmin);

router.post('/', createOrg);
router.get('/', getAllOrgs);
router.get('/:id', getOrgById);
router.put('/:id', updateOrg);
router.get('/:id/users', getOrgUsers);

module.exports = router;
