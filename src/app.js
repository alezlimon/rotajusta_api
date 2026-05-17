// Configuración de la aplicación Express (sin iniciar el servidor).
// Importado por: index.js (para iniciar servidor) y tests (para testing).

const express = require('express');
const cors = require('cors');
const turnsRoutes = require('./routes/turnsRoutes');

const app = express();

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

module.exports = { app };
