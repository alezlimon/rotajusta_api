// Conexión única al pool de PostgreSQL.
// Usa la variable de entorno DATABASE_URL (ej: postgres://user:pass@host:5432/db)

const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = { pool };
