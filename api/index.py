"""VerinX Vercel Serverless 入口 - 适配无状态 Serverless 环境

Vercel 限制：
- 无持久文件系统（只读，除 /tmp）
- 10秒超时（免费版）
- 1024MB 内存
- 无状态（每次冷启动重置内存）

改造策略：
- 数据库 → 内存字典（demo 模式，Function 实例存活期间可用）
- 文件上传 → 返回 mock URL
- ASR → 返回 mock 文本
- 保留核心：AI 出题 + AI 评分（调用智谱 GLM-4-Flash）
"""

import os
import json
import re
import time
import uuid
import random
from datetime import datetime, timedelta, date
from typing import Optional

import httpx
from fastapi import FastAPI, Request, Query, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from jose import jwt, JWTError
from passlib.context import CryptContext


# ========== 配置 ==========
JWT_SECRET = os.environ.get("JWT_SECRET_KEY", "verinx-demo-secret-2024")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "1440"))
ZHIPU_API_KEY = os.environ.get("ZHIPU_API_KEY", "")
ZHIPU_API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"

# 四维评分权重
SCORE_WEIGHT_ANALYSIS = 0.30
SCORE_WEIGHT_EXPRESSION = 0.25
SCORE_WEIGHT_ADAPTABILITY = 0.25
SCORE_WEIGHT_ORGANIZATION = 0.20

# 密码工具
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ========== 内存数据存储（Function 实例存活期间可用） ==========
# 用户表: {user_id: {id, phone, name, avatar, password, member_type, ...}}
USERS: dict = {}
# 验证码: {phone: {"code": "1234", "expire": timestamp}}
VERIFICATION_CODES: dict = {}
# 题库: [{id, category, exam_type, province, content, difficulty, answer_reference, created_at}]
QUESTIONS: list = []
# 练习记录: {practice_id: {...}}
PRACTICES: dict = {}
# 打卡记录列表: [{id, user_id, checkin_date, category, score}]
CHECKIN_RECORDS: list = []


# ========== 内置题库数据（从 backend/app/main.py 复制） ==========
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

# AI 出题兜底题库（按分类）
MOCK_QUESTION_POOL = {
    "综合分析": [
        "请谈谈你对当前经济高质量发展的理解，结合实际分析其重要意义和实现路径。",
        "数字经济已成为推动社会发展的重要引擎，请分析其面临的挑战及应对策略。",
        "乡村振兴是国家重大战略，请结合实际谈谈如何推进农村产业发展。",
    ],
    "人际沟通": [
        "你在工作中遇到同事不配合的情况，你如何处理？",
        "领导安排你与同事合作，但对方态度消极，你怎么办？",
        "你发现领导在工作中出现了失误，你会怎么处理？",
    ],
    "应急应变": [
        "你负责的活动即将开始时出现意外情况，你如何应对？",
        "值班时接到紧急通知需要立即处理，你怎么办？",
        "你单位组织的会议现场突然停电，你如何处置？",
    ],
    "组织管理": [
        "领导安排你组织一次业务培训，你如何开展？",
        "请谈谈你组织一次调研活动的工作思路。",
        "单位让你组织一场主题活动，你怎么做？",
    ],
    "自我认知": [
        "请结合实际谈谈你的职业规划。",
        "你认为报考这个岗位的优势是什么？",
        "请说说你的缺点，以及你准备如何改进。",
    ],
}


def _init_questions():
    """初始化内置题库到内存"""
    if QUESTIONS:
        return
    now = datetime.utcnow()
    for i, q_data in enumerate(QUESTIONS_DATA):
        QUESTIONS.append({
            "id": f"q-{i+1}",
            "category": q_data["category"],
            "exam_type": q_data["exam_type"],
            "province": q_data["province"],
            "content": q_data["content"],
            "difficulty": q_data["difficulty"],
            "answer_reference": q_data["answer_reference"],
            "created_at": now - timedelta(hours=i),
        })


def _get_demo_user() -> dict:
    """获取或创建 demo 用户"""
    demo_id = "demo-user-001"
    if demo_id not in USERS:
        USERS[demo_id] = {
            "id": demo_id,
            "phone": "13800000000",
            "name": "VIP体验用户",
            "avatar": None,
            "password": None,
            "member_type": "premium",
            "member_expire_at": datetime.utcnow() + timedelta(days=365),
            "daily_practice_count": 0,
            "total_practice_count": 0,
            "avg_score": 0.0,
            "streak_days": 0,
            "max_streak_days": 0,
            "total_checkin_days": 0,
            "last_checkin_date": None,
            "last_practice_date": None,
            "rank_score": 0.0,
        }
    return USERS[demo_id]


# ========== JWT 认证工具 ==========

def create_access_token(user_id: str) -> str:
    """生成 JWT Token"""
    expire = datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """解析 JWT Token"""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None


async def get_current_user(request: Request) -> dict:
    """获取当前登录用户（简化版：无 Token 时回退到 demo 用户）"""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        payload = decode_access_token(token)
        if payload and payload.get("sub"):
            user = USERS.get(payload["sub"])
            if user:
                return user
    # 无 Token 或无效 → 回退到 demo 用户（保证 demo 模式可用）
    return _get_demo_user()


def _user_response(user: dict) -> dict:
    """构造用户响应"""
    return {
        "id": user["id"],
        "phone": user["phone"],
        "name": user.get("name"),
        "avatar": user.get("avatar"),
        "member_type": user.get("member_type", "free"),
        "member_expire_at": user.get("member_expire_at"),
        "daily_practice_count": user.get("daily_practice_count", 0),
        "total_practice_count": user.get("total_practice_count", 0),
        "avg_score": user.get("avg_score", 0.0),
    }


# ========== 智谱 GLM-4-Flash 调用 ==========

