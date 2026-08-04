---
title: VerinX
emoji: 🌌
colorFrom: gray
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: AI全真面试模拟 · 求真思辨 面见未来
---

# 🌌 VerinX · AI 全真面试模拟

> 求真思辨 面见未来

基于 FastAPI + React + 智谱 GLM-4-Flash 的公考面试全真模拟系统。

## ✨ 核心功能

- **AI 出题**：智谱 GLM-4-Flash 免费大模型 + 真实历年真题库
- **AI 评分**：多维度智能评分（分析力、表达力、应变力、组织力）
- **语音识别**：录音答题 + 自动转文字（FunASR / 百度语音）
- **极限挑战**：高压环境模拟，30秒思考 + 120秒答题
- **连胜激励**：连续打卡记录，促进学习习惯养成

## 🚀 部署说明

### 环境变量（必填）

在 Space Settings → **Repository secrets** 中添加：

| 变量名 | 说明 | 获取方式 |
|--------|------|----------|
| `ZHIPU_API_KEY` | 智谱 AI API Key | https://open.bigmodel.cn/ (GLM-4-Flash 免费) |
| `JWT_SECRET_KEY` | JWT 签名密钥 | 随机 32 位字符串 |
| `DOUBAO_API_KEY` | 豆包 API Key (可选) | 火山引擎控制台 |

### 环境变量（可选）

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `DATABASE_URL` | `sqlite:////data/verinx.db` | 数据库连接 |
| `UPLOAD_DIR` | `/data/uploads` | 文件上传目录 |
| `DEBUG` | `False` | 调试模式 |
| `FREE_DAILY_PRACTICE_LIMIT` | `3` | 免费用户每日练习上限 |

## 📦 技术栈

- **后端**：FastAPI + SQLAlchemy + SQLite + Uvicorn
- **前端**：React 19 + TypeScript + Vite + Tailwind CSS 4
- **AI**：智谱 GLM-4-Flash (免费) + 真实真题数据库
- **部署**：Docker 多阶段构建 + Hugging Face Spaces

## ⚠️ 注意事项

1. **免费版限制**：HF Spaces 免费版为临时存储，容器重启后数据库和上传文件会丢失
   - 如需持久存储，需升级到 HF Pro（$9/月）
   - 或配置外部数据库（如 Supabase、Neon）

2. **自动休眠**：免费版 Space 48 小时无访问会自动休眠，首次访问需等待冷启动（约 30 秒）

3. **国内访问**：HF Spaces 在国内访问可能不稳定，建议配置自定义域名或使用 CDN

## 🔧 本地开发

```bash
# 后端
cd backend
pip install -r requirements-deploy.txt
uvicorn app.main:app --reload --port 8000

# 前端
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173 （前端会代理到 8000 端口）
