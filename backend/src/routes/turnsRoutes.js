const { Router }               = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateDailyJornada, listManualTurns, createManualTurn, updateManualTurn, deleteManualTurn } = require('../controllers/turnsController');
const { AUTH_CONFIG }              = require('../config/constants');

const router = Router();

// POST /api/turnos/validar — Consolida y guarda los puntos de la jornada de un empleado.
// Requiere autenticación JWT y rol MANAGER
router.post('/validar', authenticate, requireRole(AUTH_CONFIG.REQUIRED_ROLE_FOR_VALIDATION), validateDailyJornada);

// GET /api/turnos/manual — Lista turnos manuales del empleado en una fecha concreta.
router.get('/manual', authenticate, requireRole(AUTH_CONFIG.REQUIRED_ROLE_FOR_VALIDATION), listManualTurns);

// CRUD manual de turnos para el mánager.
router.post('/manual', authenticate, requireRole(AUTH_CONFIG.REQUIRED_ROLE_FOR_VALIDATION), createManualTurn);
router.patch('/manual/:turno_id', authenticate, requireRole(AUTH_CONFIG.REQUIRED_ROLE_FOR_VALIDATION), updateManualTurn);
router.delete('/manual/:turno_id', authenticate, requireRole(AUTH_CONFIG.REQUIRED_ROLE_FOR_VALIDATION), deleteManualTurn);

module.exports = router;
