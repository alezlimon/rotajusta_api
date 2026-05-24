// Objeto de configuración central e inmutable del Motor de Puntos.
// Regla: NUNCA usar números hardcodeados fuera de este archivo.

const POINTS_CONFIG = Object.freeze({
  BASE_PER_HOUR: 10,
  BONUS_SPLIT_SHIFT: 20,
  SPLIT_SHIFT_GAP_HOURS: 2,

  // Franjas horarias en minutos desde medianoche (0 = 00:00, 1440 = 24:00)
  SLOTS: Object.freeze([
    Object.freeze({ start: 0,    end: 480,  mult: 1.6 }), // Noche    00:00 - 08:00
    Object.freeze({ start: 480,  end: 960,  mult: 1.0 }), // Mañana   08:00 - 16:00
    Object.freeze({ start: 960,  end: 1440, mult: 1.3 }), // Tarde    16:00 - 00:00
  ]),

  DAY_MULT: Object.freeze({
    WEEKDAY: 1.0, // Lunes - Jueves
    WEEKEND: 1.5, // Viernes - Domingo
    HOLIDAY: 2.0, // Festivos (prioridad absoluta)
  }),

  // getDay() de JS: 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb
  WEEKEND_DAYS: Object.freeze([0, 5, 6]),
});

// Configuración de autenticación y roles
const AUTH_CONFIG = Object.freeze({
  BCRYPT_SALT_ROUNDS: 10,
  REQUIRED_ROLE_FOR_VALIDATION: 'MANAGER', // Solo managers pueden validar jornadas
});

const SCHEDULE_CONFIG = Object.freeze({
  DEFAULT_BLOCKS: Object.freeze([
    Object.freeze({ id: 'morning', name: 'Manana', start: '08:00', end: '16:00', color: 'bg-sky-400 text-slate-950' }),
    Object.freeze({ id: 'afternoon', name: 'Tarde', start: '16:00', end: '00:00', color: 'bg-amber-400 text-slate-950' }),
    Object.freeze({ id: 'night', name: 'Noche', start: '00:00', end: '08:00', color: 'bg-indigo-400 text-slate-950' }),
  ]),
  MIN_MONTH: 1,
  MAX_MONTH: 12,
  MIN_YEAR: 2024,
  MAX_YEAR: 2099,
});

module.exports = { POINTS_CONFIG, AUTH_CONFIG, SCHEDULE_CONFIG };