async def call_zhipu(prompt: str, max_tokens: int = 1000, temperature: float = 0.7) -> str:
    """调用智谱 GLM-4-Flash，无 API Key 时返回空字符串"""
    if not ZHIPU_API_KEY:
        return ""
    headers = {
        "Authorization": f"Bearer {ZHIPU_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "glm-4-flash",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(ZHIPU_API_URL, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"[智谱GLM] 调用失败: {e}")
        return ""


def _extract_json(text: str) -> Optional[dict]:
    """从文本中提取 JSON 对象"""
    if not text:
        return None
    text = text.strip()
    # 尝试提取 ```json ... ``` 代码块
    m = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if m:
        text = m.group(1).strip()
    # 直接解析
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # 提取第一个 JSON 对象
    start = text.find('{')
    if start == -1:
        return None
    depth = 0
    in_str = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            if escape:
                escape = False
            elif ch == '\\':
                escape = True
            elif ch == '"':
                in_str = False
        else:
            if ch == '"':
                in_str = True
            elif ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start:i + 1])
                    except json.JSONDecodeError:
                        return None
    return None


# ========== 评分 Prompt 模板 ==========

def _build_score_prompt(question_content: str, answer_text: str, question_category: str) -> str:
    """构造评分 Prompt"""
    return f"""我现在要考你一道面试题，直接给我你的分析和回答。

【题目】
{question_content}

【你的回答】
{answer_text}

我要从四个维度给你打分（0-100），别废话，直接干：

1. 综合分析（30%）：分析得深不深？有没有多角度思考？观点有没有新意？
2. 言语表达（25%）：说的顺不顺？条理清不清楚？用词准不准？
3. 应变能力（25%）：脑子活不活？能不能灵活应对？
4. 计划组织（20%）：方案完整吗？能落地吗？

打分原则：
- 结合回答里的具体内容说事儿，别套话空话
- 好就是好，差就是差，别模棱两可
- 用朋友的语气，直接说"你"

严格按JSON返回，不要其他内容：
{{
    "score_analysis": <0-100>,
    "score_expression": <0-100>,
    "score_adaptability": <0-100>,
    "score_organization": <0-100>,
    "report_content": "<直接说你的评价，像朋友聊天，犀利但不伤人，指出亮点和硬伤>",
    "dimension_analysis": {{
        "analysis": "<这个维度你做得怎么样，具体说>",
        "expression": "<这个维度你做得怎么样，具体说>",
        "adaptability": "<这个维度你做得怎么样，具体说>",
        "organization": "<这个维度你做得怎么样，具体说>"
    }},
    "deduction_points": "<直说问题，每条一句话，要具体>",
    "optimization_suggestions": "<怎么改，每条一句话，要具体可执行>"
}}"""


def _build_mock_scores(question_content: str, answer_text: str, question_category: str) -> dict:
    """无 AI 时生成差异化 Mock 评分"""
    answer_len = len(answer_text) if answer_text else 0
    has_structure = any(w in answer_text for w in ["第一", "第二", "第三", "首先", "其次", "最后", "一是", "二是", "三是"]) if answer_text else False
    has_policy = any(w in answer_text for w in ["政策", "法规", "制度", "规定", "文件", "精神", "要求", "标准"]) if answer_text else False
    has_specific = any(w in answer_text for w in ["例如", "比如", "具体", "举例", "实践", "实际", "经验"]) if answer_text else False
    has_depth = answer_len > 100

    if answer_len < 10:
        base = 40
    elif answer_len < 30:
        base = 50
    elif answer_len < 80:
        base = 60
    elif answer_len < 200:
        base = 70
    else:
        base = 78

    analysis = min(100, base + (8 if has_depth else 0) + (5 if has_policy else 0))
    expression = min(100, base + (6 if has_structure else 0))
    adaptability = min(100, base + (4 if has_specific else 0))
    organization = min(100, base + (7 if has_structure else 0) + (3 if has_specific else 0))

    overall = round(
        analysis * SCORE_WEIGHT_ANALYSIS
        + expression * SCORE_WEIGHT_EXPRESSION
        + adaptability * SCORE_WEIGHT_ADAPTABILITY
        + organization * SCORE_WEIGHT_ORGANIZATION,
        1,
    )

    strengths = []
    if has_structure:
        strengths.append("回答具有清晰的结构分层")
    if has_policy:
        strengths.append("引用了政策文件作为支撑")
    if has_specific:
        strengths.append("包含具体实例和实践内容")

    weaknesses = []
    if not has_structure:
        weaknesses.append("回答缺乏清晰的逻辑结构")
    if not has_policy:
        weaknesses.append("未结合政策文件或理论支撑")
    if not has_specific:
        weaknesses.append("缺少具体实例和实践案例")
    if answer_len < 50:
        weaknesses.append("回答内容过于简短，展开不足")

    report = "中规中矩，但亮点不足。" if base < 70 else "不错，有自己的想法，保持这个状态。"
    if strengths:
        report += f" 亮点：{'、'.join(strengths[:2])}。"
    if weaknesses:
        report += f" 硬伤：{'、'.join(weaknesses[:3])}。"

    return {
        "score_overall": overall,
        "score_analysis": analysis,
        "score_expression": expression,
        "score_adaptability": adaptability,
        "score_organization": organization,
        "report_content": report,
        "dimension_analysis": {
            "analysis": f"综合分析{analysis}分。{'分析到位' if has_depth else '分析太浅'}，{'有政策支撑' if has_policy else '缺政策支撑'}。",
            "expression": f"言语表达{expression}分。{'条理清楚' if has_structure else '有点乱'}。",
            "adaptability": f"应变能力{adaptability}分。{'脑子活' if has_specific else '思路不够活'}。",
            "organization": f"计划组织{organization}分。{'方案完整' if has_structure else '方案不完整'}。",
        },
        "deduction_points": "；".join([f"你{w}" for w in weaknesses]) if weaknesses else "没什么明显问题",
        "optimization_suggestions": "用'第一、第二、第三'列点；加一句政策或数据支撑；加一个具体例子让回答活起来。",
    }


