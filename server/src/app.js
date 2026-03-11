const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const businessRoutes = require('./routes/businessRoutes');
const healthRoutes = require('./routes/healthRoutes');

const app = express();

// ─── Seguridad básica ───────────────────────────────────────────────────────
// Usar helmet para headers HTTP seguros (sin helmet instalado, lo omitimos)
// app.use(helmet());

// ─── CORS ──────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

// ─── Body parsing ──────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Logging básico de requests ────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Rutas ──────────────────────────────────────────────────────────────────
app.use('/api/health', healthRoutes);
app.use('/api/business', businessRoutes);

// ─── 404 handler ───────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ─── Error global handler ───────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('❌ Error no controlado:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

module.exports = app;
