const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

/**
 * 初始化 SQLite 数据库并建表。
 * 数据文件路径用 DB_PATH 环境变量覆盖（Docker 中挂到 /data），
 * 本地默认放在 agri-server/data/farm.db。
 */
function initDb() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'farm.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    -- 地块表
    CREATE TABLE IF NOT EXISTS fields (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      code       TEXT NOT NULL UNIQUE,        -- 地块编号，如 A-01
      name       TEXT NOT NULL,               -- 地块名称，如 东洼一号
      area_mu    REAL NOT NULL,               -- 面积（亩）
      soil_type  TEXT NOT NULL DEFAULT '',    -- 土壤类型
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 作物知识表：轮作推荐的依据
    CREATE TABLE IF NOT EXISTS crops (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL UNIQUE,   -- 作物名称
      family          TEXT NOT NULL,          -- 科属（重茬判断依据）
      sow_months      TEXT NOT NULL,          -- 适宜播种月份，逗号分隔，如 "9,10"
      duration_months INTEGER NOT NULL,       -- 生育期（月），用于估算收获时间
      note            TEXT NOT NULL DEFAULT ''
    );

    -- 农事记录表：一行就是一茬
    CREATE TABLE IF NOT EXISTS crop_records (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      field_id          INTEGER NOT NULL REFERENCES fields(id),
      crop_name         TEXT NOT NULL,        -- 作物名称
      variety           TEXT NOT NULL DEFAULT '', -- 品种
      family            TEXT NOT NULL DEFAULT '', -- 科属（录入时按作物知识表冗余）
      sow_date          TEXT NOT NULL,        -- 播种日期 YYYY-MM-DD
      fertilizer_type   TEXT NOT NULL DEFAULT '', -- 施肥种类
      fertilizer_amount REAL,                 -- 施肥用量（公斤/亩）
      irrigate_date     TEXT NOT NULL DEFAULT '', -- 灌溉时间
      harvest_yield     REAL,                 -- 收获产量（公斤/亩），NULL 表示在田未收
      created_at        TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_records_field   ON crop_records(field_id, sow_date);
    CREATE INDEX IF NOT EXISTS idx_records_variety ON crop_records(variety);
    CREATE INDEX IF NOT EXISTS idx_records_sow     ON crop_records(sow_date);
  `);

  return db;
}

module.exports = { initDb };
