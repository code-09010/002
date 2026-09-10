const express = require('express');
const { recommendForField, rotationWarnings } = require('../rotation');

const router = express.Router();

// 允许排序的列（白名单，防注入）
const SORTABLE = new Set(['sow_date', 'harvest_yield', 'created_at']);

// 农事记录查询：按品种/作物/地块编号筛选，按播种日期等排序
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const { variety, crop, field_code, sort = 'sow_date', order = 'desc' } = req.query;

  const where = [];
  const params = {};
  if (variety) { where.push('r.variety LIKE @variety'); params.variety = `%${variety}%`; }
  if (crop) { where.push('r.crop_name LIKE @crop'); params.crop = `%${crop}%`; }
  if (field_code) { where.push('f.code = @field_code'); params.field_code = field_code; }

  const sortCol = SORTABLE.has(sort) ? sort : 'sow_date';
  const dir = order === 'asc' ? 'ASC' : 'DESC';

  const rows = db.prepare(`
    SELECT r.*, f.code AS field_code, f.name AS field_name
    FROM crop_records r
    JOIN fields f ON f.id = r.field_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY r.${sortCol} ${dir}, r.id DESC
  `).all(params);

  res.json(rows);
});

// 农事录入：登记一茬，返回重茬预警和下茬推荐
router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const {
    field_code, crop_name, variety = '', sow_date,
    fertilizer_type = '', fertilizer_amount = null,
    irrigate_date = '', harvest_yield = null,
  } = req.body || {};

  if (!field_code || !crop_name || !sow_date) {
    return res.status(400).json({ error: '地块编号、作物名称、播种日期为必填项' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sow_date)) {
    return res.status(400).json({ error: '播种日期格式应为 YYYY-MM-DD' });
  }

  const field = db.prepare('SELECT * FROM fields WHERE code = ?').get(field_code);
  if (!field) return res.status(404).json({ error: `地块 ${field_code} 不存在` });

  const crop = db.prepare('SELECT * FROM crops WHERE name = ?').get(crop_name);
  const family = crop ? crop.family : '其他';

  const warnings = rotationWarnings(db, field.id, crop_name, sow_date);

  const info = db.prepare(`
    INSERT INTO crop_records
      (field_id, crop_name, variety, family, sow_date, fertilizer_type, fertilizer_amount, irrigate_date, harvest_yield)
    VALUES
      (@field_id, @crop_name, @variety, @family, @sow_date, @fertilizer_type, @fertilizer_amount, @irrigate_date, @harvest_yield)
  `).run({
    field_id: field.id, crop_name, variety, family, sow_date,
    fertilizer_type, fertilizer_amount, irrigate_date, harvest_yield,
  });

  const record = db.prepare('SELECT * FROM crop_records WHERE id = ?').get(info.lastInsertRowid);
  const rec = recommendForField(db, field.id, 3);

  res.status(201).json({ record, warnings, recommendations: rec.recommendations });
});

module.exports = router;
