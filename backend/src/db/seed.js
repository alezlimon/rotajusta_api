// Seed inicial idempotente para datos de prueba.
// Crea 1 MANAGER, 6 EMPLOYEE y jornadas/turnos reales de ejemplo.

require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const { calcDailyPoints, calcSplitShiftBonus } = require('../services/pointsService');

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'Password123!';
const SEED_SOURCE = 'seed';

const seedUsers = [
  { nombre: 'Lucia', email: 'lucia.manager@rotajusta.local', rol: 'MANAGER' },
  { nombre: 'Ana Camarera', email: 'ana.employee@rotajusta.local', rol: 'EMPLOYEE' },
  { nombre: 'Luis Cocina', email: 'luis.employee@rotajusta.local', rol: 'EMPLOYEE' },
  { nombre: 'Carlos Camarero', email: 'carlos@rotajusta.local', rol: 'EMPLOYEE' },
  { nombre: 'Maria Barra', email: 'maria@rotajusta.local', rol: 'EMPLOYEE' },
  { nombre: 'Elena Chef', email: 'elena@rotajusta.local', rol: 'EMPLOYEE' },
  { nombre: 'Jorge Pinche', email: 'jorge@rotajusta.local', rol: 'EMPLOYEE' },
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
      { hora_inicio: '15:00', hora_fin: '17:00', es_festivo: false },
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
  {
    email: 'luis.employee@rotajusta.local',
    fecha: '2026-05-17',
    turnos: [
      { hora_inicio: '22:00', hora_fin: '02:00', es_festivo: false },
    ],
  },
  {
    email: 'ana.employee@rotajusta.local',
    fecha: '2026-05-18',
    turnos: [
      { hora_inicio: '08:00', hora_fin: '12:00', es_festivo: false },
      { hora_inicio: '15:30', hora_fin: '19:30', es_festivo: false },
    ],
  },
  {
    email: 'carlos@rotajusta.local',
    fecha: '2026-05-19',
    turnos: [
      { hora_inicio: '08:00', hora_fin: '16:00', es_festivo: false },
    ],
  },
  {
    email: 'maria@rotajusta.local',
    fecha: '2026-05-20',
    turnos: [
      { hora_inicio: '16:00', hora_fin: '00:00', es_festivo: false },
    ],
  },
  {
    email: 'elena@rotajusta.local',
    fecha: '2026-05-21',
    turnos: [
      { hora_inicio: '00:00', hora_fin: '08:00', es_festivo: false },
    ],
  },
  {
    email: 'jorge@rotajusta.local',
    fecha: '2026-05-22',
    turnos: [
      { hora_inicio: '10:00', hora_fin: '14:00', es_festivo: false },
      { hora_inicio: '17:00', hora_fin: '21:00', es_festivo: false },
    ],
  },
  {
    email: 'carlos@rotajusta.local',
    fecha: '2026-06-02',
    turnos: [
      { hora_inicio: '16:00', hora_fin: '00:00', es_festivo: false },
    ],
  },
  {
    email: 'maria@rotajusta.local',
    fecha: '2026-06-03',
    turnos: [
      { hora_inicio: '08:00', hora_fin: '16:00', es_festivo: false },
    ],
  },
  {
    email: 'elena@rotajusta.local',
    fecha: '2026-06-04',
    turnos: [
      { hora_inicio: '16:00', hora_fin: '00:00', es_festivo: false },
    ],
  },
  {
    email: 'jorge@rotajusta.local',
    fecha: '2026-06-05',
    turnos: [
      { hora_inicio: '00:00', hora_fin: '08:00', es_festivo: false },
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
  const normalizedTurnos = turnos.map((turno) => ({ ...turno, fecha }));
  const puntos = calcDailyPoints(normalizedTurnos);
  const esTurnoPartido = calcSplitShiftBonus(normalizedTurnos) > 0;
  return client.query(
    `INSERT INTO historial_puntos_diarios (usuario_id, fecha, puntos_totales, es_turno_partido, desglose)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (usuario_id, fecha) DO UPDATE
     SET puntos_totales = EXCLUDED.puntos_totales,
         es_turno_partido = EXCLUDED.es_turno_partido,
         desglose = EXCLUDED.desglose
     RETURNING id`,
    [usuario_id, fecha, puntos, esTurnoPartido, buildDesglose(normalizedTurnos, puntos, esTurnoPartido)]
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