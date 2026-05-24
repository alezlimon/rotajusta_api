const { SCHEDULE_CONFIG } = require('../config/constants');
const { pool } = require('../config/db');
const { calcShiftPoints } = require('./pointsService');

const getMonthDays = (year, month) => {
  const total = new Date(year, month, 0).getDate();
  return Array.from({ length: total }, (_, i) => i + 1);
};

const makeCellKey = (employeeId, day) => `${employeeId}-${day}`;

const toBlockPayload = (row) => ({
  id: row.block_id,
  name: row.name,
  start: row.start_time.slice(0, 5),
  end: row.end_time.slice(0, 5),
  color: row.color,
});

const toAssignmentPayload = (row) => ({ employeeId: row.employee_id, day: row.day_of_month, blockId: row.block_id });

const toAssignmentsMap = (rows) =>
  rows.reduce((acc, row) => ({ ...acc, [makeCellKey(row.employee_id, row.day_of_month)]: toAssignmentPayload(row) }), {});

const toIsoDate = (year, month, day) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const toWeekKey = (year, month, day) => {
  const date = new Date(year, month - 1, day);
  const weekday = (date.getDay() + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - weekday);
  return monday.toISOString().slice(0, 10);
};

const createStats = (employees) =>
  employees.reduce((acc, employee) => ({ ...acc, [employee.id]: { points: 0, worked: 0, lastNightDay: null } }), {});

const toBlockIndex = (blocks) =>
  blocks.reduce((acc, block) => ({ ...acc, [block.id]: block }), {});

const emptyAuditRow = (employee, totalDays) => ({
  employeeId: employee.id,
  employeeName: employee.name,
  totalPoints: 0,
  workedDays: 0,
  freeDays: totalDays,
  nightShifts: 0,
  totalHours: 0,
  peakWeeklyHours: 0,
  monthlyOverload: false,
  weeklyOverload: false,
  overloadLabel: 'OK',
  weeklyHours: {},
});

const isNightAssignment = (blockIndex, assignment) =>
  isNightBlock(blockIndex[assignment.blockId]);

const pointsFromAssignment = (blockIndex, assignment, year, month) => {
  const block = blockIndex[assignment.blockId];
  if (!block) return 0;
  const date = toIsoDate(year, month, assignment.day);
  return Math.round(blockEffortPoints(block, date));
};

const hoursFromBlock = (block) => {
  if (!block) return 0;
  const toMinutes = (timeValue) => {
    const [hours, minutes] = timeValue.split(':').map(Number);
    return hours * 60 + minutes;
  };
  const start = toMinutes(block.start);
  const end = toMinutes(block.end);
  const minutes = end > start ? end - start : 1440 - start + end;
  return minutes / 60;
};

const toOverloadLabel = (row) => {
  if (row.weeklyOverload) return 'Sobrecarga';
  if (row.monthlyOverload) return 'Horas Extra';
  return 'OK';
};

const applyOverloadFlags = (row) => {
  row.weeklyOverload = row.peakWeeklyHours > SCHEDULE_CONFIG.WEEKLY_HOURS_LIMIT;
  row.monthlyOverload = row.totalHours > SCHEDULE_CONFIG.MONTHLY_HOURS_LIMIT;
  row.overloadLabel = toOverloadLabel(row);
};

const fairnessFromDiff = (diff) => {
  if (diff < SCHEDULE_CONFIG.FAIRNESS_HIGH_MAX_DIFF) {
    return { fairnessLevel: 'high', fairnessLabel: 'Equidad Alta' };
  }
  if (diff <= SCHEDULE_CONFIG.FAIRNESS_MEDIUM_MAX_DIFF) {
    return { fairnessLevel: 'medium', fairnessLabel: 'Equidad Media' };
  }
  return { fairnessLevel: 'low', fairnessLabel: 'Desequilibrio detectado' };
};

const buildAuditLimits = () => ({
  fairnessHighMaxDiff: SCHEDULE_CONFIG.FAIRNESS_HIGH_MAX_DIFF,
  fairnessMediumMaxDiff: SCHEDULE_CONFIG.FAIRNESS_MEDIUM_MAX_DIFF,
  weeklyHoursLimit: SCHEDULE_CONFIG.WEEKLY_HOURS_LIMIT,
  monthlyHoursLimit: SCHEDULE_CONFIG.MONTHLY_HOURS_LIMIT,
});

const buildAuditSummary = (rows) => {
  if (rows.length < 2) {
    return { dispersionPoints: 0, fairnessLevel: 'neutral', fairnessLabel: 'Sin datos suficientes', limits: buildAuditLimits() };
  }
  const points = rows.map((row) => row.totalPoints);
  const dispersionPoints = Math.max(...points) - Math.min(...points);
  return { dispersionPoints, ...fairnessFromDiff(dispersionPoints), limits: buildAuditLimits() };
};

const toAuditResponseRow = (row) => {
  const { weeklyHours, ...rest } = row;
  return rest;
};