def _calculate_overall_score(scores: dict) -> float:
    """计算加权总分"""
    return round(
        scores.get("score_analysis", 0) * SCORE_WEIGHT_ANALYSIS
        + scores.get("score_expression", 0) * SCORE_WEIGHT_EXPRESSION
        + scores.get("score_adaptability", 0) * SCORE_WEIGHT_ADAPTABILITY
        + scores.get("score_organization", 0) * SCORE_WEIGHT_ORGANIZATION,
        1,
    )


# ========== Pydantic 请求模型 ==========

class SendCodeRequest(BaseModel):
    phone: str = Field(..., pattern=r"^1[3-9]\d{9}$")


class LoginCodeRequest(BaseModel):
    phone: str = Field(..., pattern=r"^1[3-9]\d{9}$")
    code: str = Field(..., min_length=4, max_length=6)


class LoginPasswordRequest(BaseModel):
    phone: str = Field(..., pattern=r"^1[3-9]\d{9}$")
    password: str = Field(..., min_length=6, max_length=20)


class RegisterRequest(BaseModel):
    phone: str = Field(..., pattern=r"^1[3-9]\d{9}$")
    code: str = Field(..., min_length=4, max_length=6)
    password: str = Field(..., min_length=6, max_length=20)


class ScoreRequest(BaseModel):
    question_content: str
    answer_text: str
    question_category: str


class ASRRequest(BaseModel):
    audio_url: Optional[str] = None
    audio_duration: Optional[float] = None


class PracticeCreateRequest(BaseModel):
    question_id: str
    practice_mode: str = Field(..., pattern=r"^(single|full)$")


class PracticeUpdateRequest(BaseModel):
    thinking_time: Optional[int] = None
    answer_time: Optional[int] = None
    answer_text: Optional[str] = None
    score_overall: Optional[float] = None
    score_analysis: Optional[float] = None
    score_expression: Optional[float] = None
    score_adaptability: Optional[float] = None
    score_organization: Optional[float] = None
    report_content: Optional[str] = None
    dimension_analysis: Optional[dict] = None
    deduction_points: Optional[str] = None
    optimization_suggestions: Optional[str] = None


# ========== FastAPI 应用 ==========

app = FastAPI(
    title="VerinX·AI全真面试模拟",
    version="0.1.0",
)

# CORS：允许所有来源
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== 认证路由 ====================

@app.post("/api/auth/send-code")
async def send_code(body: SendCodeRequest):
    """发送验证码（demo 模式返回固定验证码 1234）"""
    code = "1234"
    VERIFICATION_CODES[body.phone] = {
        "code": code,
        "expire": time.time() + 300,  # 5分钟有效
    }
    return {"msg": "验证码已发送", "code": code}


