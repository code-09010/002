const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');
const { seedIfEmpty } = require('./seed');
const fieldsRouter = require('./routes/fields');
const recordsRouter = require('./routes/records');
const rotationRouter = require('./routes/rotation');

const app = express();
app.use(cors());
app.use(express.json());

const db = initDb();
seedIfEmpty(db);
app.locals.db = db;

app.get('/api/health', (req, res) => res.json({ ok: true }));

// 作物知识库（录入表单的下拉选项）
app.get('/api/crops', (req, res) => {
  res.json(req.app.locals.db.prepare('SELECT * FROM crops ORDER BY family, name').all());
});

app.use('/api/fields', fieldsRouter);
app.use('/api/records', recordsRouter);
app.use('/api/rotation', rotationRouter);

// 统一错误处理
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '服务器内部错误' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`agri-server 已启动: http://localhost:${PORT}`));