const buildAudit = ({ employees, assignments, blocks, month, year, totalDays }) => {
  const blockIndex = toBlockIndex(blocks);
  const byEmployee = employees.reduce((acc, employee) => ({ ...acc, [employee.id]: emptyAuditRow(employee, totalDays) }), {});
  for (const assignment of Object.values(assignments)) {
    if (!assignment) continue;
    const row = byEmployee[assignment.employeeId];
    if (!row) continue;
    const block = blockIndex[assignment.blockId];
    const weekKey = toWeekKey(year, month, assignment.day);
    const blockHours = hoursFromBlock(block);
    row.totalPoints += pointsFromAssignment(blockIndex, assignment, year, month);
    row.workedDays += 1;
    row.freeDays = Math.max(0, totalDays - row.workedDays);
    row.nightShifts += isNightAssignment(blockIndex, assignment) ? 1 : 0;
    row.totalHours += blockHours;
    row.weeklyHours[weekKey] = (row.weeklyHours[weekKey] || 0) + blockHours;
    row.peakWeeklyHours = Math.max(row.peakWeeklyHours, row.weeklyHours[weekKey]);
  }
  const rows = Object.values(byEmployee)
    .map((row) => ({ ...row, totalHours: Math.round(row.totalHours * 100) / 100, peakWeeklyHours: Math.round(row.peakWeeklyHours * 100) / 100 }))
    .map((row) => {
      applyOverloadFlags(row);
      return toAuditResponseRow(row);
    })
    .sort((a, b) => a.totalPoints - b.totalPoints);
  return { summary: buildAuditSummary(rows), byEmployee: rows };
};

const toSchedulePayload = ({ month, year, days, blocks, employees, assignments }) => ({
  month,
  year,
  days,
  blocks,
  employees,
  assignments,
  audit: buildAudit({ employees, assignments, blocks, month, year, totalDays: days.length }),
});

const isNightBlock = (block) => {
  const name = (block.name || '').toLowerCase();
  return name.includes('noche') || (block.start === '00:00' && block.end === '08:00');
};

const isMorningOrAfternoon = (block) => {
  const name = (block.name || '').toLowerCase();
  if (name.includes('manana') || name.includes('mañana') || name.includes('tarde')) return true;
  return block.start !== '00:00' || block.end !== '08:00';
};

const violatesRestRule = (stats, employeeId, day, block) => {
  const lastNightDay = stats[employeeId]?.lastNightDay;
  if (lastNightDay !== day - 1) return false;
  return isMorningOrAfternoon(block);
};

const blockEffortPoints = (block, date) =>
  calcShiftPoints({ hora_inicio: block.start, hora_fin: block.end, fecha: date, es_festivo: false });

const byEffortDesc = (date) => (a, b) => blockEffortPoints(b, date) - blockEffortPoints(a, date);

const byFairness = (stats) => (a, b) => {
  const scoreA = stats[a.id].points * 100 + stats[a.id].worked;
  const scoreB = stats[b.id].points * 100 + stats[b.id].worked;
  if (scoreA !== scoreB) return scoreA - scoreB;
  return a.id - b.id;
};

const availableEmployees = (employees, assignedToday) =>
  employees.filter((employee) => !assignedToday.has(employee.id));

const pickEmployee = (employees, stats, assignedToday, day, block) => {
  const available = availableEmployees(employees, assignedToday).sort(byFairness(stats));
  const valid = available.filter((employee) => !violatesRestRule(stats, employee.id, day, block));
  return (valid[0] || available[0] || null);
};

const applyAssignment = (plan, stats, assignment, date, block) => {
  const key = makeCellKey(assignment.employeeId, assignment.day);
  const points = blockEffortPoints(block, date);
  plan[key] = assignment;
  stats[assignment.employeeId].points += points;
  stats[assignment.employeeId].worked += 1;
  if (isNightBlock(block)) stats[assignment.employeeId].lastNightDay = assignment.day;
};

const assignDay = (plan, stats, employees, day, date, blocks) => {
  const assignedToday = new Set();
  const rankedBlocks = [...blocks].sort(byEffortDesc(date));
  for (const block of rankedBlocks) {
    const employee = pickEmployee(employees, stats, assignedToday, day, block);
    if (!employee) continue;
    const assignment = { employeeId: employee.id, day, blockId: block.id };
    applyAssignment(plan, stats, assignment, date, block);
    assignedToday.add(employee.id);
  }
};

const generateAutoPlan = (employees, days, blocks, month, year) => {
  const plan = {};
  const stats = createStats(employees);
  for (const day of days) {
    const date = toIsoDate(year, month, day);
    assignDay(plan, stats, employees, day, date, blocks);
  }
  return plan;
};

const findBlocks = async (client, month, year) => {
  const query = 'SELECT block_id, name, start_time, end_time, color FROM schedule_blocks WHERE year = $1 AND month = $2 ORDER BY id ASC';
  const { rows } = await client.query(query, [year, month]);
  return rows.map(toBlockPayload);
};

