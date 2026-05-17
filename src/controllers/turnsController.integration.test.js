// Tests de integración para turnsController.
// Valida el endpoint POST /api/turnos/validar en todos sus escenarios.

// Configurar variables de entorno ANTES de cualquier import
process.env.JWT_SECRET = 'test-secret-key-for-jwt-validation';
process.env.CORS_ORIGIN = 'http://localhost:3000';

// Mock del pool de PostgreSQL ANTES de importar cualquier módulo que lo use
jest.mock('../config/db', () => ({
  pool: {
    connect: jest.fn(() => Promise.resolve({
      query: jest.fn(() => Promise.resolve({ rows: [{ id: 1 }] })),
      release: jest.fn(),
    })),
  },
}));

const request = require('supertest');
const { MANAGER_TOKEN, EMPLOYEE_TOKEN, EXPIRED_TOKEN, INVALID_TOKEN } = require('../test/fixtures/tokens');
const { app } = require('../app');

describe('POST /api/turnos/validar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 200 OK ---

  test('200: JWT válido + rol MANAGER + payload correcto', async () => {
    const payload = {
      empleado_id: 5,
      fecha: '2026-05-18',
      es_festivo: false,
      turnos: [
        { hora_inicio: '09:00', hora_fin: '13:00' },
        { hora_inicio: '18:00', hora_fin: '22:00' },
      ],
    };

    const res = await request(app)
      .post('/api/turnos/validar')
      .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('empleado_id', 5);
    expect(res.body).toHaveProperty('puntos_calculados');
    expect(res.body).toHaveProperty('es_turno_partido');
    expect(typeof res.body.puntos_calculados).toBe('number');
  });

  // --- 401 Unauthorized ---

  test('401: Sin token en Authorization header', async () => {
    const payload = {
      empleado_id: 5,
      fecha: '2026-05-18',
      turnos: [{ hora_inicio: '09:00', hora_fin: '13:00' }],
    };

    const res = await request(app)
      .post('/api/turnos/validar')
      .send(payload);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Token requerido/i);
  });

  test('401: Token expirado', async () => {
    const payload = {
      empleado_id: 5,
      fecha: '2026-05-18',
      turnos: [{ hora_inicio: '09:00', hora_fin: '13:00' }],
    };

    const res = await request(app)
      .post('/api/turnos/validar')
      .set('Authorization', `Bearer ${EXPIRED_TOKEN}`)
      .send(payload);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/inválido|expirado/i);
  });

  test('401: Token con firma inválida', async () => {
    const payload = {
      empleado_id: 5,
      fecha: '2026-05-18',
      turnos: [{ hora_inicio: '09:00', hora_fin: '13:00' }],
    };

    const res = await request(app)
      .post('/api/turnos/validar')
      .set('Authorization', `Bearer ${INVALID_TOKEN}`)
      .send(payload);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/inválido|expirado/i);
  });

  // --- 403 Forbidden ---

  test('403: Token válido pero rol EMPLEADO (no MANAGER)', async () => {
    const payload = {
      empleado_id: 5,
      fecha: '2026-05-18',
      turnos: [{ hora_inicio: '09:00', hora_fin: '13:00' }],
    };

    const res = await request(app)
      .post('/api/turnos/validar')
      .set('Authorization', `Bearer ${EMPLOYEE_TOKEN}`)
      .send(payload);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/MANAGER/i);
  });

  // --- 400 Bad Request ---

  test('400: Payload vacío', async () => {
    const res = await request(app)
      .post('/api/turnos/validar')
      .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Faltan campos/i);
  });

  test('400: Fecha en formato inválido', async () => {
    const payload = {
      empleado_id: 5,
      fecha: '18-05-2026', // Formato incorrecto
      turnos: [{ hora_inicio: '09:00', hora_fin: '13:00' }],
    };

    const res = await request(app)
      .post('/api/turnos/validar')
      .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/fecha/i);
  });

  test('400: Turno sin hora_inicio', async () => {
    const payload = {
      empleado_id: 5,
      fecha: '2026-05-18',
      turnos: [{ hora_fin: '13:00' }], // Falta hora_inicio
    };

    const res = await request(app)
      .post('/api/turnos/validar')
      .set('Authorization', `Bearer ${MANAGER_TOKEN}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/HH:MM/i);
  });
});
