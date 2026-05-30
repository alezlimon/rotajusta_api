// Controlador de Turnos — Capa HTTP. No contiene lógica de negocio ni SQL inline.
// Responsabilidad: validar la petición, orquestar servicios y devolver la respuesta.

const { pool } = require('../config/db');
const { calcDailyPoints, calcDailyPointsDetail, calcSplitShiftBonus, toMinutes } = require('../services/pointsService');

// --- Validación de entrada (barrera de seguridad OWASP) ---

const isValidTime = (t) => /^\d{2}:\d{2}$/.test(t);
const isValidDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));

const validateTurnos = (turnos) =>
  turnos.every((t) => isValidTime(t.hora_inicio) && isValidTime(t.hora_fin))
    ? null
    : 'Cada turno requiere hora_inicio y hora_fin en formato HH:MM';

const validateManualTurnoBody = ({ empleado_id, fecha, hora_inicio, hora_fin }) => {
  if (!empleado_id || !fecha || !hora_inicio || !hora_fin) {
    return 'Faltan campos requeridos: empleado_id, fecha, hora_inicio, hora_fin';
  }
  if (!isValidDate(fecha)) return 'Formato de fecha inválido. Use YYYY-MM-DD';
  if (!isValidTime(hora_inicio) || !isValidTime(hora_fin)) return 'hora_inicio y hora_fin deben estar en formato HH:MM';
  return null;
};

const validateBody = ({ empleado_id, fecha, turnos }) => {
  if (!empleado_id || !fecha || !Array.isArray(turnos) || turnos.length === 0)
    return 'Faltan campos requeridos: empleado_id, fecha, turnos[]';
  if (!isValidDate(fecha)) return 'Formato de fecha inválido. Use YYYY-MM-DD';
  return validateTurnos(turnos);
};

// --- Helpers de normalización ---

const normalizeTurnos = (turnos, fecha, es_festivo) =>
  turnos.map((t) => ({ ...t, fecha, es_festivo: Boolean(es_festivo) }));

const normalizeManualTurno = ({ fecha, hora_inicio, hora_fin, es_festivo }) => ({
  fecha,
  hora_inicio,
  hora_fin,
  es_festivo: Boolean(es_festivo),
});

const selectHistorial = (client, empleado_id, fecha) =>
  client.query(
    'SELECT id, puntos_totales FROM historial_puntos_diarios WHERE usuario_id = $1 AND fecha = $2 LIMIT 1',
    [empleado_id, fecha]
  );

const selectTurnos = (client, empleado_id, fecha) =>
  client.query(
    'SELECT id, usuario_id, fecha, hora_inicio, hora_fin, es_festivo FROM turnos_guardados WHERE usuario_id = $1 AND fecha = $2 ORDER BY hora_inicio ASC, id ASC',
    [empleado_id, fecha]
  );

const selectHistorialWithDetail = (client, empleado_id, fecha) =>
  client.query(
    'SELECT id, usuario_id, fecha, puntos_totales, es_turno_partido, desglose FROM historial_puntos_diarios WHERE usuario_id = $1 AND fecha = $2 LIMIT 1',
    [empleado_id, fecha]
  );

const selectTurnoById = (client, turno_id) =>
  client.query(
    'SELECT id, historial_id, usuario_id, fecha, hora_inicio, hora_fin, es_festivo FROM turnos_guardados WHERE id = $1 LIMIT 1',
    [turno_id]
  );

