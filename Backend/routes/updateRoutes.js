// routes/updateRoutes.js
const express = require('express');
const router  = express.Router();
const Update  = require('../models/Update');
const Project = require('../models/Project');

// ── POST /api/updates/:projectId ── Save or update progress ──────────
// Body: { coe: { mechanical: 70, electrical: 50, ... }, coeNotes: { mechanical: "note..." } }
router.post('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { coe, coeNotes } = req.body;

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Upsert: update if exists, create if not
    const update = await Update.findOneAndUpdate(
      { projectId },
      { $set: { coe: coe || {}, coeNotes: coeNotes || {} } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.json(update);
  } catch (err) {
    console.error('UPDATE SAVE ERROR:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/updates/:projectId ── Get update for one project ────────
router.get('/:projectId', async (req, res) => {
  try {
    const update = await Update.findOne({ projectId: req.params.projectId });
    return res.json(update || { coe: {}, coeNotes: {} });
  } catch (err) {
    console.error('UPDATE FETCH ERROR:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/updates ── Get all updates (for dashboard/analytics) ────
router.get('/', async (req, res) => {
  try {
    const updates = await Update.find();
    return res.json(updates);
  } catch (err) {
    console.error('UPDATE FETCH ALL ERROR:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/updates/:projectId ── Remove update for a project ────
router.delete('/:projectId', async (req, res) => {
  try {
    await Update.deleteOne({ projectId: req.params.projectId });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;