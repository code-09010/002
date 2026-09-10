const express = require('express');
const { recommendForField } = require('../rotation');

const router = express.Router();

// 地块网格：每块地附带最新一茬、状态和下茬首推
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const fields = db.prepare('SELECT * FROM fields ORDER BY code').all();
  const recentStmt = db.prepare(
    'SELECT * FROM crop_records WHERE field_id = ? ORDER BY sow_date DESC, id DESC LIMIT 2'
  );

  const result = fields.map(f => {
    const recent = recentStmt.all(f.id);
    const last = recent[0] || null;
    const rec = recommendForField(db, f.id, 1);
    return {
      ...f,
      status: !last ? '空闲' : (last.harvest_yield == null ? '在田' : '待播'),
      current: last && {
        crop_name: last.crop_name,
        variety: last.variety,
        family: last.family,
        sow_date: last.sow_date,
      },
      // 重茬：最近两茬为同一作物
      continuous_crop: recent.length >= 2 && recent[0].crop_name === recent[1].crop_name,
      next_recommendation: rec.recommendations[0] || null,
    };
  });
  res.json(result);
});

// 单个地块：基本信息 + 全部历史记录 + 下茬推荐
router.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  const field = db.prepare('SELECT * FROM fields WHERE id = ?').get(req.params.id);
  if (!field) return res.status(404).json({ error: '地块不存在' });

  const records = db.prepare(
    'SELECT * FROM crop_records WHERE field_id = ? ORDER BY sow_date DESC, id DESC'
  ).all(field.id);
  const rec = recommendForField(db, field.id, 3);

  res.json({ field, records, recommendations: rec.recommendations, earliest_date: rec.earliest_date });
});

module.exports = router;