const insertTurno = (client, empleado_id, turno) =>
  client.query(
    `INSERT INTO turnos_guardados (historial_id, usuario_id, fecha, hora_inicio, hora_fin, es_festivo)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [turno.historial_id, empleado_id, turno.fecha, turno.hora_inicio, turno.hora_fin, turno.es_festivo]
  );

const updateTurnoRow = (client, turno_id, turno) =>
  client.query(
    'UPDATE turnos_guardados SET hora_inicio = $1, hora_fin = $2, es_festivo = $3 WHERE id = $4',
    [turno.hora_inicio, turno.hora_fin, turno.es_festivo, turno_id]
  );

const deleteTurnoRow = (client, turno_id) =>
  client.query('DELETE FROM turnos_guardados WHERE id = $1', [turno_id]);

const deleteHistorialRow = (client, empleado_id, fecha) =>
  client.query('DELETE FROM historial_puntos_diarios WHERE usuario_id = $1 AND fecha = $2', [empleado_id, fecha]);

const upsertHistorialRow = (client, empleado_id, fecha, puntos, es_turno_partido) =>
  client.query(
    `INSERT INTO historial_puntos_diarios (usuario_id, fecha, puntos_totales, es_turno_partido, desglose)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (usuario_id, fecha) DO UPDATE
     SET puntos_totales = EXCLUDED.puntos_totales,
         es_turno_partido = EXCLUDED.es_turno_partido,
         desglose = EXCLUDED.desglose
     RETURNING id`,
    [empleado_id, fecha, puntos, es_turno_partido, { origen: 'manual' }]
  );

const ensureHistorialRow = async (client, empleado_id, fecha) => {
  const { rows } = await selectHistorial(client, empleado_id, fecha);
  if (rows[0]) return rows[0];
  const { rows: inserted } = await client.query(
    `INSERT INTO historial_puntos_diarios (usuario_id, fecha, puntos_totales, es_turno_partido, desglose)
     VALUES ($1, $2, 0, false, $3) RETURNING id, puntos_totales`,
    [empleado_id, fecha, { origen: 'manual', vacio: true }]
  );
  return inserted[0];
};

const updateSaldoDelta = (client, empleado_id, delta) =>
  client.query(
    'UPDATE usuarios SET saldo_puntos_actual = GREATEST(saldo_puntos_actual + $1, 0) WHERE id = $2',
    [delta, empleado_id]
  );

const recalculateDailyRecord = async (client, empleado_id, fecha) => {
  const { rows: historialRows } = await selectHistorial(client, empleado_id, fecha);
  const historial = historialRows[0] || null;
  const { rows: turnosRows } = await selectTurnos(client, empleado_id, fecha);
  if (!turnosRows.length) {
    if (!historial) return { puntos: 0, delta: 0 };
    await deleteHistorialRow(client, empleado_id, fecha);
    return { puntos: 0, delta: -historial.puntos_totales };
  }
  const turnos = turnosRows.map((turno) => ({ ...turno, es_festivo: Boolean(turno.es_festivo) }));
  const puntosDetail = calcDailyPointsDetail(turnos);
  const puntos = puntosDetail.puntos_totales;
  const es_turno_partido = calcSplitShiftBonus(turnos) > 0;
  const previousPoints = historial?.puntos_totales || 0;
  await upsertHistorialRow(client, empleado_id, fecha, puntos, es_turno_partido);
  return { puntos, delta: puntos - previousPoints, desglose: puntosDetail, es_turno_partido };
};

const listManualTurns = async (req, res) => {
  const empleadoId = Number(req.query.empleado_id);
  const { fecha } = req.query;
  if (!Number.isFinite(empleadoId) || empleadoId < 1 || !isValidDate(fecha)) {
    return res.status(400).json({ error: 'empleado_id y fecha válidos son obligatorios' });
  }

  const client = await pool.connect();
  try {
    const { rows: turnos } = await selectTurnos(client, empleadoId, fecha);
    const { rows: historialRows } = await selectHistorialWithDetail(client, empleadoId, fecha);
    return res.status(200).json({
      turnos,
      jornada: historialRows[0] || null,
    });
  } catch (_) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

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
    'UPDATE usuarios SET saldo_puntos_actual = GREATEST(saldo_puntos_actual + $1, 0) WHERE id = $2',
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
    const puntosDetail    = calcDailyPointsDetail(normalized);
    const puntos          = puntosDetail.puntos_totales;
    const es_turno_partido = calcSplitShiftBonus(sorted) > 0;

    await runTransaction(empleado_id, fecha, puntos, es_turno_partido, normalized);

    return res.status(200).json({
      empleado_id,
      fecha,
      puntos_calculados: puntos,
      turnos_procesados: turnos.length,
      es_turno_partido,
      desglose: puntosDetail,
    });
  } catch (_) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createManualTurn = async (req, res) => {
  const { empleado_id, fecha, hora_inicio, hora_fin, es_festivo } = req.body;
  const bodyError = validateManualTurnoBody({ empleado_id, fecha, hora_inicio, hora_fin });
  if (bodyError) return res.status(400).json({ error: bodyError });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const turnosPayload = normalizeManualTurno({ fecha, hora_inicio, hora_fin, es_festivo });
    const historial = await ensureHistorialRow(client, empleado_id, fecha);
    const { rows } = await insertTurno(client, empleado_id, { ...turnosPayload, historial_id: historial.id });
    const recalc = await recalculateDailyRecord(client, empleado_id, fecha);
    await updateSaldo(client, empleado_id, recalc.delta);
    await client.query('COMMIT');
    return res.status(201).json({ turno: { id: rows[0].id, empleado_id, ...turnosPayload }, jornada: recalc });
  } catch (_) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

const updateManualTurn = async (req, res) => {
  const turnoId = Number(req.params.turno_id);
  const { empleado_id, fecha, hora_inicio, hora_fin, es_festivo } = req.body;
  const bodyError = validateManualTurnoBody({ empleado_id, fecha, hora_inicio, hora_fin });
  if (!Number.isFinite(turnoId) || turnoId < 1) return res.status(400).json({ error: 'turno_id inválido' });
  if (bodyError) return res.status(400).json({ error: bodyError });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: existingRows } = await selectTurnoById(client, turnoId);
    const existing = existingRows[0] || null;
    if (!existing) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No existe el turno' });
    }
    if (existing.usuario_id !== empleado_id || existing.fecha !== fecha) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'En esta versión solo se permite editar horas y festivo del mismo empleado y fecha' });
    }
    await updateTurnoRow(client, turnoId, normalizeManualTurno({ fecha, hora_inicio, hora_fin, es_festivo }));
    const recalc = await recalculateDailyRecord(client, empleado_id, fecha);
    await updateSaldo(client, empleado_id, recalc.delta);
    await client.query('COMMIT');
    return res.status(200).json({ turno: { id: turnoId, empleado_id, fecha, hora_inicio, hora_fin, es_festivo: Boolean(es_festivo) }, jornada: recalc });
  } catch (_) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

const deleteManualTurn = async (req, res) => {
  const turnoId = Number(req.params.turno_id);
  if (!Number.isFinite(turnoId) || turnoId < 1) return res.status(400).json({ error: 'turno_id inválido' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await selectTurnoById(client, turnoId);
    const turno = rows[0] || null;
    if (!turno) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No existe el turno' });
    }
    await deleteTurnoRow(client, turnoId);
    const recalc = await recalculateDailyRecord(client, turno.usuario_id, turno.fecha);
    await updateSaldo(client, turno.usuario_id, recalc.delta);
    await client.query('COMMIT');
    return res.status(200).json({ deleted: true, turno_id: turnoId, jornada: recalc });
  } catch (_) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

module.exports = {
  validateDailyJornada,
  runTransaction,
  listManualTurns,
  createManualTurn,
  updateManualTurn,
  deleteManualTurn,
};
