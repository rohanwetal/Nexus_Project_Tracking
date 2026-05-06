// models/User.js
const mongoose = require('mongoose');

const VALID_COE_ROLES = [
  'Mechanical',
  'Electrical',
  'Hydraulics',
  'Virtual Manufacturing Engineering',
  'Lean Manufacturing & Tool Design',
  'Digital Tech. & Program Management',
  'Admin',
];

const userSchema = new mongoose.Schema({
  name: {
    type:     String,
    required: [true, 'Name is required'],
    trim:     true,
  },
  email: {
    type:      String,
    required:  [true, 'Email is required'],
    unique:    true,
    lowercase: true,
    trim:      true,
  },
  employeeId: {
    type:      String,
    required:  [true, 'Employee ID is required'],
    unique:    true,
    uppercase: true,
    trim:      true,
  },
  password: {
    type:      String,
    required:  [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
  },
  coeRole: {
    type:     String,
    required: [true, 'CoE role is required'],
    enum: {
      values:  VALID_COE_ROLES,
      message: 'Invalid CoE role: {VALUE}',
    },
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);