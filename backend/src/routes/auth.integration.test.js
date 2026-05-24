process.env.JWT_SECRET = 'test-secret-key-for-jwt-validation';
process.env.CORS_ORIGIN = 'http://localhost:5173';

const bcrypt = require('bcrypt');

const mockHashedPassword = bcrypt.hashSync('Password123!', 10);

jest.mock('../config/db', () => ({
  pool: {
    query: jest.fn(() => Promise.resolve({
      rows: [{
        id: 1,
        nombre: 'Clau Manager',
        email: 'clau.manager@rotajusta.local',
        password_hash: mockHashedPassword,
        rol: 'MANAGER',
        saldo_puntos_actual: 120,
      }],
    })),
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
      email: 'clau.manager@rotajusta.local',
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
      email: 'clau.manager@rotajusta.local',
      password: 'WrongPass123!',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/inválidas/i);
  });

  test('500: error de base de datos', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).post('/api/auth/login').send({
      email: 'clau.manager@rotajusta.local',
      password: 'Password123!',
    });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/interno/i);
  });

  test('200: perfil autenticado devuelve datos del manager', async () => {
    const token = generateToken({
      id: 1,
      email: 'clau.manager@rotajusta.local',
      role: 'MANAGER',
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty('email', 'clau.manager@rotajusta.local');
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
      email: 'clau.manager@rotajusta.local',
      role: 'MANAGER',
    });

    const res = await request(app)
      .get('/api/auth/employees')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.employees).toHaveLength(1);
    expect(res.body.employees[0]).toHaveProperty('email', 'ana.employee@rotajusta.local');
  });
});
