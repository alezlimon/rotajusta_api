const { SCHEDULE_CONFIG } = require('../config/constants');
const { pool } = require('../config/db');

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

const createAutoPlan = (employees, days, blocks) =>
  employees.reduce((acc, employee, rowIndex) => {
    days.forEach((day) => {
      const block = blocks[(day + rowIndex) % blocks.length];
      acc[makeCellKey(employee.id, day)] = { employeeId: employee.id, day, blockId: block.id };
    });
    return acc;
  }, {});

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
    return { month, year, days: getMonthDays(year, month), blocks, employees, assignments };
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
    const assignments = createAutoPlan(employees, days, finalBlocks);
    await insertAssignments(client, month, year, assignments);
    await client.query('COMMIT');
    return { month, year, days, blocks: finalBlocks, employees, assignments };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const findSourceAssignment = (client, month, year, from) =>
  client.query(
    'SELECT block_id FROM schedule_assignments WHERE year = $1 AND month = $2 AND employee_id = $3 AND day_of_month = $4 LIMIT 1',
    [year, month, from.employeeId, from.day]
  );

const moveAssignment = async ({ month, year, from, to }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await findSourceAssignment(client, month, year, from);
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query('DELETE FROM schedule_assignments WHERE year = $1 AND month = $2 AND employee_id = $3 AND day_of_month = $4', [year, month, to.employeeId, to.day]);
    await client.query(
      'UPDATE schedule_assignments SET employee_id = $1, day_of_month = $2, updated_at = NOW() WHERE year = $3 AND month = $4 AND employee_id = $5 AND day_of_month = $6',
      [to.employeeId, to.day, year, month, from.employeeId, from.day]
    );
    await client.query('COMMIT');
    return { employeeId: to.employeeId, day: to.day, blockId: rows[0].block_id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { getScheduleBootstrap, generateSchedule, moveAssignment };