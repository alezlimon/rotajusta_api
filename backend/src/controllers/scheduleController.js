const { pool } = require('../config/db');
const { SCHEDULE_CONFIG } = require('../config/constants');
const { getScheduleBootstrap, generateSchedule, moveAssignment } = require('../services/scheduleService');

const parseMonthYear = ({ month, year }) => {
  const parsedMonth = Number(month);
  const parsedYear = Number(year);
  const monthOk = parsedMonth >= SCHEDULE_CONFIG.MIN_MONTH && parsedMonth <= SCHEDULE_CONFIG.MAX_MONTH;
  const yearOk = parsedYear >= SCHEDULE_CONFIG.MIN_YEAR && parsedYear <= SCHEDULE_CONFIG.MAX_YEAR;
  return monthOk && yearOk ? { month: parsedMonth, year: parsedYear } : null;
};

const findEmployees = async () => {
  const query = 'SELECT id, nombre FROM usuarios WHERE rol = $1 ORDER BY nombre ASC';
  const { rows } = await pool.query(query, ['EMPLOYEE']);
  return rows.map((row) => ({ id: row.id, name: row.nombre }));
};

const sendInvalidMonthYear = (res) =>
  res.status(400).json({ error: 'Mes o ano invalido. Use month=1..12 y year=2024..2099' });

const getBootstrap = async (req, res) => {
  const parsed = parseMonthYear(req.query);
  if (!parsed) return sendInvalidMonthYear(res);
  try {
    const employees = await findEmployees();
    const payload = await getScheduleBootstrap({ ...parsed, employees });
    return res.status(200).json(payload);
  } catch (_) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const postGenerate = async (req, res) => {
  const parsed = parseMonthYear(req.body);
  if (!parsed) return sendInvalidMonthYear(res);
  try {
    const employees = await findEmployees();
    const blocks = Array.isArray(req.body.blocks) ? req.body.blocks : [];
    const payload = await generateSchedule({ ...parsed, employees, blocks });
    return res.status(200).json(payload);
  } catch (_) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const patchAssignment = async (req, res) => {
  const parsed = parseMonthYear(req.body);
  if (!parsed) return sendInvalidMonthYear(res);
  const { from, to } = req.body;
  if (!from?.employeeId || !from?.day || !to?.employeeId || !to?.day) {
    return res.status(400).json({ error: 'from/to requeridos con employeeId y day' });
  }
  const assignment = await moveAssignment({ ...parsed, from, to });
  if (!assignment) return res.status(404).json({ error: 'No hay turno en la celda de origen' });
  return res.status(200).json({ assignment });
};

module.exports = { getBootstrap, postGenerate, patchAssignment };