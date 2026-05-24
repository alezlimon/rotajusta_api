// Health check service. Diagnostica el estado del servidor y sus dependencias.
// Responsabilidad única: Verificar conectividad a PostgreSQL.

const { pool } = require('../config/db');
const logger = require('./logger');

// Intenta hacer ping a la BD. Devuelve true si está disponible, false si no.
const checkDatabase = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (_) {
    return false;
  }
};

// Health check básico: servidor vivo.
const getBasicHealth = () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  uptime: Math.floor(process.uptime()),
  environment: process.env.NODE_ENV || 'development',
});

// Readiness probe: servidor + BD disponibles (para Kubernetes/orchestration).
const getReadinessProbe = async () => {
  const basic = getBasicHealth();
  const dbReady = await checkDatabase();
  const status = dbReady ? 'ready' : 'not_ready';

  if (!dbReady) {
    logger.warn('Database connection failed', { service: 'healthService' });
  }

  return { ...basic, status, database: dbReady };
};

module.exports = { getBasicHealth, getReadinessProbe, checkDatabase };
