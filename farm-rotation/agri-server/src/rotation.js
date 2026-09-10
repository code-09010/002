/**
 * 茬口轮作核心逻辑：
 *  - 重茬预警（同作物连作 / 同科迎茬）
 *  - 下茬作物推荐（避开近两茬同科，豆科养地优先）
 *  - 按作物生育期估算收获时间，推算下茬可播日期
 */

const MS_DAY = 24 * 3600 * 1000;

function toDate(dateStr) {
  return new Date(dateStr + 'T00:00:00');
}

function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addMonths(date, months) {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

function cropsByName(db) {
  const map = {};
  for (const c of db.prepare('SELECT * FROM crops').all()) map[c.name] = c;
  return map;
}

/** 估算某茬的收获日期 = 播种日期 + 生育期 */
function estimateHarvestDate(record, cropMap) {
  const crop = cropMap[record.crop_name];
  const duration = crop ? crop.duration_months : 5;
  return addMonths(toDate(record.sow_date), duration);
}

/** 从 fromDate 起，该作物最近的一个适宜播种日期（每月按 5 日计） */
function nextSowDate(crop, fromDate) {
  const months = crop.sow_months.split(',').map(Number).sort((a, b) => a - b);
  for (let y = fromDate.getFullYear(); y <= fromDate.getFullYear() + 2; y++) {
    for (const m of months) {
      const d = new Date(y, m - 1, 5);
      if (d >= fromDate) return d;
    }
  }
  return null;
}

/**
 * 为地块推荐下茬作物。
 * 规则：
 *  1. 不与上茬同作物；不与近两茬同科（硬排除，防重茬）；
 *  2. 豆科接非豆科 +3 分（固氮养地）；豆茬后接禾本科 +2 分；
 *  3. 该地块近年未种过的科 +1 分；
 *  4. 排序先看可播季度（近季优先，不让地块闲置），同季度内按农艺得分。
 */
function recommendForField(db, fieldId, count = 3) {
  const records = db.prepare(
    'SELECT * FROM crop_records WHERE field_id = ? ORDER BY sow_date DESC, id DESC LIMIT 3'
  ).all(fieldId);
  const cropMap = cropsByName(db);
  const last = records[0] || null;
  const recentFamilies = [...new Set(records.slice(0, 2).map(r => r.family).filter(Boolean))];

  // 下茬可播的最早时间：上茬预计收获 + 15 天整地；已过则从今天起算
  let earliest = new Date();
  if (last) {
    const ready = new Date(estimateHarvestDate(last, cropMap).getTime() + 15 * MS_DAY);
    if (ready > earliest) earliest = ready;
  }

  const scored = [];
  for (const crop of Object.values(cropMap)) {
    if (last && crop.name === last.crop_name) continue;
    if (recentFamilies.includes(crop.family)) continue;

    let score = 1;
    const reasons = [];
    if (last) reasons.push(`上茬为${last.family}${last.crop_name}`);
    if (crop.family === '豆科' && (!last || last.family !== '豆科')) {
      score += 3;
      reasons.push('豆科固氮养地');
    }
    if (last && last.family === '豆科' && crop.family === '禾本科') {
      score += 2;
      reasons.push('豆茬肥力足，适宜禾本科');
    }
    if (!records.some(r => r.family === crop.family)) {
      score += 1;
      reasons.push('本块地近年未种过该科作物');
    }

    const sowDate = nextSowDate(crop, earliest);
    if (!sowDate) continue;
    // 同季同分时按地块分散作物，避免全场都推同一种（分散种植风险）
    const nameHash = [...crop.name].reduce((s, ch) => s + ch.charCodeAt(0), 0);
    scored.push({
      crop: crop.name,
      family: crop.family,
      sow_date: fmt(sowDate),
      sow_window: `${sowDate.getFullYear()}年${sowDate.getMonth() + 1}月`,
      score,
      tie: (Number(fieldId) * 31 + nameHash) % 7,
      reason: reasons.length ? reasons.join('；') : '避开重茬，正常轮作',
    });
  }

  // 近季优先：先按可播日期所在季度，再按农艺得分，最后按具体日期
  const quarterOf = s => {
    const d = toDate(s);
    return d.getFullYear() * 10 + Math.floor(d.getMonth() / 3) + 1;
  };
  scored.sort((a, b) =>
    quarterOf(a.sow_date) - quarterOf(b.sow_date) ||
    b.score - a.score ||
    a.sow_date.localeCompare(b.sow_date) ||
    a.tie - b.tie
  );
  return {
    recommendations: scored.slice(0, count).map(({ tie, ...rest }) => rest),
    earliest_date: fmt(earliest),
    last_record: last,
  };
}

/**
 * 录入新记录前的重茬/时间冲突预警。
 */
function rotationWarnings(db, fieldId, cropName, sowDate) {
  const warnings = [];
  const cropMap = cropsByName(db);
  const crop = cropMap[cropName];
  const last = db.prepare(
    'SELECT * FROM crop_records WHERE field_id = ? ORDER BY sow_date DESC, id DESC LIMIT 1'
  ).get(fieldId);

  if (!last) return warnings;

  if (last.crop_name === cropName) {
    warnings.push(`与上茬同为${cropName}，属于重茬连作，易导致病虫害加重、减产，建议换茬`);
  } else if (crop && crop.family === last.family) {
    warnings.push(`与上茬${last.crop_name}同为${crop.family}，养分需求相近，建议增施有机肥或换茬`);
  }

  if (last.harvest_yield == null) {
    const harvest = estimateHarvestDate(last, cropMap);
    if (toDate(sowDate) < harvest) {
      warnings.push(`上茬${last.crop_name}预计 ${fmt(harvest)} 前后才收获，播种时间可能冲突`);
    }
  }

  return warnings;
}

module.exports = { recommendForField, rotationWarnings, estimateHarvestDate, fmt };
