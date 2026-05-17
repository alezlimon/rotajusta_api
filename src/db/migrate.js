// Runner de migraciones puro Node.js + pg. Sin dependencias extra.
// Estrategia: tabla schema_migrations como registro de estado.
// Uso: node src/db/migrate.js  (o npm run migrate)

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Crea la tabla de control si no existe (idempotente)
const ensureMigrationsTable = (client) =>
  client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

// Devuelve la lista de migraciones ya aplicadas
const getAppliedMigrations = async (client) => {
  const { rows } = await client.query('SELECT filename FROM schema_migrations ORDER BY filename');
  return rows.map((r) => r.filename);
};

// Lee los archivos .sql del directorio ordenados por nombre
const getMigrationFiles = () =>
  fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

// Ejecuta un archivo .sql y registra su aplicación
const applyMigration = async (client, filename) => {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
  await client.query(sql);
  await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
  console.log(`  ✓ ${filename}`);
};

// Aplica solo las migraciones pendientes (las no registradas en schema_migrations)
const applyPendingMigrations = async (client) => {
  const applied = await getAppliedMigrations(client);
  const pending = getMigrationFiles().filter((f) => !applied.includes(f));
  if (pending.length === 0) return console.log('No hay migraciones pendientes.');
  for (const file of pending) await applyMigration(client, file);
};

// Punto de entrada: transacción atómica — o todo o nada
const runMigrations = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureMigrationsTable(client);
    await applyPendingMigrations(client);
    await client.query('COMMIT');
    console.log('Migraciones completadas.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR en migración:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

runMigrations();
