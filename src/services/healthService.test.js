// Tests para healthService.

process.env.JWT_SECRET = 'test-secret-key-for-jwt-validation';
process.env.CORS_ORIGIN = 'http://localhost:3000';

// Mock de la BD ANTES de importar healthService
jest.mock('../config/db', () => ({
  pool: {
    connect: jest.fn(() => Promise.resolve({
      query: jest.fn(() => Promise.resolve({ rows: [] })),
      release: jest.fn(),
    })),
  },
}));

const { getBasicHealth, getReadinessProbe, checkDatabase } = require('./healthService');

describe('healthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBasicHealth', () => {
    test('devuelve objeto con status y timestamp', () => {
      const health = getBasicHealth();
      expect(health).toHaveProperty('status', 'ok');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('environment');
      expect(typeof health.uptime).toBe('number');
    });

    test('uptime es siempre positivo', () => {
      const health = getBasicHealth();
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('checkDatabase', () => {
    test('devuelve true si la BD responde', async () => {
      const result = await checkDatabase();
      expect(result).toBe(true);
    });

    test('devuelve false si la BD falla', async () => {
      const { pool } = require('../config/db');
      pool.connect.mockRejectedValueOnce(new Error('Connection failed'));
      const result = await checkDatabase();
      expect(result).toBe(false);
    });
  });

  describe('getReadinessProbe', () => {
    test('devuelve ready=true si BD está disponible', async () => {
      const probe = await getReadinessProbe();
      expect(probe).toHaveProperty('status', 'ready');
      expect(probe).toHaveProperty('database', true);
    });

    test('devuelve not_ready si BD no responde', async () => {
      const { pool } = require('../config/db');
      pool.connect.mockRejectedValueOnce(new Error('Connection failed'));
      const probe = await getReadinessProbe();
      expect(probe).toHaveProperty('status', 'not_ready');
      expect(probe).toHaveProperty('database', false);
    });

    test('incluye propiedades de basic health', async () => {
      const probe = await getReadinessProbe();
      expect(probe).toHaveProperty('timestamp');
      expect(probe).toHaveProperty('uptime');
      expect(probe).toHaveProperty('environment');
    });
  });
});
