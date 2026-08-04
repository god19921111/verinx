---
title: VerinX API
emoji: 🚀
colorFrom: dark
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# VerinX · AI 全真面试模拟 后端服务

Hugging Face Spaces 部署的后端 API，基于 FastAPI + 智谱 GLM-4-Flash + FunASR。

## 配置说明

在 Space 的 **Settings → Repository secrets** 中添加以下变量：

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `ZHIPU_API_KEY` | ✅ | 智谱 GLM API Key（出题+评分，免费） |
| `JWT_SECRET_KEY` | ✅ | JWT 密钥（随机字符串） |
| `CORS_ALLOW_ORIGINS` | ✅ | 前端域名，如 `https://verinx.pages.dev` |
| `DOUBAO_API_KEY` | ❌ | 豆包 API（可选） |
| `BAIDU_API_KEY` | ❌ | 百度语音识别（可选） |
| `BAIDU_SECRET_KEY` | ❌ | 百度语音识别（可选） |

## 健康检查

访问 `https://<你的space名>-api.hf.space/api/health` 应返回 `{"status":"ok"}`

## 免费额度

- 2 核 vCPU + 16GB 内存 + 50GB 持久存储
- 永久免费，电脑关机不影响运行
