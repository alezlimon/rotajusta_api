const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { login, me, employees, employeeProfile } = require('../controllers/authController');
const { requireRole } = require('../middleware/auth');
const { AUTH_CONFIG } = require('../config/constants');

const router = Router();

// POST /api/auth/login — Autentica usuario y entrega JWT.
router.post('/login', login);

// GET /api/auth/me — Devuelve el perfil del usuario autenticado.
router.get('/me', authenticate, me);

// GET /api/auth/employees — Lista empleados para el selector del manager.
router.get('/employees', authenticate, requireRole(AUTH_CONFIG.REQUIRED_ROLE_FOR_VALIDATION), employees);

// GET /api/auth/employees/:employee_id/profile — Perfil resumido de un empleado.
router.get('/employees/:employee_id/profile', authenticate, requireRole(AUTH_CONFIG.REQUIRED_ROLE_FOR_VALIDATION), employeeProfile);

module.exports = router;
