const express  = require('express');
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const cors     = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nexus_portal';
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅  MongoDB connected:', MONGO_URI))
  .catch(err => { console.error('❌  MongoDB error:', err); process.exit(1); });

// ── Valid CoE roles ──────────────────────────────────────────────────
const VALID_ROLES = [
  'Mechanical', 'Electrical', 'Hydraulics',
  'Virtual Manufacturing Engineering',
  'Lean Manufacturing & Tool Design',
  'Digital Tech. & Program Management',
  'Admin',
];

// ── User Schema ──────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  email:      { type: String, required: true, trim: true, lowercase: true },
  employeeId: { type: String, required: true, unique: true, trim: true },
  password:   { type: String, required: true },
  coeRole:    { type: String, default: '' },
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

// ── Seed admin on first run ──────────────────────────────────────────
mongoose.connection.once('open', async () => {
  const exists = await User.findOne({ employeeId: 'admin' });
  if (!exists) {
    const hash = await bcrypt.hash('admin123', 10);
    await User.create({ name:'Admin User', email:'admin@gainwell.com', employeeId:'admin', password:hash, coeRole:'Admin' });
    console.log('✅  Admin seeded  (ID: admin / PW: admin123)');
  }
});

// ── POST /api/auth/signup ─────────────────────────────────────────────
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, employeeId, password, coeRole } = req.body;
    if (!name||!email||!employeeId||!password||!coeRole)
      return res.status(400).json({ error: 'All fields are required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (!VALID_ROLES.includes(coeRole))
      return res.status(400).json({ error: 'Invalid CoE role selected' });
    const existing = await User.findOne({ employeeId });
    if (existing) return res.status(409).json({ error: 'Employee ID already registered' });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, employeeId, password: hash, coeRole });
    res.status(201).json({ success: true, user: { name: user.name, email: user.email, employeeId: user.employeeId, coeRole: user.coeRole } });
  } catch (err) { console.error('Signup error:', err); res.status(500).json({ error: 'Server error during signup' }); }
});

// ── POST /api/auth/login ─────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { employeeId, password } = req.body;
    if (!employeeId||!password) return res.status(400).json({ error: 'Employee ID and password are required' });
    const user = await User.findOne({ employeeId });
    if (!user) return res.status(401).json({ error: 'Invalid Employee ID or password' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid Employee ID or password' });
    res.json({ success: true, user: { name: user.name, email: user.email, employeeId: user.employeeId, coeRole: user.coeRole } });
  } catch (err) { console.error('Login error:', err); res.status(500).json({ error: 'Server error during login' }); }
});

// ── GET /api/auth/check/:employeeId ─────────────────────────────────
app.get('/api/auth/check/:employeeId', async (req, res) => {
  try {
    const user = await User.findOne({ employeeId: req.params.employeeId });
    res.json({ exists: !!user });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ── Health check ─────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀  Nexus server running at http://localhost:${PORT}`));