// Seed inicial idempotente para datos de prueba.
// Crea 1 MANAGER y 2 EMPLOYEE usando emails únicos y bcrypt.

require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'Password123!';

const seedUsers = [
  { nombre: 'Clau Manager', email: 'clau.manager@rotajusta.local', rol: 'MANAGER' },
  { nombre: 'Ana Camarera', email: 'ana.employee@rotajusta.local', rol: 'EMPLOYEE' },
  { nombre: 'Luis Cocina', email: 'luis.employee@rotajusta.local', rol: 'EMPLOYEE' },
];

const hashPassword = () => bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

const buildUserPayloads = async () => {
  const passwordHash = await hashPassword();
  return seedUsers.map((user) => ({ ...user, passwordHash }));
};

const insertUser = (client, { nombre, email, rol, passwordHash }) =>
  client.query(
    `INSERT INTO usuarios (nombre, email, password_hash, rol)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING`,
    [nombre, email, passwordHash, rol]
  );

const seedDatabase = async () => {
  const client = await pool.connect();
  try {
    const users = await buildUserPayloads();
    await client.query('BEGIN');
    for (const user of users) {
      await insertUser(client, user);
    }
    await client.query('COMMIT');
    console.log(`Seed completado: ${users.length} usuarios base procesados.`);
    console.log(`Password común de prueba: ${DEFAULT_PASSWORD}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('ERROR en seed:', error.message);
    process.exit(1);
  } finally {
    client.release();
  }
};

const main = async () => {
  try {
    await seedDatabase();
  } finally {
    await pool.end();
  }
};

main();