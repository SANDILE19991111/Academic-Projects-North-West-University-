// backend/server.js
// =============================================
// CLINICCARE — EXPRESS API SERVER
// CMPG 311 — Group 12
// =============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// ======= MIDDLEWARE =======
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  const time = new Date().toISOString();
  console.log(`[${time}] ${req.method} ${req.path}`);
  next();
});

// ======= ROUTES =======
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/patients',    require('./routes/patients'));
app.use('/api/appointments',require('./routes/appointments'));
app.use('/api/doctors',     require('./routes/doctors'));
app.use('/api/records',     require('./routes/records'));
app.use('/api/inventory',   require('./routes/inventory'));
app.use('/api/billing',     require('./routes/billing'));
app.use('/api/waitlist',    require('./routes/waitlist'));

// ======= HEALTH CHECK =======
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), version: '1.0.0' });
});

// ======= DB HEALTH =======
app.get('/api/health/db', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ db: 'connected' });
  } catch (err) {
    res.status(500).json({ db: 'error', message: err.message });
  }
});

// ======= 404 HANDLER =======
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
});

// ======= ERROR HANDLER =======
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// ======= START =======
app.listen(PORT, () => {
  console.log(`\n🏥 ClinicCare API running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
