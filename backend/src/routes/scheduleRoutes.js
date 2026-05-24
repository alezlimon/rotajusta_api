const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { AUTH_CONFIG } = require('../config/constants');
const { getBootstrap, postGenerate, patchAssignment } = require('../controllers/scheduleController');

const router = Router();

router.get('/bootstrap', authenticate, requireRole(AUTH_CONFIG.REQUIRED_ROLE_FOR_VALIDATION), getBootstrap);
router.post('/generate', authenticate, requireRole(AUTH_CONFIG.REQUIRED_ROLE_FOR_VALIDATION), postGenerate);
router.patch('/assignment', authenticate, requireRole(AUTH_CONFIG.REQUIRED_ROLE_FOR_VALIDATION), patchAssignment);

module.exports = router;