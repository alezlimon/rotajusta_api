// Tests para logger.

const logger = require('./logger');

describe('logger', () => {
  const originalLog = console.log;
  const originalError = console.error;
  let logOutput = [];
  let errorOutput = [];

  beforeEach(() => {
    logOutput = [];
    errorOutput = [];
    console.log = jest.fn((...args) => logOutput.push(args.join(' ')));
    console.error = jest.fn((...args) => errorOutput.push(args.join(' ')));
    process.env.LOG_LEVEL = 'DEBUG'; // Mostrar todos los logs en tests
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
  });

  test('info() registra un mensaje', () => {
    logger.info('Test message');
    expect(logOutput.length).toBeGreaterThan(0);
    expect(logOutput[0]).toContain('INFO: Test message');
  });

  test('error() usa console.error', () => {
    logger.error('Error message');
    expect(errorOutput.length).toBeGreaterThan(0);
    expect(errorOutput[0]).toContain('ERROR: Error message');
  });

  test('debug() se puede filtrar con LOG_LEVEL', () => {
    process.env.LOG_LEVEL = 'INFO'; // Solo INFO y superiores
    logOutput = [];
    logger.debug('Debug message');
    expect(logOutput.length).toBe(0); // No debe loguear
  });

  test('warn() registra advertencias', () => {
    logger.warn('Warning message', { code: 'WARN_001' });
    expect(logOutput.length).toBeGreaterThan(0);
    expect(logOutput[0]).toContain('WARN: Warning message');
    expect(logOutput[0]).toContain('WARN_001');
  });
});
