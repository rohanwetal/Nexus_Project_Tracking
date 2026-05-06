// routes/kpiRoutes.js
// ═══════════════════════════════════════════════════════════════════
//  NEW BACKEND ROUTE — was previously computed 100% in the browser.
//  Now the server does all the heavy lifting:
//    GET /api/kpi/summary     → totals (total, ongoing, delayed, etc.)
//    GET /api/kpi/details     → all projects enriched with status + pct
//    GET /api/kpi/delayed     → only delayed projects sorted by pct asc
//    GET /api/kpi/departments → per-department project counts
//    GET /api/kpi/watchlist   → projects that have critical watchlist notes
// ═══════════════════════════════════════════════════════════════════

const express = require('express');
const router  = express.Router();
const Project = require('../models/Project');
const Update  = require('../models/Update');

// ── COE key → label mapping (mirrors shared.js) ───────────────────────
const COE_LIST = [
  { key: 'mechanical', label: 'Mechanical',                        short: 'Mech' },
  { key: 'electrical', label: 'Electrical',                        short: 'Elec' },
  { key: 'hydraulics', label: 'Hydraulics',                        short: 'Hyd'  },
  { key: 'virtual',    label: 'Virtual Manufacturing Engineering',  short: 'VME'  },
  { key: 'lean',       label: 'Lean Manufacturing & Tool Design',   short: 'Lean' },
  { key: 'digital',    label: 'Digital Tech. & Program Management', short: 'DPM'  },
];

// ── Helpers ───────────────────────────────────────────────────────────

