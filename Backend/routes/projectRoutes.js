// routes/projectRoutes.js
const express  = require('express');
const router   = express.Router();
const Project  = require('../models/Project');
const Update   = require('../models/Update');

// ── Validation helper ─────────────────────────────────────────────────
const validateProject = (data) => {
  if (!data.name  || !data.name.trim())  return 'Project name is required';
  if (!data.lead  || !data.lead.trim())  return 'Project lead is required';
  if (!data.start || !data.end)          return 'Start and End dates are required';
  if (!Array.isArray(data.departments) || data.departments.length === 0)
    return 'At least one department must be selected';
  return null;
};

// ── POST /api/projects ── Create ──────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const error = validateProject(req.body);
    if (error) return res.status(400).json({ error });

    const projectData = {
      ...req.body,
      coe: req.body.departments.join(', '),
    };

    const project = await Project.create(projectData);
    return res.status(201).json(project);
  } catch (err) {
    console.error('CREATE ERROR:', err.message);
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ error: msg });
    }
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/projects ── Get all ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    return res.json(projects);
  } catch (err) {
    console.error('FETCH ERROR:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/projects/:id ── Get one ─────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    return res.json(project);
  } catch (err) {
    console.error('GET ONE ERROR:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/projects/:id ── Update ─────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { ...req.body, coe: req.body.departments?.join(', ') },
      { new: true, runValidators: true }
    );
    if (!project) return res.status(404).json({ error: 'Project not found' });
    return res.json(project);
  } catch (err) {
    console.error('UPDATE ERROR:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/projects/:id ── Delete ──────────────────────────────
// Also deletes associated update doc so no orphaned data remains
router.delete('/:id', async (req, res) => {
  try {
    const result = await Project.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Project not found' });

    // Clean up orphaned update doc
    await Update.deleteOne({ projectId: req.params.id });

    return res.json({ success: true, message: 'Project and its updates deleted' });
  } catch (err) {
    console.error('DELETE ERROR:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;