"""
VerinX 后端入口 - Gradio 包装器
通过 Gradio SDK 在 Hugging Face Spaces 免费运行 FastAPI
Gradio SDK 免费，Docker SDK 收费，所以用 Gradio 包装 FastAPI
"""

import gradio as gr
import uvicorn
import threading
import os

# 启动 FastAPI 后端（在后台线程运行）
def run_fastapi():
    from app.main import app
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)

# 在后台线程启动 FastAPI
fastapi_thread = threading.Thread(target=run_fastapi, daemon=True)
fastapi_thread.start()

# 创建一个最简 Gradio 界面（HF Spaces 要求必须有 Gradio 组件）
with gr.Blocks(
    title="VerinX API",
    theme=gr.themes.Soft(),
) as demo:
    gr.Markdown("""
    # 🚀 VerinX · AI 全真面试模拟

    后端 API 运行中 ✅

    - API 文档：`/docs`
    - 健康检查：`/api/health`
    - 出题接口：`/api/ai/question`
    - 评分接口：`/api/ai/score`
    """)

# HF Spaces 自动调用 demo.launch()
demo.launch(server_name="0.0.0.0", server_port=7861)
