// ═══════════════════════════════════════════════════════════════════
//  NEXUS — Backend Entry Point
//  Run: node index.js  OR  npm run dev
// ═══════════════════════════════════════════════════════════════════

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
require('dotenv').config();

const app = express();

// ── Middleware ───────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());

// ── MongoDB Connection ───────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gainwell_portal';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅  MongoDB connected:', MONGO_URI))
  .catch(err => {
    console.error('❌  MongoDB connection failed:', err.message);
    process.exit(1);
  });

// ── Routes ───────────────────────────────────────────────────────────
const authRoutes    = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const updateRoutes  = require('./routes/updateRoutes');
const kpiRoutes     = require('./routes/kpiRoutes');       // ← NEW: KPI analytics

app.use('/api/auth',     authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/updates',  updateRoutes);
app.use('/api/kpi',      kpiRoutes);                       // ← NEW

// ── Health check ─────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date() }));

// ── Global error handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀  Nexus server running at http://localhost:${PORT}`);
  console.log(`    Auth:     /api/auth`);
  console.log(`    Projects: /api/projects`);
  console.log(`    Updates:  /api/updates`);
  console.log(`    KPI:      /api/kpi`);
});