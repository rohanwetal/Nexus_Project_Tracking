// models/Project.js
const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type:     String,
    required: [true, 'Project name is required'],
    trim:     true,
  },
  lead: {
    type:     String,
    required: [true, 'Project lead is required'],
    trim:     true,
  },
  priority: {
    type:    String,
    enum:    ['High', 'Medium', 'Low'],
    default: 'Medium',
  },
  pmo: {
    type:    String,
    enum:    ['Yes', 'No'],
    default: 'No',
  },
  start: {
    type:     String,
    required: [true, 'Start date is required'],
  },
  end: {
    type:     String,
    required: [true, 'End date is required'],
  },
  departments: {
    type:     [String],
    validate: {
      validator: val => val && val.length > 0,
      message:   'At least one department is required',
    },
  },
  coe: {
    type: String,  // auto-joined from departments
  },
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);