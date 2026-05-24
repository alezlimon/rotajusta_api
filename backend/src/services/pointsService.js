// Motor de Puntos — Funciones puras sin efectos secundarios.
// Cada función tiene una única responsabilidad (SRP) y < 25 líneas.

const { POINTS_CONFIG } = require('../config/constants');

// Convierte "HH:MM" a minutos desde medianoche.
const toMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

// Devuelve la fecha siguiente en formato "YYYY-MM-DD".
const getNextDate = (dateStr) => {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const next = new Date(y, mo - 1, d + 1);
  const mm = String(next.getMonth() + 1).padStart(2, '0');
  const dd = String(next.getDate()).padStart(2, '0');
  return `${next.getFullYear()}-${mm}-${dd}`;
};

// Devuelve el multiplicador de calendario para una fecha dada.
const getDayMult = (dateStr, esHoliday) => {
  if (esHoliday) return POINTS_CONFIG.DAY_MULT.HOLIDAY;
  const [y, mo, d] = dateStr.split('-').map(Number);
  const dayOfWeek = new Date(y, mo - 1, d).getDay();
  return POINTS_CONFIG.WEEKEND_DAYS.includes(dayOfWeek)
    ? POINTS_CONFIG.DAY_MULT.WEEKEND
    : POINTS_CONFIG.DAY_MULT.WEEKDAY;
};

// Divide un intervalo [startMin, endMin] en segmentos por franjas horarias.
const splitBySlots = (startMin, endMin) =>
  POINTS_CONFIG.SLOTS
    .filter(({ start, end }) => start < endMin && end > startMin)
    .map(({ start, end, mult }) => ({
      hours: (Math.min(end, endMin) - Math.max(start, startMin)) / 60,
      slotMult: mult,
    }));

const getSlotName = (slotMult) => {
  if (slotMult === 1.6) return 'Noche';
  if (slotMult === 1.0) return 'Mañana';
  if (slotMult === 1.3) return 'Tarde';
  return 'Franja';
};

const calcSegmentPoints = ({ hours, slotMult }, dayMult) =>
  hours * POINTS_CONFIG.BASE_PER_HOUR * slotMult * dayMult;

// Acumula los puntos de un array de segmentos aplicando el multiplicador de día.
const calcSegmentsPoints = (segments, dayMult) =>
  segments.reduce((acc, segment) => acc + calcSegmentPoints(segment, dayMult), 0);

const toSlotDetail = (segment, dayMult) => ({
  franja: getSlotName(segment.slotMult),
  horas: segment.hours,
  multiplicador_franja: segment.slotMult,
  multiplicador_dia: dayMult,
  puntos: calcSegmentPoints(segment, dayMult),
});

const toBlockDetail = (dateStr, esHoliday, startMin, endMin) => {
  const dayMult = getDayMult(dateStr, esHoliday);
  const segments = splitBySlots(startMin, endMin);
  return {
    fecha: dateStr,
    es_festivo: Boolean(esHoliday),
    multiplicador_dia: dayMult,
    franjas: segments.map((segment) => toSlotDetail(segment, dayMult)),
    puntos: calcSegmentsPoints(segments, dayMult),
  };
};

const toShiftDetail = (shift) => {
  const startMin = toMinutes(shift.hora_inicio);
  const endMin = toMinutes(shift.hora_fin);
  if (endMin > startMin) {
    return {
      fecha: shift.fecha,
      hora_inicio: shift.hora_inicio,
      hora_fin: shift.hora_fin,
      bloques: [toBlockDetail(shift.fecha, shift.es_festivo, startMin, endMin)],
    };
  }

  return {
    fecha: shift.fecha,
    hora_inicio: shift.hora_inicio,
    hora_fin: shift.hora_fin,
    bloques: [
      toBlockDetail(shift.fecha, shift.es_festivo, startMin, 1440),
      toBlockDetail(getNextDate(shift.fecha), false, 0, endMin),
    ],
  };
};

// Calcula los puntos de un bloque horario dentro de un único día de calendario.
const calcBlockPoints = (startMin, endMin, dateStr, esHoliday) =>
  calcSegmentsPoints(splitBySlots(startMin, endMin), getDayMult(dateStr, esHoliday));

// Calcula los puntos de un turno. Divide en dos bloques si cruza la medianoche.
const calcShiftPoints = (shift) => {
  const startMin = toMinutes(shift.hora_inicio);
  const endMin   = toMinutes(shift.hora_fin);

  if (endMin > startMin) {
    return calcBlockPoints(startMin, endMin, shift.fecha, shift.es_festivo);
  }

  // Cruce de medianoche: bloque pre-medianoche en fecha original, post en día siguiente.
  return calcBlockPoints(startMin, 1440, shift.fecha, shift.es_festivo)
       + calcBlockPoints(0, endMin, getNextDate(shift.fecha), false);
};

const calcShiftDetails = (shift) => {
  const details = toShiftDetail(shift);
  return {
    ...details,
    puntos: Math.round(details.bloques.reduce((acc, block) => acc + block.puntos, 0)),
  };
};

// Devuelve el bonus de turno partido (+20) si algún par consecutivo tiene hueco > 2h.
// Se aplica como máximo una vez al día.
const calcSplitShiftBonus = (sortedShifts) => {
  if (sortedShifts.length < 2) return 0;
  const hasBonus = sortedShifts.slice(0, -1).some((shift, i) => {
    const gapMin = toMinutes(sortedShifts[i + 1].hora_inicio) - toMinutes(shift.hora_fin);
    return gapMin > POINTS_CONFIG.SPLIT_SHIFT_GAP_HOURS * 60;
  });
  return hasBonus ? POINTS_CONFIG.BONUS_SPLIT_SHIFT : 0;
};

// Punto de entrada principal: orquesta el cálculo completo de una jornada.
// Recibe un array de turnos del mismo usuario y fecha. Devuelve el total redondeado.
const calcDailyPoints = (shifts) => {
  const sorted   = [...shifts].sort((a, b) => toMinutes(a.hora_inicio) - toMinutes(b.hora_inicio));
  const rawPoints = sorted.reduce((acc, shift) => acc + calcShiftPoints(shift), 0);
  return Math.round(rawPoints + calcSplitShiftBonus(sorted));
};

const calcDailyPointsDetail = (shifts) => {
  const sorted = [...shifts].sort((a, b) => toMinutes(a.hora_inicio) - toMinutes(b.hora_inicio));
  const turnos = sorted.map(calcShiftDetails);
  const puntos = turnos.reduce((acc, turno) => acc + turno.puntos, 0);
  const bonus_turno_partido = calcSplitShiftBonus(sorted);
  return {
    puntos_totales: Math.round(puntos + bonus_turno_partido),
    bonus_turno_partido,
    turnos,
  };
};

module.exports = {
  calcDailyPoints,
  calcDailyPointsDetail,
  calcShiftPoints,
  calcShiftDetails,
  calcSplitShiftBonus,
  getDayMult,
  splitBySlots,
  toMinutes,
  getNextDate,
};
