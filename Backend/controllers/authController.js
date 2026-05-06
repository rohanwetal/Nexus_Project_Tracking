// controllers/authController.js
const User    = require('../models/User');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const generateToken = (user) =>
  jwt.sign(
    { id: user._id, employeeId: user.employeeId },
    process.env.JWT_SECRET || 'secretkey',
    { expiresIn: '7d' }
  );

// ── POST /api/auth/signup ────────────────────────────────────────────
exports.signup = async (req, res) => {
  try {
    const { name, email, employeeId, password, coeRole } = req.body;

    if (!name || !email || !employeeId || !password || !coeRole)
      return res.status(400).json({ error: 'All fields are required' });

    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    // Check for duplicate email or employeeId
    const existing = await User.findOne({
      $or: [
        { email:      email.toLowerCase().trim() },
        { employeeId: employeeId.toUpperCase().trim() },
      ],
    });
    if (existing) {
      const field = existing.email === email.toLowerCase().trim()
        ? 'Email' : 'Employee ID';
      return res.status(409).json({ error: `${field} is already registered` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      employeeId,
      password: hashedPassword,
      coeRole,
    });

    const token = generateToken(user);

    return res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id:         user._id,
        name:       user.name,
        email:      user.email,
        employeeId: user.employeeId,
        coeRole:    user.coeRole,
      },
    });
  } catch (err) {
    console.error('SIGNUP ERROR:', err.message);
    // Handle Mongoose validation errors cleanly
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ error: msg });
    }
    return res.status(500).json({ error: 'Server error during signup' });
  }
};

// ── POST /api/auth/login ─────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { employeeId, password } = req.body;

    if (!employeeId || !password)
      return res.status(400).json({ error: 'Employee ID and password are required' });

    const user = await User.findOne({ employeeId: employeeId.toUpperCase().trim() });

    if (!user)
      return res.status(401).json({ error: 'Invalid Employee ID or password' });

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch)
      return res.status(401).json({ error: 'Invalid Employee ID or password' });

    const token = generateToken(user);

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id:         user._id,
        name:       user.name,
        email:      user.email,
        employeeId: user.employeeId,
        coeRole:    user.coeRole,
      },
    });
  } catch (err) {
    console.error('LOGIN ERROR:', err.message);
    return res.status(500).json({ error: 'Server error during login' });
  }
};

// ── GET /api/auth/me ─────────────────────────────────────────────────
// Returns the current user's profile (requires auth middleware)
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
};