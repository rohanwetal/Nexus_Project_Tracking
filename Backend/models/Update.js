// models/Update.js
const mongoose = require('mongoose');

const updateSchema = new mongoose.Schema({
  projectId: {
    type:     String,
    required: true,
    unique:   true,   // one update doc per project
  },
  coe: {
    type:    Object,  // { mechanical: 70, electrical: 50, ... }
    default: {},
  },
  coeNotes: {
    type:    Object,  // { mechanical: "Delay on assembly", ... }
    default: {},
  },
}, { timestamps: true });

module.exports = mongoose.model('Update', updateSchema);