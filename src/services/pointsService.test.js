// Batería de pruebas unitarias para el Motor de Puntos.
// Cubre todos los casos de borde definidos en la sección 4.3 del proyecto.
//
// Fechas de referencia usadas en las pruebas:
//   2026-05-18 → Lunes   (weekday  x1.0)
//   2026-05-14 → Jueves  (weekday  x1.0)
//   2026-05-15 → Viernes (weekend  x1.5)
//   2026-05-17 → Domingo (weekend  x1.5)

const {
  calcDailyPoints,
  calcShiftPoints,
  calcSplitShiftBonus,
  getDayMult,
  splitBySlots,
  toMinutes,
  getNextDate,
} = require('./pointsService');

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

describe('toMinutes', () => {
  test('convierte "08:00" a 480', () => expect(toMinutes('08:00')).toBe(480));
  test('convierte "00:00" a 0',   () => expect(toMinutes('00:00')).toBe(0));
  test('convierte "16:30" a 990', () => expect(toMinutes('16:30')).toBe(990));
});

describe('getNextDate', () => {
  test('avanza un día normal',         () => expect(getNextDate('2026-05-14')).toBe('2026-05-15'));
  test('avanza fin de mes correctamente', () => expect(getNextDate('2026-05-31')).toBe('2026-06-01'));
});

// ---------------------------------------------------------------------------
// Multiplicadores de calendario
// ---------------------------------------------------------------------------

describe('getDayMult', () => {
  test('Lunes  → x1.0 (weekday)',  () => expect(getDayMult('2026-05-18', false)).toBe(1.0));
  test('Jueves → x1.0 (weekday)',  () => expect(getDayMult('2026-05-14', false)).toBe(1.0));
  test('Viernes → x1.5 (weekend)', () => expect(getDayMult('2026-05-15', false)).toBe(1.5));
  test('Domingo → x1.5 (weekend)', () => expect(getDayMult('2026-05-17', false)).toBe(1.5));
  test('Festivo lunes → x2.0 (prioridad absoluta)', () =>
    expect(getDayMult('2026-05-18', true)).toBe(2.0));
  test('Festivo viernes → x2.0 (prioridad sobre weekend)', () =>
    expect(getDayMult('2026-05-15', true)).toBe(2.0));
});

// ---------------------------------------------------------------------------
// División por franjas horarias
// ---------------------------------------------------------------------------

describe('splitBySlots', () => {
  test('turno dentro de una sola franja (Mañana)', () => {
    const segs = splitBySlots(480, 600); // 08:00–10:00
    expect(segs).toHaveLength(1);
    expect(segs[0]).toEqual({ hours: 2, slotMult: 1.0 });
  });

  test('turno cruzando Mañana → Tarde (15:00–17:00)', () => {
    const segs = splitBySlots(900, 1020);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toEqual({ hours: 1, slotMult: 1.0 }); // 15:00–16:00 Mañana
    expect(segs[1]).toEqual({ hours: 1, slotMult: 1.3 }); // 16:00–17:00 Tarde
  });

  test('turno cruzando Noche → Mañana (07:00–09:00)', () => {
    const segs = splitBySlots(420, 540);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toEqual({ hours: 1, slotMult: 1.6 }); // 07:00–08:00 Noche
    expect(segs[1]).toEqual({ hours: 1, slotMult: 1.0 }); // 08:00–09:00 Mañana
  });

  test('turno atravesando las tres franjas (07:00–17:00)', () => {
    const segs = splitBySlots(420, 1020);
    expect(segs).toHaveLength(3);
    expect(segs[0].hours).toBeCloseTo(1);  // 07:00–08:00 Noche
    expect(segs[1].hours).toBeCloseTo(8);  // 08:00–16:00 Mañana
    expect(segs[2].hours).toBeCloseTo(1);  // 16:00–17:00 Tarde
  });
});

// ---------------------------------------------------------------------------
// Turnos simples (sin cruce de medianoche)
// ---------------------------------------------------------------------------

describe('calcShiftPoints — turnos simples', () => {
  test('1h Mañana en semana → 10 puntos',   () => {
    expect(calcShiftPoints({ hora_inicio: '09:00', hora_fin: '10:00', fecha: '2026-05-18', es_festivo: false }))
      .toBeCloseTo(10);
  });

  test('1h Tarde en semana → 13 puntos', () => {
    expect(calcShiftPoints({ hora_inicio: '17:00', hora_fin: '18:00', fecha: '2026-05-18', es_festivo: false }))
      .toBeCloseTo(13);
  });

  test('1h Noche en semana → 16 puntos', () => {
    expect(calcShiftPoints({ hora_inicio: '02:00', hora_fin: '03:00', fecha: '2026-05-18', es_festivo: false }))
      .toBeCloseTo(16);
  });

  test('1h Mañana en viernes → 15 puntos  (10 × 1.0 × 1.5)', () => {
    expect(calcShiftPoints({ hora_inicio: '09:00', hora_fin: '10:00', fecha: '2026-05-15', es_festivo: false }))
      .toBeCloseTo(15);
  });

  test('1h Mañana en festivo → 20 puntos  (10 × 1.0 × 2.0)', () => {
    expect(calcShiftPoints({ hora_inicio: '09:00', hora_fin: '10:00', fecha: '2026-05-18', es_festivo: true }))
      .toBeCloseTo(20);
  });

  test('1h Tarde en festivo → 26 puntos   (10 × 1.3 × 2.0)', () => {
    expect(calcShiftPoints({ hora_inicio: '17:00', hora_fin: '18:00', fecha: '2026-05-18', es_festivo: true }))
      .toBeCloseTo(26);
  });
});

// ---------------------------------------------------------------------------
// Cruce de franjas horarias
// ---------------------------------------------------------------------------

