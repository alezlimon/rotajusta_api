// Fixtures de tokens JWT para testing.
// Generados estáticamente para reproducibilidad en tests.

const jwt = require('jsonwebtoken');

// Token que expira en +1 hora (válido)
const MANAGER_TOKEN = jwt.sign(
  { id: 1, email: 'manager@test.com', role: 'MANAGER' },
  process.env.JWT_SECRET || 'test-secret',
  { expiresIn: '1h' }
);

// Token de empleado (válido pero sin permisos)
const EMPLOYEE_TOKEN = jwt.sign(
  { id: 2, email: 'employee@test.com', role: 'EMPLOYEE' },
  process.env.JWT_SECRET || 'test-secret',
  { expiresIn: '1h' }
);

// Token expirado (expira 1 segundo en el pasado)
const EXPIRED_TOKEN = jwt.sign(
  { id: 3, email: 'expired@test.com', role: 'MANAGER' },
  process.env.JWT_SECRET || 'test-secret',
  { expiresIn: '-1s' }
);

// Token con firma incorrecta (usando secret diferente)
const INVALID_TOKEN = jwt.sign(
  { id: 4, email: 'invalid@test.com', role: 'MANAGER' },
  'wrong-secret',
  { expiresIn: '1h' }
);

module.exports = {
  MANAGER_TOKEN,
  EMPLOYEE_TOKEN,
  EXPIRED_TOKEN,
  INVALID_TOKEN,
};
