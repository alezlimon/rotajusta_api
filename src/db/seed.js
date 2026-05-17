// Seed inicial idempotente para datos de prueba.
// Crea 1 MANAGER, 2 EMPLOYEE y jornadas/turnos reales de ejemplo.

require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const { calcDailyPoints, calcSplitShiftBonus } = require('../services/pointsService');

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'Password123!';
const SEED_SOURCE = 'seed';

const seedUsers = [
  { nombre: 'Clau Manager', email: 'clau.manager@rotajusta.local', rol: 'MANAGER' },
  { nombre: 'Ana Camarera', email: 'ana.employee@rotajusta.local', rol: 'EMPLOYEE' },
  { nombre: 'Luis Cocina', email: 'luis.employee@rotajusta.local', rol: 'EMPLOYEE' },
];

const seedJornadas = [
  {
    email: 'ana.employee@rotajusta.local',
    fecha: '2026-05-14',
    turnos: [
      { hora_inicio: '09:00', hora_fin: '13:00', es_festivo: false },
      { hora_inicio: '16:00', hora_fin: '20:00', es_festivo: false },
    ],
  },
  {
    email: 'luis.employee@rotajusta.local',
    fecha: '2026-05-15',
    turnos: [
      { hora_inicio: '08:00', hora_fin: '16:00', es_festivo: false },
    ],
  },
  {
    email: 'ana.employee@rotajusta.local',
    fecha: '2026-05-16',
    turnos: [
      { hora_inicio: '10:00', hora_fin: '14:00', es_festivo: true },
      { hora_inicio: '17:00', hora_fin: '21:00', es_festivo: true },
    ],
  },
];

const hashPassword = () => bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

const buildUserPayloads = async () => {
  const passwordHash = await hashPassword();
  return seedUsers.map((user) => ({ ...user, passwordHash }));
};

const buildSeedJornadas = (userMap) =>
  seedJornadas.map((jornada) => ({
    ...jornada,
    usuario_id: userMap.get(jornada.email),
  }));

const insertUser = (client, { nombre, email, rol, passwordHash }) =>
  client.query(
    `INSERT INTO usuarios (nombre, email, password_hash, rol)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE
     SET nombre = EXCLUDED.nombre,
         password_hash = EXCLUDED.password_hash,
         rol = EXCLUDED.rol
     RETURNING id, email`,
    [nombre, email, passwordHash, rol]
  );

const upsertJornada = (client, { usuario_id, fecha, turnos }) => {
  const puntos = calcDailyPoints(turnos);
  const esTurnoPartido = calcSplitShiftBonus(turnos) > 0;
  return client.query(
    `INSERT INTO historial_puntos_diarios (usuario_id, fecha, puntos_totales, es_turno_partido, desglose)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (usuario_id, fecha) DO UPDATE
     SET puntos_totales = EXCLUDED.puntos_totales,
         es_turno_partido = EXCLUDED.es_turno_partido,
         desglose = EXCLUDED.desglose
     RETURNING id`,
    [usuario_id, fecha, puntos, esTurnoPartido, buildDesglose(turnos, puntos, esTurnoPartido)]
  );
};

const buildDesglose = (turnos, puntos, esTurnoPartido) => ({
  fuente: SEED_SOURCE,
  turnos,
  turnos_procesados: turnos.length,
  puntos_calculados: puntos,
  es_turno_partido: esTurnoPartido,
});

const replaceSeededTurnos = (client, historial_id) =>
  client.query('DELETE FROM turnos_guardados WHERE historial_id = $1', [historial_id]);

const insertTurno = (client, historial_id, usuario_id, fecha, turno) =>
  client.query(
    `INSERT INTO turnos_guardados (historial_id, usuario_id, fecha, hora_inicio, hora_fin, es_festivo)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [historial_id, usuario_id, fecha, turno.hora_inicio, turno.hora_fin, turno.es_festivo]
  );

const seedTurnos = async (client, historial_id, usuario_id, fecha, turnos) => {
  await replaceSeededTurnos(client, historial_id);
  for (const turno of turnos) {
    await insertTurno(client, historial_id, usuario_id, fecha, turno);
  }
};

const seedJornadasData = async (client, userMap) => {
  const jornadas = buildSeedJornadas(userMap);
  for (const jornada of jornadas) {
    const { rows } = await upsertJornada(client, jornada);
    await seedTurnos(client, rows[0].id, jornada.usuario_id, jornada.fecha, jornada.turnos);
  }
};

const indexUsersByEmail = (rows) => new Map(rows.map((row) => [row.email, row.id]));

const seedDatabase = async () => {
  const client = await pool.connect();
  try {
    const users = await buildUserPayloads();
    await client.query('BEGIN');
    const insertedUsers = [];
    for (const user of users) {
      const { rows } = await insertUser(client, user);
      insertedUsers.push(rows[0]);
    }
    await seedJornadasData(client, indexUsersByEmail(insertedUsers));
    await client.query('COMMIT');
    console.log(`Seed completado: ${users.length} usuarios y ${seedJornadas.length} jornadas base procesadas.`);
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