describe('calcShiftPoints — cruce de franjas', () => {
  test('15:00–17:00 en lunes = 23 puntos  (10 + 13)', () => {
    // 1h × 10 × 1.0 × 1.0 + 1h × 10 × 1.3 × 1.0 = 23
    expect(calcShiftPoints({ hora_inicio: '15:00', hora_fin: '17:00', fecha: '2026-05-18', es_festivo: false }))
      .toBeCloseTo(23);
  });

  test('07:00–09:00 en lunes = 26 puntos  (16 + 10)', () => {
    // 1h × 10 × 1.6 × 1.0 + 1h × 10 × 1.0 × 1.0 = 26
    expect(calcShiftPoints({ hora_inicio: '07:00', hora_fin: '09:00', fecha: '2026-05-18', es_festivo: false }))
      .toBeCloseTo(26);
  });
});

// ---------------------------------------------------------------------------
// Cruce de medianoche
// ---------------------------------------------------------------------------

describe('calcShiftPoints — cruce de medianoche', () => {
  test('Jue 23:00–Vie 01:00 aplica x1.0 antes y x1.5 después de medianoche', () => {
    // Bloque Jue: 1h Tarde  × 10 × 1.3 × 1.0 = 13
    // Bloque Vie: 1h Noche  × 10 × 1.6 × 1.5 = 24  → total 37
    expect(calcShiftPoints({ hora_inicio: '23:00', hora_fin: '01:00', fecha: '2026-05-14', es_festivo: false }))
      .toBeCloseTo(37);
  });

  test('Vie 23:00–Sáb 01:00: ambos bloques con multiplicador de fin de semana', () => {
    // Bloque Vie: 1h Tarde × 10 × 1.3 × 1.5 = 19.5
    // Bloque Sáb: 1h Noche × 10 × 1.6 × 1.5 = 24  → total 43.5
    expect(calcShiftPoints({ hora_inicio: '23:00', hora_fin: '01:00', fecha: '2026-05-15', es_festivo: false }))
      .toBeCloseTo(43.5);
  });
});

// ---------------------------------------------------------------------------
// Bonus de turno partido
// ---------------------------------------------------------------------------

describe('calcSplitShiftBonus', () => {
  const mkShift = (ini, fin) => ({ hora_inicio: ini, hora_fin: fin, fecha: '2026-05-18', es_festivo: false });

  test('hueco de 5h entre dos turnos → +20 puntos', () => {
    expect(calcSplitShiftBonus([mkShift('09:00', '13:00'), mkShift('18:00', '22:00')])).toBe(20);
  });

  test('hueco de exactamente 2h → sin bonus (necesita > 2h)', () => {
    expect(calcSplitShiftBonus([mkShift('09:00', '12:00'), mkShift('14:00', '18:00')])).toBe(0);
  });

  test('hueco de 1h → sin bonus', () => {
    expect(calcSplitShiftBonus([mkShift('09:00', '13:00'), mkShift('14:00', '18:00')])).toBe(0);
  });

  test('un único turno → sin bonus', () => {
    expect(calcSplitShiftBonus([mkShift('09:00', '17:00')])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cálculo completo de jornada diaria
// ---------------------------------------------------------------------------

describe('calcDailyPoints — jornada completa', () => {
  const weekdayShift = (ini, fin) => ({ hora_inicio: ini, hora_fin: fin, fecha: '2026-05-18', es_festivo: false });

  test('turno único: resultado es siempre un entero', () => {
    const result = calcDailyPoints([weekdayShift('15:00', '17:00')]);
    expect(Number.isInteger(result)).toBe(true);
  });

  test('jornada con bonus de turno partido: 09–13 + 18–22 en lunes', () => {
    // Turno 1: 4h Mañana × 10 × 1.0 × 1.0 = 40
    // Turno 2: 4h Tarde  × 10 × 1.3 × 1.0 = 52
    // Bonus: +20  → total 112
    const shifts = [weekdayShift('09:00', '13:00'), weekdayShift('18:00', '22:00')];
    expect(calcDailyPoints(shifts)).toBe(112);
  });

  test('dos turnos con hueco ≤ 2h: sin bonus', () => {
    // Turno 1: 4h Mañana = 40
    // Turno 2: 2h Mañana + 2h Tarde = 20 + 26 = 46  → total 86
    const shifts = [weekdayShift('09:00', '13:00'), weekdayShift('14:00', '18:00')];
    expect(calcDailyPoints(shifts)).toBe(86);
  });

  test('tres turnos: bonus se aplica solo una vez aunque haya dos huecos largos', () => {
    // Turno 1: 08–10 = 2h Mañana = 20
    // Turno 2: 13–15 = 2h Mañana = 20  (hueco 3h → activa bonus)
    // Turno 3: 19–21 = 2h Tarde  = 26  (hueco 4h → no suma segundo bonus)
    // Total: 20 + 20 + 26 + 20 = 86
    const shifts = [
      weekdayShift('08:00', '10:00'),
      weekdayShift('13:00', '15:00'),
      weekdayShift('19:00', '21:00'),
    ];
    expect(calcDailyPoints(shifts)).toBe(86);
  });

  test('jornada en festivo: 1h Mañana + 1h Tarde → 46 puntos  (20 + 26)', () => {
    const holidayShift = (ini, fin) => ({ hora_inicio: ini, hora_fin: fin, fecha: '2026-05-18', es_festivo: true });
    const shifts = [holidayShift('09:00', '10:00'), holidayShift('17:00', '18:00')];
    // Gap: 7h → +20 bonus
    // Total: 20 + 26 + 20 = 66
    expect(calcDailyPoints(shifts)).toBe(66);
  });
});
