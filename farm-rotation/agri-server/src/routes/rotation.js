const express = require('express');
const { recommendForField } = require('../rotation');

const router = express.Router();

// 按季度生成轮作计划：每块地取首推作物，按计划播种日期归入季度
router.get('/plan', (req, res) => {
  const db = req.app.locals.db;
  const year = req.query.year ? Number(req.query.year) : null;

  const fields = db.prepare('SELECT * FROM fields ORDER BY code').all();
  const items = [];

  for (const f of fields) {
    const rec = recommendForField(db, f.id, 1);
    const top = rec.recommendations[0];
    if (!top) continue;

    const d = new Date(top.sow_date + 'T00:00:00');
    const y = d.getFullYear();
    if (year && y !== year) continue;

    const q = Math.floor(d.getMonth() / 3) + 1;
    const last = rec.last_record;
    items.push({
      field_code: f.code,
      field_name: f.name,
      area_mu: f.area_mu,
      last_crop: last ? last.crop_name : null,
      last_variety: last ? last.variety : null,
      last_sow_date: last ? last.sow_date : null,
      planned_crop: top.crop,
      planned_family: top.family,
      planned_sow_date: top.sow_date,
      reason: top.reason,
      quarter: `${y}-Q${q}`,
      quarter_sort: y * 10 + q,
    });
  }

  items.sort((a, b) => a.quarter_sort - b.quarter_sort || a.field_code.localeCompare(b.field_code));

  const quarters = [];
  for (const item of items) {
    let g = quarters.find(x => x.quarter === item.quarter);
    if (!g) {
      g = { quarter: item.quarter, items: [] };
      quarters.push(g);
    }
    g.items.push(item);
  }

  res.json({ generated_at: new Date().toISOString().slice(0, 10), quarters });
});

module.exports = router;
