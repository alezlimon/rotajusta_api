// Tests de integración para health endpoints.

process.env.JWT_SECRET = 'test-secret-key-for-jwt-validation';
process.env.CORS_ORIGIN = 'http://localhost:3000';

// Mock del pool de PostgreSQL ANTES de importar app
jest.mock('../config/db', () => ({
  pool: {
    connect: jest.fn(() => Promise.resolve({
      query: jest.fn(() => Promise.resolve({})),
      release: jest.fn(),
    })),
  },
}));

const request = require('supertest');
const { app } = require('../app');

describe('GET /health', () => {
  test('200: devuelve estado básico del servidor', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('environment');
  });

  test('respuesta contiene timestamp válido ISO', async () => {
    const res = await request(app).get('/health');
    const { timestamp } = res.body;
    expect(() => new Date(timestamp)).not.toThrow();
  });
});

describe('GET /health/ready', () => {
  test('200: devuelve ready=true si BD está disponible', async () => {
    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ready');
    expect(res.body).toHaveProperty('database', true);
  });

  test('503: devuelve not_ready si BD no está disponible', async () => {
    const { pool } = require('../config/db');
    pool.connect.mockRejectedValueOnce(new Error('Connection failed'));

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('status', 'not_ready');
    expect(res.body).toHaveProperty('database', false);
  });

  test('respuesta include propiedades de health básico', async () => {
    const res = await request(app).get('/health/ready');

    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('environment');
  });
});
