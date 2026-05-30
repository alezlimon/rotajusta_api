process.env.JWT_SECRET = 'test-secret-key-for-jwt-validation';
process.env.CORS_ORIGIN = 'http://localhost:5173';

const bcrypt = require('bcrypt');

const mockHashedPassword = bcrypt.hashSync('Password123!', 10);

jest.mock('../config/db', () => ({
  pool: {
    query: jest.fn(async (sql, params = []) => {
      if (sql.includes('SELECT id, nombre, email, password_hash, rol FROM usuarios')) {
        return {
          rows: [{
            id: 1,
            nombre: 'Lucia',
            email: 'lucia.manager@rotajusta.local',
            password_hash: mockHashedPassword,
            rol: 'MANAGER',
            saldo_puntos_actual: 120,
          }],
        };
      }
      if (sql.includes('SELECT id, nombre, email, rol, saldo_puntos_actual FROM usuarios WHERE id = $1')) {
        if (params[0] === 1) {
          return {
            rows: [{
              id: 1,
              nombre: 'Lucia',
              email: 'lucia.manager@rotajusta.local',
              rol: 'MANAGER',
              saldo_puntos_actual: 120,
            }],
          };
        }
        return {
          rows: [{
            id: params[0],
            nombre: 'Ana Camarera',
            email: 'ana.employee@rotajusta.local',
            rol: 'EMPLOYEE',
            saldo_puntos_actual: 84,
          }],
        };
      }
      if (sql.includes('SELECT fecha, puntos_totales, es_turno_partido, desglose FROM historial_puntos_diarios')) {
        return {
          rows: [
            { fecha: '2026-05-18', puntos_totales: 40, es_turno_partido: false, desglose: { origen: 'manual' } },
            { fecha: '2026-05-17', puntos_totales: 35, es_turno_partido: true, desglose: { origen: 'manual' } },
          ],
        };
      }
      if (sql.includes('SELECT fecha, hora_inicio, hora_fin, es_festivo FROM turnos_guardados')) {
        return {
          rows: [
            { fecha: '2026-05-18', hora_inicio: '09:00', hora_fin: '13:00', es_festivo: false },
            { fecha: '2026-05-17', hora_inicio: '18:00', hora_fin: '22:00', es_festivo: true },
          ],
        };
      }
      return { rows: [] };
    }),
    connect: jest.fn(() => Promise.resolve({
      query: jest.fn(() => Promise.resolve({ rows: [] })),
      release: jest.fn(),
    })),
  },
}));

const request = require('supertest');
const { pool } = require('../config/db');
const { app } = require('../app');
const { generateToken } = require('../middleware/auth');

describe('POST /api/auth/login', () => {
  beforeEach(() => jest.clearAllMocks());

  test('200: credenciales válidas devuelve token', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'lucia.manager@rotajusta.local',
      password: 'Password123!',
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('role', 'MANAGER');
  });

  test('400: faltan campos requeridos', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/obligatorios/i);
  });

  test('401: usuario no encontrado', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/auth/login').send({
      email: 'no.existe@rotajusta.local',
      password: 'Password123!',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/inválidas/i);
  });

  test('401: contraseña incorrecta', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'lucia.manager@rotajusta.local',
      password: 'WrongPass123!',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/inválidas/i);
  });

  test('500: error de base de datos', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).post('/api/auth/login').send({
      email: 'lucia.manager@rotajusta.local',
      password: 'Password123!',
    });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/interno/i);
  });

  test('200: perfil autenticado devuelve datos del manager', async () => {
    const token = generateToken({
      id: 1,
      email: 'lucia.manager@rotajusta.local',
      role: 'MANAGER',
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty('email', 'lucia.manager@rotajusta.local');
    expect(res.body.user).toHaveProperty('saldo_puntos_actual');
  });

  test('200: lista empleados para el selector del manager', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{
        id: 2,
        nombre: 'Ana Camarera',
        email: 'ana.employee@rotajusta.local',
        rol: 'EMPLOYEE',
      }],
    });

    const token = generateToken({
      id: 1,
      email: 'lucia.manager@rotajusta.local',
      role: 'MANAGER',
    });

    const res = await request(app)
      .get('/api/auth/employees')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.employees).toHaveLength(1);
    expect(res.body.employees[0]).toHaveProperty('email', 'ana.employee@rotajusta.local');
  });

  test('200: perfil resumido de un empleado', async () => {
    const token = generateToken({
      id: 1,
      email: 'lucia.manager@rotajusta.local',
      role: 'MANAGER',
    });

    const res = await request(app)
      .get('/api/auth/employees/2/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.employee).toHaveProperty('email', 'ana.employee@rotajusta.local');
    expect(res.body.summary).toHaveProperty('recent_points', 75);
    expect(res.body.recent_history).toHaveLength(2);
    expect(res.body.recent_turns).toHaveLength(2);
  });
});
