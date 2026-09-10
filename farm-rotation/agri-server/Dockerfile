FROM node:22-bookworm-slim

WORKDIR /app

# 先装依赖，利用镜像层缓存
COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/farm.db

EXPOSE 3000
VOLUME ["/data"]

CMD ["node", "src/index.js"]
