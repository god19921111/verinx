# 公考星 · AI全真面试模拟工具 - 部署交付文档

> MVP v0.1.0 | 2026-07-27

---

## 目录

1. [部署架构概览](#1-部署架构概览)
2. [Docker Compose 完整部署配置](#2-docker-compose-完整部署配置)
3. [前后端环境变量模板](#3-前后端环境变量模板)
4. [PostgreSQL 数据库初始化SQL脚本](#4-postgresql-数据库初始化sql脚本)
5. [前端打包构建生产环境操作步骤](#5-前端打包构建生产环境操作步骤)
6. [完整部署流程（从零到上线）](#6-完整部署流程从零到上线)
7. [运维手册（启动/重启/日志/备份）](#7-运维手册启动重启日志备份)
8. [第三方AI服务接入说明](#8-第三方ai服务接入说明)
9. [常见问题排查](#9-常见问题排查)

---

## 1. 部署架构概览

```
                    ┌──────────────────────────────────────────┐
                    │              用户浏览器                    │
                    │         http://服务器IP:80                 │
                    └──────────────┬───────────────────────────┘
                                   │ HTTP
                    ┌──────────────▼───────────────────────────┐
                    │            Nginx (容器:80)                │
                    │  ┌─────────────────────────────────────┐  │
                    │  │  前端静态文件 /usr/share/nginx/html  │  │
                    │  │  API反向代理 → backend:8000/api/     │  │
                    │  │  上传文件   → /uploads/              │  │
                    │  └─────────────────────────────────────┘  │
                    └──────┬──────────────────┬─────────────────┘
                           │                  │
            ┌──────────────▼─────┐    ┌───────▼──────────────────┐
            │  FastAPI Backend   │    │    uploads (Volume)      │
            │  (容器:8000)       │    │  /app/uploads/audio/     │
            │  Python 3.11       │    │  /app/uploads/video/     │
            └──────┬──────┬──────┘    └──────────────────────────┘
                   │      │
        ┌──────────▼┐  ┌─▼───────────┐
        │ PostgreSQL │  │   Redis     │
        │ (容器:5432)│  │ (容器:6379) │
        │ pgdata     │  │  maxmemory  │
        └────────────┘  └─────────────┘
```

### 容器编排说明

| 容器 | 镜像 | 端口 | 作用 |
|------|------|------|------|
| gkx-nginx | nginx:alpine | 80 | 前端静态资源 + API反向代理 |
| gkx-backend | 自建 (Python 3.11) | 8000 | FastAPI 后端服务 |
| gkx-db | postgres:15-alpine | 5432 | PostgreSQL 数据库 |
| gkx-redis | redis:7-alpine | 6379 | Redis 缓存（验证码/会话） |

---

## 2. Docker Compose 完整部署配置

### 2.1 docker-compose.yml

配置文件位于项目根目录 `docker-compose.yml`，包含4个服务：

```yaml
version: "3.9"

services:
  db:
    image: postgres:15-alpine
    container_name: gkx-db
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
      POSTGRES_DB: ${DB_NAME:-gongkaoxing}
      TZ: Asia/Shanghai
    ports:
      - "${DB_PORT:-5432}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./backend/sql/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres}"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - gkx-net

  redis:
    image: redis:7-alpine
    container_name: gkx-redis
    restart: always
    ports:
      - "${REDIS_PORT:-6379}:6379"
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - gkx-net

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: gkx-backend
    restart: always
    ports:
      - "${BACKEND_PORT:-8000}:8000"
    env_file:
      - ./backend/.env.production
    environment:
      DATABASE_URL: postgresql://${DB_USER:-postgres}:${DB_PASSWORD:-postgres}@db:5432/${DB_NAME:-gongkaoxing}
      REDIS_URL: redis://redis:6379/0
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - uploads:/app/uploads
    networks:
      - gkx-net

  nginx:
    image: nginx:alpine
    container_name: gkx-nginx
    restart: always
    ports:
      - "${WEB_PORT:-80}:80"
    volumes:
      - ./frontend/dist:/usr/share/nginx/html:ro
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - uploads:/usr/share/nginx/uploads:ro
    depends_on:
      - backend
    networks:
      - gkx-net

volumes:
  pgdata:
  uploads:

networks:
  gkx-net:
    driver: bridge
```

### 2.2 后端 Dockerfile

文件位于 `backend/Dockerfile`：

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 2.3 Nginx 配置

文件位于 `nginx/nginx.conf`：

- 前端静态资源：`/` → `/usr/share/nginx/html`
- API 反向代理：`/api/` → `http://backend:8000/api/`
- 上传文件：`/uploads/` → `/usr/share/nginx/uploads/`
- SPA 路由回退：`try_files $uri $uri/ /index.html`
- Gzip 压缩 + 安全头 + 缓存策略

### 2.4 关键配置说明

| 配置项 | 说明 | 修改方式 |
|--------|------|----------|
| 数据库密码 | 默认 postgres，生产必须修改 | 创建根目录 `.env` 文件设置 `DB_PASSWORD` |
| Web端口 | 默认80 | `.env` 文件设置 `WEB_PORT` |
| 上传文件大小 | Nginx 限制60MB，后端音频10MB/视频50MB | 修改 nginx.conf `client_max_body_size` |
| Redis内存 | 限制256MB | 修改 docker-compose.yml `--maxmemory` |
| 后端日志级别 | DEBUG=False（生产） | 修改 `.env.production` 中 `DEBUG` |

---

## 3. 前后端环境变量模板

### 3.1 后端环境变量（backend/.env.production）

```bash
# ---------- 应用 ----------
APP_NAME=公考星·AI全真面试模拟
APP_VERSION=0.1.0
DEBUG=False

# ---------- 数据库 ----------
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gongkaoxing

# ---------- Redis ----------
REDIS_URL=redis://localhost:6379/0

# ---------- JWT认证 ----------
# 生产环境必须更换，生成命令：openssl rand -hex 32
JWT_SECRET_KEY=请替换为随机密钥
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=120

# ---------- 文件上传 ----------
UPLOAD_DIR=/app/uploads
AUDIO_MAX_SIZE_MB=10
VIDEO_MAX_SIZE_MB=50
FREE_USER_FILE_RETENTION_DAYS=7
PREMIUM_USER_FILE_RETENTION_DAYS=30

# ---------- 会员权限 ----------
FREE_DAILY_PRACTICE_LIMIT=5
FREE_FOLLOW_UP_LIMIT=1
PREMIUM_FOLLOW_UP_LIMIT=3
MAX_FOLLOW_UP_PER_SESSION=3

# ---------- 评分权重（和=1.0）----------
SCORE_WEIGHT_ANALYSIS=0.25
SCORE_WEIGHT_EXPRESSION=0.20
SCORE_WEIGHT_ADAPTABILITY=0.20
SCORE_WEIGHT_ORGANIZATION=0.20
SCORE_WEIGHT_APPEARANCE=0.15

# ---------- 第三方AI服务 ----------
TTS_API_KEY=
TTS_API_URL=
ASR_API_KEY=
ASR_API_URL=
LLM_API_KEY=
LLM_API_URL=
LLM_MODEL=

# ---------- 短信验证码 ----------
SMS_ENABLED=False
SMS_API_KEY=
SMS_API_URL=
```

### 3.2 前端环境变量（frontend/.env.production）

```bash
# API 基础路径（生产环境通过Nginx反向代理，使用相对路径）
VITE_API_BASE_URL=/api
```

### 3.3 根目录 .env（可选，覆盖默认值）

```bash
# 数据库
DB_USER=postgres
DB_PASSWORD=你的强密码
DB_NAME=gongkaoxing
DB_PORT=5432

# Redis
REDIS_PORT=6379

# 服务端口
WEB_PORT=80
BACKEND_PORT=8000
```

### 3.4 环境变量配置说明

| 变量名 | 说明 | 必填 | 示例 |
|--------|------|------|------|
| JWT_SECRET_KEY | JWT签名密钥 | 是 | `openssl rand -hex 32` 生成 |
| TTS_API_KEY | 语音合成API密钥 | 否（留空=Mock模式） | 阿里云/讯飞TTS Key |
| TTS_API_URL | 语音合成API地址 | 否 | `https://nls-gateway.cn-shanghai.aliyuncs.com/...` |
| ASR_API_KEY | 语音识别API密钥 | 否（留空=Mock模式） | 阿里云/讯飞ASR Key |
| ASR_API_URL | 语音识别API地址 | 否 | `https://nls-gateway.cn-shanghai.aliyuncs.com/...` |
| LLM_API_KEY | 大语言模型API密钥 | 否（留空=Mock模式） | 通义千问/ChatGLM/GPT Key |
| LLM_API_URL | 大语言模型API地址 | 否 | `https://dashscope.aliyuncs.com/api/v1/...` |
| LLM_MODEL | 模型名称 | 否 | `qwen-plus` / `gpt-4o` |
| SMS_ENABLED | 短信验证码开关 | 是 | False（MVP）/ True（生产） |

---

## 4. PostgreSQL 数据库初始化SQL脚本

### 4.1 自动初始化

SQL脚本位于 `backend/sql/init.sql`，PostgreSQL 容器**首次启动时自动执行**（仅执行一次）。

### 4.2 脚本内容概要

| 序号 | 表名 | 说明 | 关键字段 |
|------|------|------|----------|
| 1 | users | 用户表 | phone(唯一索引), member_type, daily_practice_count |
| 2 | questions | 题库表 | category(索引), exam_type(索引), difficulty |
| 3 | practice_records | 练习记录表 | 5维评分字段, file_expire_at, user_id(索引) |
| 4 | follow_up_records | 追问记录表 | round_number(1-3), practice_record_id(索引) |
| 5 | verification_codes | 验证码表 | phone(索引), code |

### 4.3 索引策略

```sql
-- 用户表：手机号查询（登录）
CREATE INDEX idx_users_phone ON users(phone);
-- 用户表：会员类型筛选
CREATE INDEX idx_users_member_type ON users(member_type);
-- 题库表：按题型筛选
CREATE INDEX idx_questions_category ON questions(category);
-- 题库表：按考试类型筛选
CREATE INDEX idx_questions_exam_type ON questions(exam_type);
-- 练习记录：用户练习历史查询
CREATE INDEX idx_practice_user_id ON practice_records(user_id);
-- 练习记录：按时间排序
CREATE INDEX idx_practice_created_at ON practice_records(created_at);
-- 追问记录：按练习记录关联查询
CREATE INDEX idx_followup_practice_id ON follow_up_records(practice_record_id);
-- 验证码：按手机号查询
CREATE INDEX idx_verify_phone ON verification_codes(phone);
```

### 4.4 手动执行初始化

如需手动执行（容器已存在数据）：

```bash
# 进入数据库容器执行
docker exec -i gkx-db psql -U postgres -d gongkaoxing < backend/sql/init.sql
```

### 4.5 导入题库种子数据

数据库初始化后，运行题库导入脚本（105道题）：

```bash
# 进入后端容器执行
docker exec -it gkx-backend python -m app.seed
```

---

## 5. 前端打包构建生产环境操作步骤

### 5.1 前置条件

| 工具 | 版本要求 | 验证命令 |
|------|----------|----------|
| Node.js | >= 18.x | `node --version` |
| npm | >= 9.x | `npm --version` |

### 5.2 构建步骤

```bash
# 1. 进入前端目录
cd frontend

# 2. 安装依赖（首次构建）
npm install

# 3. 配置生产环境变量
#    确认 .env.production 文件存在，内容如下：
#    VITE_API_BASE_URL=/api

# 4. 执行生产构建
npm run build

# 5. 验证构建产物
#    构建成功后会在 frontend/dist/ 目录生成静态文件：
#    - index.html
#    - assets/
#      ├── index-[hash].js    (React应用)
#      └── index-[hash].css   (TailwindCSS样式)

# 6. 本地预览验证（可选）
npm run preview
```

### 5.3 构建产物目录结构

```
frontend/dist/
├── index.html              # 入口HTML
├── favicon.svg             # 站点图标
└── assets/
    ├── index-[hash].js     # 主JS包（React+路由+页面）
    ├── index-[hash].css    # 主CSS包（TailwindCSS）
    └── vendor-[hash].js    # 第三方依赖（react/react-dom/router）
```

### 5.4 Nginx 部署

构建产物 `dist/` 目录会被 Docker Compose 自动挂载到 Nginx 容器：

```yaml
# docker-compose.yml 中的挂载配置
volumes:
  - ./frontend/dist:/usr/share/nginx/html:ro
```

### 5.5 构建注意事项

| 事项 | 说明 |
|------|------|
| VITE_ 前缀 | 前端环境变量必须以 `VITE_` 开头，否则不会暴露到客户端 |
| API路径 | 生产环境使用 `/api` 相对路径，由Nginx反向代理到后端 |
| 缓存策略 | JS/CSS文件名含hash，可安全设置长缓存（30天） |
| Source Map | 生产构建不生成 .map 文件，避免暴露源码 |

---

## 6. 完整部署流程（从零到上线）

### 6.1 环境准备

```bash
# 1. 安装 Docker + Docker Compose
curl -fsSL https://get.docker.com | sh
sudo systemctl enable docker
sudo systemctl start docker

# 2. 验证安装
docker --version          # Docker version 24.x+
docker compose version    # Docker Compose version v2.x+
```

### 6.2 部署步骤

```bash
# 1. 克隆项目到服务器
git clone <仓库地址> gongkaoxing
cd gongkaoxing

# 2. 构建前端
cd frontend
npm install
npm run build
cd ..

# 3. 配置后端环境变量
cp backend/.env.example backend/.env.production
# 编辑 backend/.env.production，填写以下必填项：
#   - JWT_SECRET_KEY（生成命令：openssl rand -hex 32）
#   - 第三方AI服务API Key（如需启用真实AI功能）
vim backend/.env.production

# 4. （可选）配置根目录 .env 覆盖默认端口和密码
cat > .env << 'EOF'
DB_PASSWORD=你的强密码
WEB_PORT=80
EOF

# 5. 启动所有服务
docker compose up -d

# 6. 等待服务就绪（约30秒）
docker compose ps
# 预期输出：4个容器全部 Up (healthy)

# 7. 导入题库种子数据
docker exec -it gkx-backend python -m app.seed

# 8. 验证部署
curl http://localhost/api/health
# 预期返回：{"status":"ok","version":"0.1.0"}

# 9. 浏览器访问
# http://服务器IP
```

### 6.3 部署验证清单

| 验证项 | 命令 | 预期结果 |
|--------|------|----------|
| 容器状态 | `docker compose ps` | 4个容器 Up |
| 健康检查 | `curl http://localhost/api/health` | `{"status":"ok"}` |
| 前端页面 | 浏览器访问 `http://IP` | 显示首页 |
| 登录功能 | 浏览器访问 `/login` | 可发送验证码 |
| 题库数据 | 浏览器访问 `/questions` | 显示题目列表 |
| 数据库连接 | `docker exec gkx-db psql -U postgres -d gongkaoxing -c "SELECT count(*) FROM questions;"` | 返回题库数量 |

---

## 7. 运维手册（启动/重启/日志/备份）

### 7.1 服务管理

```bash
# ---------- 启动所有服务 ----------
docker compose up -d

# ---------- 停止所有服务 ----------
docker compose down

# ---------- 重启单个服务 ----------
docker compose restart backend    # 重启后端
docker compose restart nginx      # 重启Nginx
docker compose restart db         # 重启数据库

# ---------- 重启所有服务 ----------
docker compose restart

# ---------- 重新构建后端镜像（代码更新后）----------
docker compose up -d --build backend

# ---------- 查看服务状态 ----------
docker compose ps
```

### 7.2 日志查看

```bash
# ---------- 查看所有服务日志 ----------
docker compose logs -f

# ---------- 查看指定服务日志 ----------
docker compose logs -f backend    # 后端日志
docker compose logs -f nginx      # Nginx日志
docker compose logs -f db         # 数据库日志
docker compose logs -f redis      # Redis日志

# ---------- 查看最近100行日志 ----------
docker compose logs --tail 100 backend

# ---------- 查看指定时间段日志 ----------
docker compose logs --since 2026-07-27T00:00:00 backend
docker compose logs --since 30m backend    # 最近30分钟

# ---------- 实时过滤错误日志 ----------
docker compose logs -f backend 2>&1 | grep -i "error\|exception\|traceback"
```

### 7.3 数据库备份与恢复

```bash
# ---------- 数据库备份 ----------
# 全量备份
docker exec gkx-db pg_dump -U postgres gongkaoxing > backup_$(date +%Y%m%d_%H%M%S).sql

# 仅备份题库数据
docker exec gkx-db pg_dump -U postgres -t questions gongkaoxing > questions_backup.sql

# ---------- 数据库恢复 ----------
docker exec -i gkx-db psql -U postgres -d gongkaoxing < backup_20260727_120000.sql

# ---------- 备份上传的音视频文件 ----------
docker run --rm -v gongkaoxing_uploads:/data -v $(pwd):/backup alpine \
  tar czf /backup/uploads_backup_$(date +%Y%m%d).tar.gz /data

# ---------- 定时备份（crontab）----------
# 编辑定时任务
crontab -e
# 添加以下内容（每天凌晨3点自动备份）：
0 3 * * * docker exec gkx-db pg_dump -U postgres gongkaoxing > /backups/db_$(date +\%Y\%m\%d).sql 2>&1
```

### 7.4 数据库迁移（表结构变更）

```bash
# 后端应用启动时会自动执行 Base.metadata.create_all()
# 如需手动执行建表：
docker exec -it gkx-backend python -c "
import asyncio
from app.database import async_engine, Base
from app.models.models import *

async def init():
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('Tables created successfully')

asyncio.run(init())
"

# 如需执行 init.sql 中的建表语句（带索引和触发器）：
docker exec -i gkx-db psql -U postgres -d gongkaoxing < backend/sql/init.sql
```

### 7.5 Redis 管理

```bash
# 进入 Redis 命令行
docker exec -it gkx-redis redis-cli

# 常用命令
KEYS *              # 查看所有Key
FLUSHDB             # 清空当前数据库（谨慎！）
INFO memory         # 查看内存使用
CONFIG GET maxmemory  # 查看内存限制
```

### 7.6 资源监控

```bash
# ---------- 查看容器资源占用 ----------
docker stats

# ---------- 查看磁盘空间 ----------
docker system df

# ---------- 清理无用镜像和容器 ----------
docker system prune -a

# ---------- 查看数据库大小 ----------
docker exec gkx-db psql -U postgres -d gongkaoxing -c \
  "SELECT pg_size_pretty(pg_database_size('gongkaoxing'));"

# ---------- 查看各表数据量 ----------
docker exec gkx-db psql -U postgres -d gongkaoxing -c "
  SELECT relname, n_live_tup 
  FROM pg_stat_user_tables 
  ORDER BY n_live_tup DESC;
"
```

### 7.7 更新部署

```bash
# ---------- 更新前端代码后重新部署 ----------
cd frontend
git pull
npm install
npm run build
docker compose restart nginx

# ---------- 更新后端代码后重新部署 ----------
cd backend
git pull
docker compose up -d --build backend

# ---------- 更新数据库初始化脚本 ----------
docker compose down db
docker volume rm gongkaoxing_pgdata    # 警告：会删除所有数据！
docker compose up -d db
docker exec -it gkx-backend python -m app.seed
```

---

## 8. 第三方AI服务接入说明

### 8.1 LLM 大语言模型（评分/追问）

推荐使用阿里云通义千问：

```bash
# .env.production 配置
LLM_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
LLM_API_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
LLM_MODEL=qwen-plus
```

其他兼容选项：
- OpenAI GPT-4o：`LLM_API_URL=https://api.openai.com/v1/chat/completions`，`LLM_MODEL=gpt-4o`
- 智谱 ChatGLM：`LLM_API_URL=https://open.bigmodel.cn/api/paas/v4/chat/completions`，`LLM_MODEL=glm-4`

### 8.2 TTS 语音合成

推荐使用阿里云语音合成：

```bash
TTS_API_KEY=你的阿里云API Key
TTS_API_URL=https://nls-gateway.cn-shanghai.aliyuncs.com/rest/v1/tts
```

### 8.3 ASR 语音识别

推荐使用阿里云语音识别：

```bash
ASR_API_KEY=你的阿里云API Key
ASR_API_URL=https://nls-gateway.cn-shanghai.aliyuncs.com/rest/v1/asr
```

### 8.4 Mock 模式

所有AI服务API Key留空时，后端自动降级为Mock模式：
- TTS：返回模拟音频URL
- ASR：返回模拟识别文本
- LLM评分：返回示例5维评分（各维度60-85分）
- LLM追问：按轮次返回固定追问问题

---

## 9. 常见问题排查

### 9.1 服务无法启动

| 现象 | 原因 | 解决方案 |
|------|------|----------|
| backend 容器反复重启 | 数据库未就绪 | 检查 `docker compose logs db`，确认数据库健康 |
| nginx 返回 502 | 后端未启动或端口错误 | `docker compose logs backend` 查看后端日志 |
| 前端页面空白 | dist 目录未构建 | `cd frontend && npm run build` |
| 数据库连接拒绝 | 密码不匹配 | 检查 `.env.production` 和 docker-compose.yml 中的密码一致 |

### 9.2 文件上传失败

| 现象 | 原因 | 解决方案 |
|------|------|----------|
| 413 Request Entity Too Large | Nginx 上传限制 | 检查 nginx.conf 中 `client_max_body_size 60m` |
| 400 文件大小超过限制 | 超过后端限制 | 音频>10MB 或 视频>50MB |
| 403 未授权 | Token 过期 | 重新登录获取新Token |

### 9.3 AI服务调用失败

| 现象 | 原因 | 解决方案 |
|------|------|----------|
| 评分返回默认60分 | LLM API Key 未配置 | 配置 `.env.production` 中的 LLM_API_KEY |
| 502 Bad Gateway | 第三方AI服务不可达 | 检查网络连通性和API URL |
| ASR返回Mock文本 | ASR API Key 未配置 | 配置 `.env.production` 中的 ASR_API_KEY |

### 9.4 权限相关

| 现象 | 原因 | 解决方案 |
|------|------|----------|
| 401 未授权 | Token无效或过期 | 前端自动跳转登录页 |
| 403 免费用户练习上限 | 每日超过5次 | 等待次日或开通会员 |
| 403 追问上限 | 超过3次追问 | 正常限制，每场最多3次 |

---

## 附录：项目文件结构

```
gongkaoxing/
├── docker-compose.yml          # Docker 编排配置
├── deployment.md               # 本部署文档
├── spec.md / tasks.md / checklist.md / test-report.md
│
├── backend/
│   ├── Dockerfile              # 后端容器镜像
│   ├── requirements.txt        # Python 依赖
│   ├── .env.example            # 环境变量示例
│   ├── .env.production         # 生产环境变量
│   ├── sql/
│   │   └── init.sql            # 数据库初始化脚本
│   ├── uploads/                # 上传文件存储
│   └── app/
│       ├── main.py             # FastAPI 入口
│       ├── config.py           # 全局配置
│       ├── database.py         # 数据库连接
│       ├── seed.py             # 题库种子数据
│       ├── models/             # ORM 模型
│       ├── schemas/            # Pydantic 校验
│       ├── routers/            # API 路由
│       ├── services/           # 业务服务
│       └── utils/              # 工具函数
│
├── frontend/
│   ├── Dockerfile              # 前端容器镜像（可选）
│   ├── .env.production         # 前端环境变量
│   ├── dist/                   # 构建产物
│   └── src/
│       ├── components/         # React 组件
│       ├── pages/              # 页面组件
│       ├── store/              # 状态管理
│       ├── lib/                # 工具库
│       └── types/              # 类型定义
│
└── nginx/
    └── nginx.conf              # Nginx 配置
```

---

**部署文档版本**：v1.0  
**对应项目版本**：MVP v0.1.0  
**最后更新**：2026-07-27
