// Punto de entrada del servidor Express.
// Responsabilidad: iniciar el servidor, configurar graceful shutdown y escuchar en el puerto.

require('dotenv').config();
const { app } = require('./app');
const { pool } = require('./config/db');

const PORT = process.env.PORT || 3000;

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
