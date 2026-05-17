// Controlador de Turnos — Capa HTTP. No contiene lógica de negocio ni SQL inline.
// Responsabilidad: validar la petición, orquestar servicios y devolver la respuesta.

const { pool }                                           = require('../config/db');
const { calcDailyPoints, calcSplitShiftBonus, toMinutes } = require('../services/pointsService');

// --- Validación de entrada (barrera de seguridad OWASP) ---

const isValidTime = (t) => /^\d{2}:\d{2}$/.test(t);
const isValidDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));

const validateTurnos = (turnos) =>
  turnos.every((t) => isValidTime(t.hora_inicio) && isValidTime(t.hora_fin))
    ? null
    : 'Cada turno requiere hora_inicio y hora_fin en formato HH:MM';

const validateBody = ({ empleado_id, fecha, turnos }) => {
  if (!empleado_id || !fecha || !Array.isArray(turnos) || turnos.length === 0)
    return 'Faltan campos requeridos: empleado_id, fecha, turnos[]';
  if (!isValidDate(fecha)) return 'Formato de fecha inválido. Use YYYY-MM-DD';
  return validateTurnos(turnos);
};

// --- Helpers de normalización ---

const normalizeTurnos = (turnos, fecha, es_festivo) =>
  turnos.map((t) => ({ ...t, fecha, es_festivo: Boolean(es_festivo) }));

// --- Queries parametrizadas (sin concatenación de strings SQL) ---

const insertHistorial = (client, { empleado_id, fecha, puntos, es_turno_partido }) =>
  client.query(
    `INSERT INTO historial_puntos_diarios (usuario_id, fecha, puntos_totales, es_turno_partido)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [empleado_id, fecha, puntos, es_turno_partido]
  );

const insertTurnos = (client, historial_id, empleado_id, turnos) =>
  Promise.all(turnos.map((t) =>
    client.query(
      `INSERT INTO turnos_guardados (historial_id, usuario_id, fecha, hora_inicio, hora_fin, es_festivo)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [historial_id, empleado_id, t.fecha, t.hora_inicio, t.hora_fin, t.es_festivo]
    )
  ));

const updateSaldo = (client, empleado_id, puntos) =>
  client.query(
    'UPDATE usuarios SET saldo_puntos_actual = saldo_puntos_actual + $1 WHERE id = $2',
    [puntos, empleado_id]
  );

// --- Transacción atómica: si falla cualquier paso, se revierte todo ---

const runTransaction = async (empleado_id, fecha, puntos, es_turno_partido, turnos) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await insertHistorial(client, { empleado_id, fecha, puntos, es_turno_partido });
    await insertTurnos(client, rows[0].id, empleado_id, turnos);
    await updateSaldo(client, empleado_id, puntos);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// --- Handler HTTP público ---

const validateDailyJornada = async (req, res) => {
  const { empleado_id, fecha, es_festivo, turnos } = req.body;

  const bodyError = validateBody({ empleado_id, fecha, turnos });
  if (bodyError) return res.status(400).json({ error: bodyError });

  try {
    const normalized      = normalizeTurnos(turnos, fecha, es_festivo);
    const sorted          = [...normalized].sort((a, b) => toMinutes(a.hora_inicio) - toMinutes(b.hora_inicio));
    const puntos          = calcDailyPoints(normalized);
    const es_turno_partido = calcSplitShiftBonus(sorted) > 0;

    await runTransaction(empleado_id, fecha, puntos, es_turno_partido, normalized);

    return res.status(200).json({ empleado_id, fecha, puntos_calculados: puntos, turnos_procesados: turnos.length, es_turno_partido });
  } catch (_) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { validateDailyJornada, runTransaction };
