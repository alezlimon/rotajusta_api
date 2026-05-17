// Punto de entrada del servidor Express.
// Responsabilidad: configurar middlewares, montar rutas, iniciar servidor y orquestar graceful shutdown.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./config/db');
const turnsRoutes = require('./routes/turnsRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares ---

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// --- Rutas ---

app.use('/api/turnos', turnsRoutes);

// --- Health check ---

app.get('/health', (_, res) => res.status(200).json({ status: 'ok' }));

// --- 404 ---

app.use((_, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// --- Error handler (debe ser el último middleware) ---

app.use((err, _, res, __) => {
  const status = err.status || 500;
  const message = err.message || 'Error interno del servidor';
  res.status(status).json({ error: message });
});

// --- Graceful shutdown ---

const signals = ['SIGTERM', 'SIGINT'];
const closeConnections = async () => {
  console.log('\n📍 Cerrando conexiones...');
  try {
    await pool.end();
    console.log('✅ Pool de PostgreSQL cerrado correctamente');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error al cerrar el pool:', err);
    process.exit(1);
  }
};

signals.forEach((sig) => process.on(sig, closeConnections));

// --- Start server ---

const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

module.exports = { app, server };
