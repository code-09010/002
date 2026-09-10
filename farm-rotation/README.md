# 农田茬口轮作管理系统

面向承包数十亩地的种植户，解决**茬口记录混乱导致重茬减产**的问题：

- **地块管理**：网格展示所有田块，点击某格查看该地块历史种植记录与下茬推荐
- **农事录入**：按地块编号登记播种日期、品种、施肥种类用量、灌溉时间、收获产量，提交后自动推算下茬推荐作物，并对重茬连作/同科迎茬/时间冲突给出预警
- **茬口安排**：按季度生成轮作计划；支持按品种名称查找种植地块、按播种日期排序查看

## 目录结构

```
farm-rotation/
├── docker-compose.yml      # 一键启动
├── agri-server/            # 后端：Node.js + Express + SQLite
│   └── src/
│       ├── index.js        # 入口
│       ├── db.js           # 建库建表
│       ├── seed.js         # 作物知识库 + 示例地块/茬口数据
│       ├── rotation.js     # 轮作推荐与重茬预警核心逻辑
│       └── routes/         # fields / records / rotation 路由
└── field-ui/               # 前端：Vue3 + Vite
    └── src/views/          # 地块管理 / 农事录入 / 茬口安排 三个页面
```

## 快速开始

### Docker 一键启动（推荐）

```bash
cd farm-rotation
docker compose up --build
```

- 前端：http://localhost:8080
- 后端 API：http://localhost:3000/api/health

SQLite 数据文件保存在 `farm-data` 数据卷中，删除容器不丢数据。

### 本地开发

```bash
# 后端（端口 3000）
cd farm-rotation/agri-server
npm install
npm run dev

# 前端（端口 5173，已配置 /api 代理到 3000）
cd farm-rotation/field-ui
npm install
npm run dev
```

首次启动自动建表并写入示例数据（12 块地、19 种作物、41 条历史茬口记录，其中 B-03 为玉米连作，用于演示重茬预警）。删除 `agri-server/data/` 即可重置。

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/fields` | 地块网格：状态、当前茬、重茬标记、下茬首推 |
| GET | `/api/fields/:id` | 单块地详情 + 全部历史记录 + 下茬推荐 |
| GET | `/api/records` | 农事记录查询，参数：`variety`/`crop`/`field_code`/`sort`/`order` |
| POST | `/api/records` | 农事录入，返回重茬预警与下茬推荐 |
| GET | `/api/rotation/plan` | 按季度生成轮作计划，参数：`year`（可选） |
| GET | `/api/crops` | 作物知识库 |

## 轮作推荐规则

1. 不与上茬同作物、不与近两茬同科（硬排除，防重茬）；
2. 豆科接非豆科加分（固氮养地），豆茬后接禾本科加分；
3. 该地块近年未种过的科加分；
4. 排序近季优先（按上茬生育期估算收获期 + 15 天整地，不让地块闲置），同季度内按农艺得分，同分按地块分散作物以控制单一作物风险。

录入时的预警：同作物连作（重茬）、同科迎茬、上茬预计未收获的时间冲突。