@app.post("/api/auth/login-code")
async def login_with_code(body: LoginCodeRequest):
    """验证码登录"""
    record = VERIFICATION_CODES.get(body.phone)
    if not record or record["code"] != body.code or record["expire"] < time.time():
        raise HTTPException(status_code=400, detail="验证码错误或已过期")

    # 查找或创建用户
    user = None
    for u in USERS.values():
        if u["phone"] == body.phone:
            user = u
            break
    if user is None:
        user_id = str(uuid.uuid4())
        user = {
            "id": user_id,
            "phone": body.phone,
            "name": None,
            "avatar": None,
            "password": None,
            "member_type": "free",
            "member_expire_at": None,
            "daily_practice_count": 0,
            "total_practice_count": 0,
            "avg_score": 0.0,
            "streak_days": 0,
            "max_streak_days": 0,
            "total_checkin_days": 0,
            "last_checkin_date": None,
            "last_practice_date": None,
            "rank_score": 0.0,
        }
        USERS[user_id] = user

    token = create_access_token(user["id"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_response(user),
    }


@app.post("/api/auth/login-password")
async def login_with_password(body: LoginPasswordRequest):
    """密码登录"""
    user = None
    for u in USERS.values():
        if u["phone"] == body.phone:
            user = u
            break
    if user is None or user.get("password") is None:
        raise HTTPException(status_code=401, detail="手机号或密码错误")

    if not pwd_context.verify(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="手机号或密码错误")

    token = create_access_token(user["id"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_response(user),
    }


@app.post("/api/auth/quick-login")
async def quick_login():
    """快速登录（返回 demo VIP 用户）"""
    user = _get_demo_user()
    token = create_access_token(user["id"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_response(user),
    }


@app.post("/api/auth/register")
async def register(body: RegisterRequest):
    """用户注册"""
    # 校验验证码
    record = VERIFICATION_CODES.get(body.phone)
    if not record or record["code"] != body.code or record["expire"] < time.time():
        raise HTTPException(status_code=400, detail="验证码错误或已过期")

    # 检查手机号是否已注册
    for u in USERS.values():
        if u["phone"] == body.phone:
            raise HTTPException(status_code=400, detail="该手机号已注册")

    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "phone": body.phone,
        "name": None,
        "avatar": None,
        "password": pwd_context.hash(body.password),
        "member_type": "free",
        "member_expire_at": None,
        "daily_practice_count": 0,
        "total_practice_count": 0,
        "avg_score": 0.0,
        "streak_days": 0,
        "max_streak_days": 0,
        "total_checkin_days": 0,
        "last_checkin_date": None,
        "last_practice_date": None,
        "rank_score": 0.0,
    }
    USERS[user_id] = user

    token = create_access_token(user["id"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_response(user),
    }


# ==================== 题库路由 ====================

@app.get("/api/questions")
async def list_questions(
    category: str = Query(None),
    exam_type: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """题库列表（分页 + 筛选）"""
    _init_questions()
    items = QUESTIONS.copy()
    if category:
        items = [q for q in items if q["category"] == category]
    if exam_type:
        items = [q for q in items if q["exam_type"] == exam_type]

    total = len(items)
    offset = (page - 1) * page_size
    page_items = items[offset:offset + page_size]
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": page_items,
    }


@app.get("/api/questions/random")
async def random_question(
    category: str = Query(None),
    exam_type: str = Query(None),
):
    """随机获取一道题目"""
    _init_questions()
    items = QUESTIONS.copy()
    if category:
        items = [q for q in items if q["category"] == category]
    if exam_type:
        items = [q for q in items if q["exam_type"] == exam_type]
    if not items:
        raise HTTPException(status_code=404, detail="没有找到符合条件的题目")
    return random.choice(items)


@app.get("/api/questions/{question_id}")
async def get_question(question_id: str):
    """获取题目详情"""
    _init_questions()
    for q in QUESTIONS:
        if q["id"] == question_id:
            return q
    raise HTTPException(status_code=404, detail="题目不存在")


# ==================== AI 服务路由 ====================

@app.post("/api/ai/generate-question")
async def generate_question(request: Request):
    """AI 出题（调用智谱 GLM-4-Flash，无 Key 时从内置题库随机抽取）"""
    params = request.query_params
    category = params.get("category", "综合分析")
    exam_type = params.get("exam_type", "国考")
    province = params.get("province", "")

    # 优先调用智谱 GLM 生成题目
    if ZHIPU_API_KEY:
        prompt = f"""你是公考面试出题专家。请生成一道"{category}"类型的面试题。

要求：
1. 题目贴近真实公考面试，有实际情境
2. 难度适中，能考察考生综合能力
3. 提供参考答案要点

严格按JSON返回，不要其他内容：
{{
    "content": "题目内容",
    "answer_reference": "参考答案要点",
    "difficulty": 3,
    "category": "{category}",
    "exam_type": "{exam_type}",
    "province": "{province}"
}}"""
        try:
            response_text = await call_zhipu(prompt, max_tokens=800, temperature=0.8)
            if response_text:
                parsed = _extract_json(response_text)
                if parsed and parsed.get("content"):
                    parsed.setdefault("difficulty", 3)
                    parsed.setdefault("category", category)
                    parsed.setdefault("exam_type", exam_type)
                    parsed.setdefault("province", province)
                    parsed["source"] = "ai"
                    parsed["status"] = "ai-generated"
                    return parsed
        except Exception as e:
            print(f"[AI出题] 调用失败: {e}")

    # 兜底：从内置题库随机抽取
    pool = MOCK_QUESTION_POOL.get(category, MOCK_QUESTION_POOL["综合分析"])
    content = random.choice(pool)
    return {
        "content": content,
        "difficulty": 3,
        "answer_reference": "（请结合实际情况，分3-4个要点作答）",
        "category": category,
        "exam_type": exam_type,
        "province": province,
        "source": "内置题库",
        "status": "fallback",
    }


@app.post("/api/ai/score")
async def score_answer(body: ScoreRequest, request: Request):
    """AI 四维评分（调用智谱 GLM-4-Flash，无 Key 时返回 Mock 评分）"""
    # 优先调用智谱 GLM 评分
    if ZHIPU_API_KEY:
        prompt = _build_score_prompt(body.question_content, body.answer_text, body.question_category)
        try:
            response_text = await call_zhipu(prompt, max_tokens=1500, temperature=0.7)
            if response_text:
                parsed = _extract_json(response_text)
                if parsed and "score_analysis" in parsed:
                    # 确保分数为数字
                    for key in ("score_analysis", "score_expression", "score_adaptability", "score_organization"):
                        parsed[key] = int(parsed.get(key, 60))
                    parsed["score_overall"] = _calculate_overall_score(parsed)
                    parsed.setdefault("report_content", "AI评分完成")
                    parsed.setdefault("dimension_analysis", {
                        "analysis": "", "expression": "", "adaptability": "", "organization": ""
                    })
                    parsed.setdefault("deduction_points", "")
                    parsed.setdefault("optimization_suggestions", "")
                    parsed["weights"] = {
                        "analysis": SCORE_WEIGHT_ANALYSIS,
                        "expression": SCORE_WEIGHT_EXPRESSION,
                        "adaptability": SCORE_WEIGHT_ADAPTABILITY,
                        "organization": SCORE_WEIGHT_ORGANIZATION,
                    }
                    return parsed
        except Exception as e:
            print(f"[AI评分] 调用失败: {e}")

    # 兜底：Mock 评分
    result = _build_mock_scores(body.question_content, body.answer_text, body.question_category)
    result["weights"] = {
        "analysis": SCORE_WEIGHT_ANALYSIS,
        "expression": SCORE_WEIGHT_EXPRESSION,
        "adaptability": SCORE_WEIGHT_ADAPTABILITY,
        "organization": SCORE_WEIGHT_ORGANIZATION,
    }
    return result


@app.post("/api/ai/asr")
async def speech_to_text(body: ASRRequest, request: Request):
    """语音识别（Vercel 无法加载 FunASR，返回 mock 文本）"""
    return {
        "text": "（语音识别演示模式 - Vercel Serverless 环境暂不支持离线 ASR 大模型）",
        "confidence": 0.95,
        "duration": body.audio_duration or 60.0,
        "audio_url": body.audio_url,
        "status": "mock",
    }


# ==================== 练习路由 ====================

@app.post("/api/practice")
async def create_practice(body: PracticeCreateRequest, request: Request):
    """提交练习记录"""
    user = await get_current_user(request)
    _init_questions()

    # 查找题目
    question = None
    for q in QUESTIONS:
        if q["id"] == body.question_id:
            question = q
            break
    if question is None:
        raise HTTPException(status_code=404, detail="题目不存在")

    practice_id = str(uuid.uuid4())
    now = datetime.utcnow()
    practice = {
        "id": practice_id,
        "user_id": user["id"],
        "question_id": body.question_id,
        "question": question,
        "practice_mode": body.practice_mode,
        "thinking_time": None,
        "answer_time": None,
        "answer_text": None,
        "audio_url": None,
        "video_url": None,
        "score_overall": None,
        "score_analysis": None,
        "score_expression": None,
        "score_adaptability": None,
        "score_organization": None,
        "report_content": None,
        "dimension_analysis": None,
        "deduction_points": None,
        "optimization_suggestions": None,
        "follow_ups": [],
        "created_at": now,
    }
    PRACTICES[practice_id] = practice

    # 更新用户练习计数
    user["total_practice_count"] = user.get("total_practice_count", 0) + 1
    today = date.today()
    if user.get("last_practice_date") != today:
        user["daily_practice_count"] = 1
        user["last_practice_date"] = today
    else:
        user["daily_practice_count"] = user.get("daily_practice_count", 0) + 1

    return practice


@app.get("/api/practice")
async def list_practices(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """练习历史列表"""
    user = await get_current_user(request)
    user_practices = [
        p for p in PRACTICES.values()
        if p["user_id"] == user["id"]
    ]
    user_practices.sort(key=lambda x: x["created_at"], reverse=True)

    total = len(user_practices)
    offset = (page - 1) * page_size
    items = user_practices[offset:offset + page_size]
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": items,
    }


@app.get("/api/practice/{practice_id}")
async def get_practice(practice_id: str, request: Request):
    """获取练习详情"""
    user = await get_current_user(request)
    practice = PRACTICES.get(practice_id)
    if practice is None or practice["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="练习记录不存在")
    return practice


@app.put("/api/practice/{practice_id}")
async def update_practice(practice_id: str, body: PracticeUpdateRequest, request: Request):
    """更新练习记录（思考时间/答题时间/答题文本/评分结果）"""
    user = await get_current_user(request)
    practice = PRACTICES.get(practice_id)
    if practice is None or practice["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="练习记录不存在")

    update_fields = [
        "thinking_time", "answer_time", "answer_text",
        "score_overall", "score_analysis", "score_expression",
        "score_adaptability", "score_organization",
        "report_content", "dimension_analysis",
        "deduction_points", "optimization_suggestions",
    ]
    for field in update_fields:
        val = getattr(body, field)
        if val is not None:
            practice[field] = val

    # 更新用户平均分
    if body.score_overall is not None:
        scored = [p for p in PRACTICES.values() if p["user_id"] == user["id"] and p.get("score_overall") is not None]
        if scored:
            user["avg_score"] = round(sum(p["score_overall"] for p in scored) / len(scored), 1)

    return practice


# ==================== 统计路由 ====================

@app.get("/api/stats/dashboard")
async def get_dashboard(request: Request):
    """仪表盘统计：能力雷达图 + 进步趋势 + 薄弱项 + 练习统计"""
    user = await get_current_user(request)
    scored = [
        p for p in PRACTICES.values()
        if p["user_id"] == user["id"] and p.get("score_overall") is not None
    ]
    scored.sort(key=lambda x: x["created_at"])

    total_practiced = len(scored)
    if total_practiced == 0:
        return {
            "total_practiced": 0,
            "radar": {"analysis": 0, "expression": 0, "adaptability": 0, "organization": 0},
            "trend": [],
            "weakness": {"category": "", "dimension": "", "score": 0, "suggestion": "完成首次练习后即可获得分析"},
            "stats": {"avg_score": 0, "best_score": 0, "this_week_count": 0, "streak_days": 0},
            "category_stats": {},
        }

    # 四维平均分
    avg_analysis = sum(p.get("score_analysis") or 0 for p in scored) / total_practiced
    avg_expression = sum(p.get("score_expression") or 0 for p in scored) / total_practiced
    avg_adaptability = sum(p.get("score_adaptability") or 0 for p in scored) / total_practiced
    avg_organization = sum(p.get("score_organization") or 0 for p in scored) / total_practiced
    radar = {
        "analysis": round(avg_analysis, 1),
        "expression": round(avg_expression, 1),
        "adaptability": round(avg_adaptability, 1),
        "organization": round(avg_organization, 1),
    }

    # 进步趋势
    trend = [
        {
            "date": p["created_at"].strftime("%m-%d %H:%M"),
            "score": round(p.get("score_overall") or 0, 1),
            "category": p.get("question", {}).get("category", "") if isinstance(p.get("question"), dict) else "",
        }
        for p in scored[-30:]
    ]

    # 薄弱项分析
    dim_scores = {
        "综合分析能力": avg_analysis,
        "言语表达能力": avg_expression,
        "应变能力": avg_adaptability,
        "计划组织能力": avg_organization,
    }
    weakest_dim = min(dim_scores, key=dim_scores.get)

    category_scores: dict = {}
    for p in scored:
        cat = p.get("question", {}).get("category", "") if isinstance(p.get("question"), dict) else ""
        if cat not in category_scores:
            category_scores[cat] = []
        category_scores[cat].append(p.get("score_overall") or 0)
    category_avg = {cat: round(sum(s) / len(s), 1) for cat, s in category_scores.items()}
    weakest_category = min(category_avg, key=category_avg.get) if category_avg else ""

    weakness_suggestions = {
        "综合分析能力": "建议多关注时事热点，练习从多角度分析问题，注重逻辑框架的搭建",
        "言语表达能力": "建议练习口头表达，注意语言的准确性和条理性，多使用连接词",
        "应变能力": "建议模拟突发场景练习，培养冷静应对的心态，学会分轻重缓急处理问题",
        "计划组织能力": "建议学习活动策划的基本流程，练习从目标、计划、执行、总结四个环节展开",
    }

    weakness = {
        "dimension": weakest_dim,
        "dimension_score": round(dim_scores[weakest_dim], 1),
        "category": weakest_category,
        "category_score": category_avg.get(weakest_category, 0),
        "suggestion": weakness_suggestions.get(weakest_dim, "继续练习，全面提升"),
    }

    # 练习统计
    all_scores = [p.get("score_overall") or 0 for p in scored]
    avg_score = round(sum(all_scores) / len(all_scores), 1)
    best_score = round(max(all_scores), 1)
    week_ago = datetime.utcnow() - timedelta(days=7)
    this_week_count = sum(1 for p in scored if p["created_at"].replace(tzinfo=None) >= week_ago)

    # 连续练习天数
    practice_dates = sorted(set(p["created_at"].date() for p in scored), reverse=True)
    streak_days = 0
    if practice_dates:
        today = datetime.utcnow().date()
        for i, d in enumerate(practice_dates):
            if (today - d).days == i:
                streak_days += 1
            else:
                break

    category_stats = {
        cat: {
            "count": len(s),
            "avg_score": round(sum(s) / len(s), 1),
            "best_score": round(max(s), 1),
        }
        for cat, s in category_scores.items()
    }

    return {
        "total_practiced": total_practiced,
        "radar": radar,
        "trend": trend,
        "weakness": weakness,
        "stats": {
            "avg_score": avg_score,
            "best_score": best_score,
            "this_week_count": this_week_count,
            "streak_days": streak_days,
        },
        "category_stats": category_stats,
    }


@app.get("/api/stats/recommend")
async def get_recommendation(request: Request):
    """推荐题目（根据薄弱项推荐练习方向）"""
    user = await get_current_user(request)
    scored = [
        p for p in PRACTICES.values()
        if p["user_id"] == user["id"] and p.get("score_overall") is not None
    ]
    scored.sort(key=lambda x: x["created_at"], reverse=True)
    recent = scored[:20]

    if len(recent) < 3:
        return {
            "ready": False,
            "message": "完成至少3次练习后即可获得个性化推荐",
            "recommendations": [],
        }

    cat_scores: dict = {}
    for p in recent:
        cat = p.get("question", {}).get("category", "") if isinstance(p.get("question"), dict) else ""
        if cat not in cat_scores:
            cat_scores[cat] = []
        cat_scores[cat].append(p.get("score_overall") or 0)

    cat_avg = {cat: sum(s) / len(s) for cat, s in cat_scores.items()}
    weakest_cat = min(cat_avg, key=cat_avg.get) if cat_avg else "综合分析"

    recommendations = [
        {
            "type": "category",
            "category": weakest_cat,
            "reason": f"你的「{weakest_cat}」题型平均分仅{cat_avg[weakest_cat]:.1f}分，建议重点突破",
            "difficulty": 3,
        }
    ]

    all_cats = ["综合分析", "人际沟通", "应急应变", "组织管理", "自我认知"]
    for cat in all_cats:
        if cat not in cat_scores or len(cat_scores[cat]) < 2:
            recommendations.append({
                "type": "coverage",
                "category": cat,
                "reason": f"「{cat}」题型练习不足，建议补充练习",
                "difficulty": 2,
            })

    # 去重
    seen = set()
    final = []
    for rec in recommendations:
        if rec["category"] not in seen:
            seen.add(rec["category"])
            final.append(rec)

    return {
        "ready": True,
        "weakest_category": weakest_cat,
        "recommendations": final[:3],
    }


@app.get("/api/stats/badges")
async def get_badges(request: Request):
    """徽章列表"""
    user = await get_current_user(request)
    BADGE_DEFINITIONS = [
        {"code": "streak_7", "name": "SYNAPSE", "icon": "⟁", "description": "连续打卡7天", "type": "streak", "condition_value": 7, "tier": "synapse", "color": "#6b7280"},
        {"code": "streak_30", "name": "QUANTUM", "icon": "◈", "description": "连续打卡30天", "type": "streak", "condition_value": 30, "tier": "quantum", "color": "#22d3ee"},
        {"code": "score_80", "name": "THRESHOLD", "icon": "△", "description": "单题80分", "type": "score", "condition_value": 80, "tier": "threshold", "color": "#34d399"},
        {"code": "score_90", "name": "DEEPSPACE", "icon": "◇", "description": "单题90分", "type": "score", "condition_value": 90, "tier": "deepspace", "color": "#60a5fa"},
        {"code": "practice_10", "name": "BOOT", "icon": "⊳", "description": "累计10题", "type": "total", "condition_value": 10, "tier": "boot", "color": "#6b7280"},
        {"code": "practice_50", "name": "CORE", "icon": "◉", "description": "累计50题", "type": "total", "condition_value": 50, "tier": "core", "color": "#22d3ee"},
        {"code": "practice_100", "name": "NEURAL", "icon": "◈", "description": "累计100题", "type": "total", "condition_value": 100, "tier": "neural", "color": "#818cf8"},
    ]

    streak = user.get("streak_days", 0)
    total = user.get("total_practice_count", 0)
    avg = user.get("avg_score", 0)

    earned = []
    next_badges = []
    for bdef in BADGE_DEFINITIONS:
        val = streak if bdef["type"] == "streak" else total if bdef["type"] == "total" else avg
        if val >= bdef["condition_value"]:
            earned.append({**bdef, "earned_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M")})
        else:
            next_badges.append({**bdef, "progress": val, "target": bdef["condition_value"]})

    return {
        "earned": earned,
        "next": next_badges[:5],
        "summary": {
            "total_earned": len(earned),
            "streak_days": streak,
            "total_practices": total,
            "avg_score": avg,
        },
    }


@app.get("/api/stats/checkin-history")
async def get_checkin_history(request: Request, limit: int = Query(30)):
    """打卡历史"""
    user = await get_current_user(request)
    records = [
        {"id": r["id"], "date": r["checkin_date"], "category": r.get("category"), "score": r.get("score")}
        for r in CHECKIN_RECORDS
        if r["user_id"] == user["id"]
    ]
    records.sort(key=lambda x: x["date"], reverse=True)
    return {"records": records[:limit]}


@app.get("/api/stats/checkin-status")
async def get_checkin_status(request: Request):
    """打卡状态"""
    user = await get_current_user(request)
    today = date.today()
    checked_today = user.get("last_checkin_date") == today
    return {
        "checked_today": checked_today,
        "streak_days": user.get("streak_days", 0),
        "max_streak_days": user.get("max_streak_days", 0),
        "total_checkin_days": user.get("total_checkin_days", 0),
    }


@app.post("/api/stats/checkin-record")
async def create_checkin_record(request: Request):
    """记录打卡"""
    user = await get_current_user(request)
    today = date.today()

    # 检查今日是否已打卡
    for r in CHECKIN_RECORDS:
        if r["user_id"] == user["id"] and r["checkin_date"] == today:
            return {"ok": False, "message": "今日已打卡", "record_id": r["id"]}

    body = {}
    try:
        body = await request.json()
    except Exception:
        pass

    record_id = str(uuid.uuid4())
    record = {
        "id": record_id,
        "user_id": user["id"],
        "checkin_date": today,
        "category": body.get("category"),
        "score": body.get("score"),
    }
    CHECKIN_RECORDS.append(record)

    # 更新用户打卡状态
    user["last_checkin_date"] = today
    user["total_checkin_days"] = user.get("total_checkin_days", 0) + 1

    yesterday = today - timedelta(days=1)
    checked_yesterday = any(
        r["user_id"] == user["id"] and r["checkin_date"] == yesterday
        for r in CHECKIN_RECORDS
    )
    if checked_yesterday:
        user["streak_days"] = user.get("streak_days", 0) + 1
    else:
        user["streak_days"] = 1

    if user["streak_days"] > user.get("max_streak_days", 0):
        user["max_streak_days"] = user["streak_days"]

    return {
        "ok": True,
        "record_id": record_id,
        "streak_days": user["streak_days"],
        "new_badges": [],
        "message": f"打卡成功！已连续 {user['streak_days']} 天",
    }


@app.get("/api/stats/excellent-answer/{practice_id}")
async def get_excellent_answer(practice_id: str, request: Request):
    """优秀答案（调用 AI 生成，无 Key 时返回 mock）"""
    user = await get_current_user(request)
    practice = PRACTICES.get(practice_id)
    if practice is None or practice["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="练习记录不存在")

    question = practice.get("question", {})
    question_content = question.get("content", "") if isinstance(question, dict) else ""
    user_answer = practice.get("answer_text") or "（用户未作答）"

    if ZHIPU_API_KEY:
        prompt = f"""你是面试教练。针对这道面试题，给出一份优秀参考答案，再跟用户的回答对比。

【题目】
{question_content}

【用户的回答】
{user_answer}

严格按JSON返回：
{{
    "excellent_answer": "优秀参考答案（800字左右）",
    "answer_framework": ["要点1", "要点2", "要点3", "要点4"],
    "comparison": {{
        "strengths": ["亮点1", "亮点2"],
        "gaps": ["硬伤1", "硬伤2"],
        "improvement": "怎么改，具体说"
    }},
    "key_phrases": ["金句1", "金句2"]
}}"""
        try:
            response_text = await call_zhipu(prompt, max_tokens=2000, temperature=0.6)
            if response_text:
                parsed = _extract_json(response_text)
                if parsed and isinstance(parsed, dict):
                    return parsed
        except Exception as e:
            print(f"[优秀答案] AI调用失败: {e}")

    # Mock 兜底
    return {
        "excellent_answer": "（AI服务暂未配置，这是演示模式的优秀答案参考。建议在 Vercel 环境变量中配置 ZHIPU_API_KEY 以启用完整功能。）",
        "answer_framework": ["明确观点", "分析原因", "提出对策", "总结升华"],
        "comparison": {
            "strengths": ["回答基本切题"],
            "gaps": ["结构不够清晰", "缺少具体案例", "深度有待提升"],
            "improvement": "建议用分点式结构，加入具体案例和政策支撑",
        },
        "key_phrases": ["服务群众", "实事求是", "创新发展"],
    }


@app.get("/api/stats/heatmap")
async def get_heatmap(request: Request, days: int = Query(90, ge=7, le=365)):
    """热力图数据"""
    user = await get_current_user(request)
    today = date.today()
    start_date = today - timedelta(days=days - 1)

    # 按天统计练习数
    day_map: dict = {}
    for p in PRACTICES.values():
        if p["user_id"] == user["id"] and p["created_at"].date() >= start_date:
            key = p["created_at"].strftime("%Y-%m-%d")
            if key not in day_map:
                day_map[key] = {"count": 0, "scores": []}
            day_map[key]["count"] += 1
            if p.get("score_overall"):
                day_map[key]["scores"].append(p["score_overall"])

    heatmap_data = []
    current = start_date
    while current <= today:
        key = current.strftime("%Y-%m-%d")
        info = day_map.get(key, {"count": 0, "scores": []})
        avg_score = round(sum(info["scores"]) / len(info["scores"]), 1) if info["scores"] else 0
        heatmap_data.append({
            "date": key,
            "count": info["count"],
            "avg_score": avg_score,
            "level": min(int(info["count"] / max(1, days / 30)), 4),
        })
        current += timedelta(days=1)

    total_active_days = sum(1 for d in heatmap_data if d["count"] > 0)
    total_practices = sum(d["count"] for d in heatmap_data)
    avg_daily = round(total_practices / max(total_active_days, 1), 1) if total_active_days > 0 else 0

    return {
        "days": days,
        "total_active_days": total_active_days,
        "total_practices": total_practices,
        "avg_daily_practices": avg_daily,
        "max_streak_days": user.get("max_streak_days", 0),
        "heatmap": heatmap_data,
    }


@app.get("/api/stats/rank")
async def get_rank(request: Request):
    """排名（段位系统）"""
    user = await get_current_user(request)
    total_practiced = user.get("total_practice_count", 0)
    avg_score = user.get("avg_score", 0)

    CHALLENGE_LEVELS = [
        {"level": "STAGE-01", "min_score": 0, "max_score": 60, "label": "新手", "color": "#ef4444"},
        {"level": "STAGE-02", "min_score": 60, "max_score": 70, "label": "入门", "color": "#f97316"},
        {"level": "STAGE-03", "min_score": 70, "max_score": 80, "label": "熟练", "color": "#eab308"},
        {"level": "STAGE-04", "min_score": 80, "max_score": 90, "label": "精通", "color": "#22c55e"},
        {"level": "STAGE-05", "min_score": 90, "max_score": 101, "label": "大师", "color": "#3b82f6"},
    ]

    # 段位分：历史均分40% + 练习量30% + 30（基础分）
    rank_score = round(avg_score * 0.4 + min(total_practiced / 5, 100) * 0.3 + 30, 1)

    level = CHALLENGE_LEVELS[-1]
    for lv in CHALLENGE_LEVELS:
        if lv["min_score"] <= rank_score < lv["max_score"]:
            level = lv
            break

    next_idx = CHALLENGE_LEVELS.index(level) + 1
    if next_idx < len(CHALLENGE_LEVELS):
        next_level = CHALLENGE_LEVELS[next_idx]
        progress = (rank_score - level["min_score"]) / (next_level["min_score"] - level["min_score"]) * 100
    else:
        next_level = None
        progress = 100

    return {
        "rank_score": rank_score,
        "level": level,
        "next_level": next_level,
        "progress_percent": round(min(max(progress, 0), 100), 1),
        "total_practiced": total_practiced,
        "avg_score": avg_score,
        "streak_days": user.get("streak_days", 0),
        "max_streak_days": user.get("max_streak_days", 0),
    }


@app.get("/api/stats/weakness-detail")
async def get_weakness_detail(request: Request):
    """薄弱点详情（低分题目列表）"""
    user = await get_current_user(request)
    scored = [
        p for p in PRACTICES.values()
        if p["user_id"] == user["id"] and p.get("score_overall") is not None
    ]
    scored.sort(key=lambda x: x.get("score_overall") or 0)

    if not scored:
        return {
            "ready": False,
            "message": "完成练习后即可查看薄弱项",
            "low_scores": [],
            "weakness": {},
            "category_stats": {},
        }

    low_scores = []
    for p in scored[:8]:
        question = p.get("question", {}) if isinstance(p.get("question"), dict) else {}
        low_scores.append({
            "practice_id": p["id"],
            "question_id": p.get("question_id", ""),
            "question_content": question.get("content", ""),
            "question_category": question.get("category", ""),
            "score_overall": round(p.get("score_overall") or 0, 0),
            "score_analysis": round(p.get("score_analysis") or 0, 0),
            "score_expression": round(p.get("score_expression") or 0, 0),
            "score_adaptability": round(p.get("score_adaptability") or 0, 0),
            "score_organization": round(p.get("score_organization") or 0, 0),
            "created_at": p["created_at"].strftime("%m-%d %H:%M"),
            "report_content": p.get("report_content") or "",
            "deduction_points": p.get("deduction_points") or "",
            "optimization_suggestions": p.get("optimization_suggestions") or "",
        })

    avg_analysis = sum(p.get("score_analysis") or 0 for p in scored) / len(scored)
    avg_expression = sum(p.get("score_expression") or 0 for p in scored) / len(scored)
    avg_adaptability = sum(p.get("score_adaptability") or 0 for p in scored) / len(scored)
    avg_organization = sum(p.get("score_organization") or 0 for p in scored) / len(scored)

    dim_scores = {
        "综合分析能力": avg_analysis,
        "言语表达能力": avg_expression,
        "应变能力": avg_adaptability,
        "计划组织能力": avg_organization,
    }
    weakest_dim = min(dim_scores, key=dim_scores.get)

    cat_scores: dict = {}
    for p in scored:
        question = p.get("question", {}) if isinstance(p.get("question"), dict) else {}
        cat = question.get("category", "")
        if cat not in cat_scores:
            cat_scores[cat] = []
        cat_scores[cat].append(p.get("score_overall") or 0)
    category_avg = {cat: round(sum(s) / len(s), 1) for cat, s in cat_scores.items()}
    weakest_category = min(category_avg, key=category_avg.get) if category_avg else ""

    weakness_suggestions = {
        "综合分析能力": "多关注时事热点，练习从多角度分析问题，注重逻辑框架",
        "言语表达能力": "练习口头表达，注意准确性和条理性，多用连接词",
        "应变能力": "模拟突发场景，培养冷静心态，学会分轻重缓急",
        "计划组织能力": "学习活动策划流程，从目标、计划、执行、总结展开",
    }

    category_stats = {
        cat: {"count": len(s), "avg_score": round(sum(s) / len(s), 1), "best_score": round(max(s), 1)}
        for cat, s in cat_scores.items()
    }

    return {
        "ready": True,
        "low_scores": low_scores,
        "weakness": {
            "dimension": weakest_dim,
            "dimension_score": round(dim_scores[weakest_dim], 1),
            "category": weakest_category,
            "category_score": category_avg.get(weakest_category, 0),
            "suggestion": weakness_suggestions.get(weakest_dim, "继续练习，全面提升"),
        },
        "category_stats": category_stats,
    }


# ==================== 上传路由 ====================

@app.post("/api/upload/audio")
async def upload_audio(request: Request):
    """上传音频（Vercel 无持久文件系统，返回 mock URL）"""
    file_name = f"{uuid.uuid4()}.wav"
    return {"url": f"/uploads/audio/demo/{file_name}", "file_name": file_name}


# ==================== 用户路由 ====================

@app.get("/api/user/info")
async def get_user_info(request: Request):
    """用户信息"""
    user = await get_current_user(request)
    return _user_response(user)


# ==================== 健康检查 ====================

@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {
        "status": "ok",
        "version": "0.1.0",
        "environment": "vercel-serverless",
        "zhipu_configured": bool(ZHIPU_API_KEY),
        "questions_count": len(QUESTIONS),
    }
