# VerinX · AI 全真面试模拟

## 一键部署

### 1. 部署后端到 Hugging Face Spaces

[![Deploy to Hugging Face Spaces](https://huggingface.co/datasets/huggingface/badges/raw/main/deploy-to-spaces-lg.svg)](https://huggingface.co/new-space?template=god19921111/verinx-deploy)

点击上方按钮后：
1. Space name 填 `verinx-api`
2. SDK 选 **Docker**
3. Visibility 选 **Public**
4. 点击 **Create Space**
5. 进入 Space → **Settings → Repository secrets**，添加：
   - `ZHIPU_API_KEY`：你的智谱 API Key
   - `JWT_SECRET_KEY`：随机字符串（至少 16 位）
   - `CORS_ALLOW_ORIGINS`：前端地址，如 `https://verinx.vercel.app`
6. 等待构建完成（约 8-15 分钟）
7. 拿到后端地址：`https://你的用户名-verinx-api.hf.space`

### 2. 部署前端到 Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/god19921111/verinx-deploy&root-directory=frontend&env=VITE_API_BASE_URL)

点击上方按钮后：
1. Project name 填 `verinx`
2. Root Directory 保持 `frontend`
3. 环境变量 `VITE_API_BASE_URL` 填：`https://你的用户名-verinx-api.hf.space/api`
4. 点击 **Deploy**
5. 等待 2-3 分钟，拿到前端地址

### 3. 回填 CORS

回到 Hugging Face Space 设置，把 `CORS_ALLOW_ORIGINS` 改成 Vercel 给你的真实地址。
