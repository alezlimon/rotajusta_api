const { Router }               = require('express');
const { validateDailyJornada } = require('../controllers/turnsController');

const router = Router();

// POST /api/turnos/validar — Consolida y guarda los puntos de la jornada de un empleado.
router.post('/validar', validateDailyJornada);

module.exports = router;
