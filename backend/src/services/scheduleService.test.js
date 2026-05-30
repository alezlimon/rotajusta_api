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

const plannedRestDaysForEmployeeWeek = ({ restPlan, employeeId, weekDays }) =>
  weekDays.filter((day) => Boolean(restPlan[`${employeeId}-${day}`]));

const areConsecutive = (days) => {
  if (days.length < 2) return true;
  return days[1] - days[0] === 1;
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
        const expectedMinFreeDays = weekDayCounts[weekKey] > 1
          ? SCHEDULE_CONFIG.HARD_MIN_FREE_DAYS_PER_WEEK
          : 0;
        expect(weekStats.hours).toBeLessThanOrEqual(SCHEDULE_CONFIG.WEEKLY_HOURS_LIMIT);
        expect(freeDays).toBeGreaterThanOrEqual(expectedMinFreeDays);
      }
    }
  });

  it('deberia preasignar 2 libranzas consecutivas por empleado en semanas completas', () => {
    const month = 5;
    const year = 2026;
    const employees = buildEmployees();
    const days = __testables.getMonthDays(year, month);
    const restPlan = __testables.buildRestPlan(employees, days, month, year);
    const detailedWeeks = __testables.weekDaysMapDetailed(days, month, year);

    for (const weekDays of Object.values(detailedWeeks)) {
      if (weekDays.length < 7) continue;
      for (const employee of employees) {
        const restDays = plannedRestDaysForEmployeeWeek({ restPlan, employeeId: employee.id, weekDays });
        expect(restDays.length).toBe(2);
        expect(areConsecutive(restDays)).toBe(true);
      }
    }
  });

  it('deberia mantener patron preferido de maximo 5 dias trabajados por semana con plantilla suficiente', () => {
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
        if (weekDayCounts[weekKey] < 7) continue;
        expect(tracker[employee.id][weekKey].workedDays).toBeLessThanOrEqual(5);
      }
    }
  });

  it('deberia calcular metricas de realismo (5+2 y motivos de fallback)', () => {
    const month = 5;
    const year = 2026;
    const employees = buildEmployees();
    const days = __testables.getMonthDays(year, month);
    const blocks = [...SCHEDULE_CONFIG.DEFAULT_BLOCKS];
    const { plan, alerts } = __testables.generateAutoPlan(employees, days, blocks, month, year);
    const restPlan = __testables.buildRestPlan(employees, days, month, year);
    const realism = __testables.realismSummary({ employees, assignments: plan, days, month, year, alerts, restPlan });

    expect(realism.fullWeekSlots).toBeGreaterThan(0);
    expect(realism.preferredBreaksRespected).toBeGreaterThanOrEqual(0);
    expect(realism.preferredBreaksRespected).toBeLessThanOrEqual(realism.fullWeekSlots);
    expect(realism.fallback6x1Count).toBeGreaterThanOrEqual(0);
    expect(realism.plannedRestOverrides).toBeGreaterThanOrEqual(0);
    expect(typeof realism.fallbackReasons).toBe('object');
  });
});
