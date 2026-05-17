// Mocks centralizados para PostgreSQL.
// Evita conexiones reales a la BD durante testing.

const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

const mockPool = {
  connect: jest.fn().mockResolvedValue(mockClient),
  query: jest.fn(),
};

// Resetea todos los mocks después de cada test
const resetMocks = () => {
  mockClient.query.mockClear();
  mockClient.release.mockClear();
  mockPool.connect.mockClear();
  mockPool.query.mockClear();
};

// Configura una transacción exitosa (BEGIN → INSERT → UPDATE → COMMIT)
const setupSuccessfulTransaction = () => {
  mockClient.query
    .mockResolvedValueOnce({}) // BEGIN
    .mockResolvedValueOnce({}) // INSERT historial
    .mockResolvedValueOnce({}) // UPDATE saldo
    .mockResolvedValueOnce({}); // COMMIT
};

// Configura una transacción fallida en BEGIN (dispara ROLLBACK)
const setupFailedTransaction = () => {
  mockClient.query.mockRejectedValueOnce(new Error('Transaction failed: BEGIN error'));
};

module.exports = {
  mockPool,
  mockClient,
  resetMocks,
  setupSuccessfulTransaction,
  setupFailedTransaction,
};
