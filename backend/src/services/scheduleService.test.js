const { SCHEDULE_CONFIG } = require('../config/constants');
const { __testables } = require('./scheduleService');

const buildEmployees = () =>
  Array.from({ length: 6 }, (_, index) => ({ id: index + 1, name: `Empleado ${index + 1}` }));

const buildWeekDayCounts = (days, month, year) =>
  days.reduce((acc, day) => {
    const weekKey = __testables.toWeekKey(year, month, day);
    acc[weekKey] = (acc[weekKey] || 0) + 1;
    return acc;
  }, {});

const createWeeklyTracker = (employees, weekKeys) =>
  employees.reduce((acc, employee) => {
    acc[employee.id] = weekKeys.reduce((weekAcc, key) => ({ ...weekAcc, [key]: { hours: 0, workedDays: 0 } }), {});
    return acc;
  }, {});

const applyAssignment = (tracker, assignment, weekKey, blocksById) => {
  const block = blocksById[assignment.blockId];
  if (!block) return;
  const employeeWeek = tracker[assignment.employeeId][weekKey];
  employeeWeek.hours += __testables.hoursFromBlock(block);
  employeeWeek.workedDays += 1;
};

describe('scheduleService guardrails', () => {
  it('deberia generar un mes donde ningun empleado supere las 40h semanales y todos tengan al menos 2 dias libres por semana', () => {
    const month = 5;
    const year = 2026;
    const employees = buildEmployees();
    const days = __testables.getMonthDays(year, month);
    const blocks = [...SCHEDULE_CONFIG.DEFAULT_BLOCKS];
    const { plan } = __testables.generateAutoPlan(employees, days, blocks, month, year);
    const weekDayCounts = buildWeekDayCounts(days, month, year);
    const weekKeys = Object.keys(weekDayCounts);
    const tracker = createWeeklyTracker(employees, weekKeys);
    const blocksById = blocks.reduce((acc, block) => ({ ...acc, [block.id]: block }), {});

    for (const assignment of Object.values(plan)) {
      const weekKey = __testables.toWeekKey(year, month, assignment.day);
      applyAssignment(tracker, assignment, weekKey, blocksById);
    }

    for (const employee of employees) {
      for (const weekKey of weekKeys) {
        const weekStats = tracker[employee.id][weekKey];
        const freeDays = weekDayCounts[weekKey] - weekStats.workedDays;
        expect(weekStats.hours).toBeLessThanOrEqual(SCHEDULE_CONFIG.WEEKLY_HOURS_LIMIT);
        expect(freeDays).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