/** Parse "Jan'25" or "Jan '25" → Date pointing to end of that month */
function parseEndDate(str) {
  if (!str) return null;
  const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const match  = str.trim().match(/^([A-Za-z]{3})\s*'(\d{2})$/);
  if (!match) return null;
  const mIdx = MONTHS.indexOf(match[1].toLowerCase());
  if (mIdx === -1) return null;
  const year = 2000 + parseInt(match[2]);
  // Last moment of the end month
  return new Date(year, mIdx + 1, 0, 23, 59, 59);
}

/** Average of all non-zero CoE values */
function computeAvg(coeData) {
  if (!coeData) return 0;
  const vals = COE_LIST
    .map(c => parseInt(coeData[c.key]) || 0)
    .filter(v => v > 0);
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
}

/** true if today is past the project's end date AND pct < 100 */
function isDelayed(project, pct) {
  if (pct === 100) return false;
  const endDate = parseEndDate(project.end);
  if (!endDate) return false;
  return new Date() > endDate;
}

/** 'ongoing' | 'completed' | 'delayed' | 'noprog' */
function classify(project, pct) {
  if (pct === 100) return 'completed';
  if (pct === 0)   return 'noprog';
  if (isDelayed(project, pct)) return 'delayed';
  return 'ongoing';
}

/** true if any CoE has a non-empty watchlist note */
function hasWatchNotes(update) {
  if (!update || !update.coeNotes) return false;
  return COE_LIST.some(c => (update.coeNotes[c.key] || '').trim().length > 0);
}

/** Build the full enriched list used by multiple endpoints */
async function buildEnriched() {
  const [projects, updates] = await Promise.all([
    Project.find().sort({ createdAt: -1 }).lean(),
    Update.find().lean(),
  ]);

  // Index updates by projectId for O(1) lookup
  const updateMap = {};
  updates.forEach(u => { updateMap[u.projectId] = u; });

  return projects.map(p => {
    const id     = String(p._id);
    const upd    = updateMap[id] || { coe: {}, coeNotes: {} };
    const pct    = computeAvg(upd.coe);
    const status = classify(p, pct);
    const depts  = Array.isArray(p.departments) && p.departments.length
      ? p.departments
      : (p.coe ? p.coe.split(', ') : []);

    return {
      project:    p,
      update:     upd,
      pct,
      status,
      depts,
      hasWatch:   hasWatchNotes(upd),
      id,
    };
  });
}

// ── GET /api/kpi/summary ─────────────────────────────────────────────
// Returns: { total, ongoing, completed, delayed, noprog, watchlist }
router.get('/summary', async (req, res) => {
  try {
    const enriched = await buildEnriched();
    const summary = {
      total:     enriched.length,
      ongoing:   enriched.filter(e => e.status === 'ongoing').length,
      completed: enriched.filter(e => e.status === 'completed').length,
      delayed:   enriched.filter(e => e.status === 'delayed').length,
      noprog:    enriched.filter(e => e.status === 'noprog').length,
      watchlist: enriched.filter(e => e.hasWatch).length,
    };
    return res.json(summary);
  } catch (err) {
    console.error('KPI SUMMARY ERROR:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/kpi/details ─────────────────────────────────────────────
// Returns all projects enriched with status, pct, depts, watchNotes.
// Optional query: ?status=ongoing|delayed|completed|noprog
// Optional query: ?department=Mechanical   (filters by dept name)
router.get('/details', async (req, res) => {
  try {
    let enriched = await buildEnriched();

    // Filter by status
    if (req.query.status) {
      enriched = enriched.filter(e => e.status === req.query.status);
    }

    // Filter by department
    if (req.query.department) {
      const dept = req.query.department.toLowerCase();
      enriched = enriched.filter(e =>
        e.depts.some(d => d.toLowerCase().includes(dept))
      );
    }

    const result = enriched.map(e => ({
      id:         e.id,
      name:       e.project.name,
      lead:       e.project.lead,
      priority:   e.project.priority,
      pmo:        e.project.pmo,
      start:      e.project.start,
      end:        e.project.end,
      departments: e.depts,
      status:     e.status,
      pct:        e.pct,
      coe:        e.update.coe    || {},
      coeNotes:   e.update.coeNotes || {},
      hasWatch:   e.hasWatch,
    }));

    return res.json(result);
  } catch (err) {
    console.error('KPI DETAILS ERROR:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/kpi/delayed ─────────────────────────────────────────────
// Returns only delayed projects sorted by pct ascending (for chart)
// Optional query: ?limit=10
router.get('/delayed', async (req, res) => {
  try {
    const enriched = await buildEnriched();
    const limit    = parseInt(req.query.limit) || 10;

    const delayed = enriched
      .filter(e => e.status === 'delayed')
      .sort((a, b) => a.pct - b.pct)
      .slice(0, limit)
      .map(e => ({
        id:       e.id,
        name:     e.project.name,
        lead:     e.project.lead,
        start:    e.project.start,
        end:      e.project.end,
        pct:      e.pct,
        priority: e.project.priority,
        depts:    e.depts,
      }));

    return res.json(delayed);
  } catch (err) {
    console.error('KPI DELAYED ERROR:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/kpi/departments ─────────────────────────────────────────
// Returns per-department project counts (for bar chart)
// { department: "Mechanical", count: 5, avgPct: 62 }
router.get('/departments', async (req, res) => {
  try {
    const enriched = await buildEnriched();

    const deptStats = COE_LIST.map(c => {
      const matching = enriched.filter(e =>
        e.depts.some(d => d.toLowerCase() === c.label.toLowerCase())
      );
      const avgPct = matching.length
        ? Math.round(matching.reduce((sum, e) => sum + e.pct, 0) / matching.length)
        : 0;
      return {
        key:         c.key,
        label:       c.label,
        short:       c.short,
        count:       matching.length,
        avgPct,
        ongoing:     matching.filter(e => e.status === 'ongoing').length,
        completed:   matching.filter(e => e.status === 'completed').length,
        delayed:     matching.filter(e => e.status === 'delayed').length,
        noprog:      matching.filter(e => e.status === 'noprog').length,
      };
    });

    return res.json(deptStats);
  } catch (err) {
    console.error('KPI DEPT ERROR:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/kpi/watchlist ───────────────────────────────────────────
// Returns all projects that have at least one critical watchlist note
router.get('/watchlist', async (req, res) => {
  try {
    const enriched = await buildEnriched();

    const result = enriched
      .filter(e => e.hasWatch)
      .map(e => ({
        id:          e.id,
        name:        e.project.name,
        lead:        e.project.lead,
        priority:    e.project.priority,
        pmo:         e.project.pmo,
        start:       e.project.start,
        end:         e.project.end,
        departments: e.depts,
        status:      e.status,
        pct:         e.pct,
        coe:         e.update.coe      || {},
        coeNotes:    e.update.coeNotes || {},
      }));

    return res.json(result);
  } catch (err) {
    console.error('KPI WATCHLIST ERROR:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/kpi/health-table ────────────────────────────────────────
// Returns full project health table (all projects, sorted: delayed first)
// Used by the health table in Dashboard.html
router.get('/health-table', async (req, res) => {
  try {
    const enriched = await buildEnriched();

    const sortOrder = { delayed: 0, noprog: 1, ongoing: 2, completed: 3 };

    const sorted = [...enriched]
      .sort((a, b) =>
        sortOrder[a.status] !== sortOrder[b.status]
          ? sortOrder[a.status] - sortOrder[b.status]
          : a.pct - b.pct
      )
      .map(e => ({
        id:          e.id,
        name:        e.project.name,
        lead:        e.project.lead,
        priority:    e.project.priority,
        pmo:         e.project.pmo,
        start:       e.project.start,
        end:         e.project.end,
        departments: e.depts,
        status:      e.status,
        pct:         e.pct,
        coe:         e.update.coe      || {},
        coeNotes:    e.update.coeNotes || {},
        hasWatch:    e.hasWatch,
      }));

    return res.json(sorted);
  } catch (err) {
    console.error('KPI HEALTH TABLE ERROR:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;