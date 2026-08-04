"""VerinX公考AI全真面试模拟 - FastAPI 应用入口"""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import select, func

from app.config import settings
from app.database import async_engine, Base, IS_SQLITE
from app.models.models import Question, generate_uuid


QUESTIONS_DATA = [
    {
        "category": "综合分析",
        "exam_type": "国考",
        "province": None,
        "content": "近年来，'996'工作制引发社会广泛关注和争议，对此你怎么看？",
        "difficulty": 3,
        "answer_reference": "首先要明确态度，996工作制违背劳动法，损害员工身心健康。然后从企业管理、法律保障、员工权益等方面展开分析，最后提出合理建议。",
    },
    {
        "category": "人际沟通",
        "exam_type": "省考",
        "province": "广东",
        "content": "你刚到新单位，领导安排你和老同事合作完成一项任务，但老同事对你态度冷淡，不配合工作，你怎么办？",
        "difficulty": 2,
        "answer_reference": "保持谦虚态度，主动沟通了解原因，反思自身不足，积极学习，逐步建立信任关系，共同完成任务。",
    },
    {
        "category": "应急应变",
        "exam_type": "事业单位",
        "province": "北京",
        "content": "你负责的重要会议资料突然丢失，距离会议开始仅剩半小时，你怎么办？",
        "difficulty": 4,
        "answer_reference": "保持冷静，立即采取补救措施：联系打印店重新打印，安排同事协助，向领导汇报情况，做好会议准备工作。",
    },
    {
        "category": "组织管理",
        "exam_type": "国考",
        "province": None,
        "content": "领导让你组织一次单位内部的业务培训活动，你怎么组织？",
        "difficulty": 3,
        "answer_reference": "明确培训目标，制定详细计划，确定时间地点，邀请讲师，宣传动员，组织实施，做好反馈总结。",
    },
    {
        "category": "自我认知",
        "exam_type": "省考",
        "province": "浙江",
        "content": "请结合你的个人经历，谈谈为什么选择报考公务员？",
        "difficulty": 2,
        "answer_reference": "结合自身优势和公务员职业特点，强调责任感、使命感，表达服务社会的愿望。",
    },
    {
        "category": "综合分析",
        "exam_type": "国考",
        "province": None,
        "content": "人工智能技术的快速发展给社会带来了哪些机遇和挑战？",
        "difficulty": 4,
        "answer_reference": "机遇包括提高效率、改善服务、推动创新；挑战包括就业结构变化、隐私安全、伦理问题等。",
    },
    {
        "category": "人际沟通",
        "exam_type": "事业单位",
        "province": "上海",
        "content": "你在工作中提出了一个创新方案，但被领导否决了，你怎么办？",
        "difficulty": 3,
        "answer_reference": "认真听取领导意见，分析方案不足，改进完善，择机再次汇报，保持积极心态。",
    },
    {
        "category": "应急应变",
        "exam_type": "省考",
        "province": "江苏",
        "content": "群众在单位门口聚集上访，情绪激动，你作为值班人员如何处理？",
        "difficulty": 4,
        "answer_reference": "保持冷静，安抚群众情绪，了解诉求，及时汇报领导，协调相关部门处理，做好记录。",
    },
]


async def init_questions(db):
    """初始化题库数据并加载到去重池"""
    result = await db.execute(select(func.count(Question.id)))
    count = result.scalar()
    if count == 0:
        for q_data in QUESTIONS_DATA:
            question = Question(
                id=generate_uuid(),
                **q_data,
            )
            db.add(question)
        await db.commit()

    # 加载所有题目到去重池（防止进程重启后重复出题）
    from app.services.dedup import get_deduplicator
    result = await db.execute(select(Question.content))
    contents = result.scalars().all()
    dedup = get_deduplicator()
    loaded = 0
    for content in contents:
        if content and dedup.add_question(content):
            loaded += 1
    print(f"[启动] 已加载 {loaded} 道题目到去重池")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时建表，关闭时清理"""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_engine.begin() as conn:
        from sqlalchemy.ext.asyncio import AsyncSession
        session = AsyncSession(bind=conn)
        await init_questions(session)
        await session.close()

    # 静默同步云端增量题库（联网时自动下载新题，失败不报错）
    from app.services.real_questions import get_real_question_service
    from app.config import settings

    if settings.QUESTION_BANK_AUTO_SYNC:
        try:
            service = get_real_question_service()
            sync_result = service.try_sync()
            if sync_result.get("synced"):
                print(f"[启动] 题库增量同步成功，新增 {sync_result.get('added', 0)} 题")
            else:
                print(f"[启动] 题库同步跳过: {sync_result.get('reason', '')}")
        except Exception as e:
            print(f"[启动] 题库同步异常（不影响服务）: {e}")

    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# CORS：支持所有来源（本地部署用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态文件服务（上传的音视频）
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


# ---------- 路由注册 ----------
from app.routers import auth, user, question, practice, upload, ai, stats  # noqa: E402

app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(user.router, prefix="/api/user", tags=["用户"])
app.include_router(question.router, prefix="/api/questions", tags=["题库"])
app.include_router(practice.router, prefix="/api/practice", tags=["练习"])
app.include_router(upload.router, prefix="/api/upload", tags=["文件上传"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI服务"])
app.include_router(stats.router, prefix="/api/stats", tags=["统计分析"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": settings.APP_VERSION}


# 前端静态文件服务（SPA fallback）
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIST / "index.html"))