const insertDefaultBlocks = async (client, month, year) => {
  const query = 'INSERT INTO schedule_blocks (year, month, block_id, name, start_time, end_time, color) VALUES ($1, $2, $3, $4, $5, $6, $7)';
  for (const block of SCHEDULE_CONFIG.DEFAULT_BLOCKS) {
    await client.query(query, [year, month, block.id, block.name, block.start, block.end, block.color]);
  }
};

const ensureBlocks = async (client, month, year) => {
  const blocks = await findBlocks(client, month, year);
  if (blocks.length) return blocks;
  await insertDefaultBlocks(client, month, year);
  return findBlocks(client, month, year);
};

const findAssignments = async (client, month, year) => {
  const query = 'SELECT employee_id, day_of_month, block_id FROM schedule_assignments WHERE year = $1 AND month = $2';
  const { rows } = await client.query(query, [year, month]);
  return toAssignmentsMap(rows);
};

const clearBlocks = (client, month, year) =>
  client.query('DELETE FROM schedule_blocks WHERE year = $1 AND month = $2', [year, month]);

const clearAssignments = (client, month, year) =>
  client.query('DELETE FROM schedule_assignments WHERE year = $1 AND month = $2', [year, month]);

const insertBlocks = async (client, month, year, blocks) => {
  const query = 'INSERT INTO schedule_blocks (year, month, block_id, name, start_time, end_time, color) VALUES ($1, $2, $3, $4, $5, $6, $7)';
  for (const block of blocks) {
    await client.query(query, [year, month, block.id, block.name, block.start, block.end, block.color]);
  }
};

const insertAssignments = async (client, month, year, assignments) => {
  const query = 'INSERT INTO schedule_assignments (year, month, employee_id, day_of_month, block_id) VALUES ($1, $2, $3, $4, $5)';
  const values = Object.values(assignments);
  for (const assignment of values) {
    await client.query(query, [year, month, assignment.employeeId, assignment.day, assignment.blockId]);
  }
};

const getScheduleBootstrap = async ({ month, year, employees }) => {
  const client = await pool.connect();
  try {
    const blocks = await ensureBlocks(client, month, year);
    const assignments = await findAssignments(client, month, year);
    const days = getMonthDays(year, month);
    return toSchedulePayload({ month, year, days, blocks, employees, assignments });
  } finally {
    client.release();
  }
};

const generateSchedule = async ({ month, year, employees, blocks }) => {
  const client = await pool.connect();
  const days = getMonthDays(year, month);
  try {
    await client.query('BEGIN');
    await clearBlocks(client, month, year);
    await clearAssignments(client, month, year);
    const finalBlocks = blocks.length ? blocks : [...SCHEDULE_CONFIG.DEFAULT_BLOCKS];
    await insertBlocks(client, month, year, finalBlocks);
    const assignments = generateAutoPlan(employees, days, finalBlocks, month, year);
    await insertAssignments(client, month, year, assignments);
    await client.query('COMMIT');
    return toSchedulePayload({ month, year, days, blocks: finalBlocks, employees, assignments });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const findSourceAssignment = (client, month, year, from) =>
  client.query(
    'SELECT id, block_id FROM schedule_assignments WHERE year = $1 AND month = $2 AND employee_id = $3 AND day_of_month = $4 LIMIT 1',
    [year, month, from.employeeId, from.day]
  );

const findTargetAssignment = (client, month, year, to) =>
  client.query(
    'SELECT id, block_id FROM schedule_assignments WHERE year = $1 AND month = $2 AND employee_id = $3 AND day_of_month = $4 LIMIT 1',
    [year, month, to.employeeId, to.day]
  );

const deleteAssignmentById = (client, id) =>
  client.query('DELETE FROM schedule_assignments WHERE id = $1', [id]);

const updateAssignmentCell = (client, id, employeeId, day) =>
  client.query(
    'UPDATE schedule_assignments SET employee_id = $1, day_of_month = $2, updated_at = NOW() WHERE id = $3',
    [employeeId, day, id]
  );

const insertAssignment = (client, month, year, employeeId, day, blockId) =>
  client.query(
    'INSERT INTO schedule_assignments (year, month, employee_id, day_of_month, block_id) VALUES ($1, $2, $3, $4, $5)',
    [year, month, employeeId, day, blockId]
  );

const moveAssignment = async ({ month, year, from, to }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: sourceRows } = await findSourceAssignment(client, month, year, from);
    const source = sourceRows[0];
    if (!source) {
      await client.query('ROLLBACK');
      return null;
    }

    const { rows: targetRows } = await findTargetAssignment(client, month, year, to);
    const target = targetRows[0] || null;

    if (!target) {
      await updateAssignmentCell(client, source.id, to.employeeId, to.day);
    } else {
      await deleteAssignmentById(client, target.id);
      await updateAssignmentCell(client, source.id, to.employeeId, to.day);
      await insertAssignment(client, month, year, from.employeeId, from.day, target.block_id);
    }

    await client.query('COMMIT');
    return { employeeId: to.employeeId, day: to.day, blockId: source.block_id, mode: target ? 'swap' : 'move' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { getScheduleBootstrap, generateSchedule, moveAssignment };