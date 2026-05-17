// Logger estructurado minimalista. Sin dependencias externas.
// Responsabilidad: Formatear y despachar logs a stdout.

const LOG_LEVELS = Object.freeze({
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
});

const getLevel = () => process.env.LOG_LEVEL || 'INFO';

const shouldLog = (level) => {
  const levels = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
  const current = levels.indexOf(getLevel());
  return levels.indexOf(level) <= current;
};

const format = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] ${level}: ${message}${metaStr}`;
};

const log = (level, message, meta) => {
  if (!shouldLog(level)) return;
  const output = format(level, message, meta);
  level === 'ERROR' ? console.error(output) : console.log(output);
};

module.exports = {
  error: (msg, meta) => log(LOG_LEVELS.ERROR, msg, meta),
  warn: (msg, meta) => log(LOG_LEVELS.WARN, msg, meta),
  info: (msg, meta) => log(LOG_LEVELS.INFO, msg, meta),
  debug: (msg, meta) => log(LOG_LEVELS.DEBUG, msg, meta),
};
