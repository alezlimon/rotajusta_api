const { Router }               = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateDailyJornada }     = require('../controllers/turnsController');
const { AUTH_CONFIG }              = require('../config/constants');

const router = Router();

// POST /api/turnos/validar — Consolida y guarda los puntos de la jornada de un empleado.
// Requiere autenticación JWT y rol MANAGER
router.post('/validar', authenticate, requireRole(AUTH_CONFIG.REQUIRED_ROLE_FOR_VALIDATION), validateDailyJornada);

module.exports = router;
