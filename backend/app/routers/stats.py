"""统计分析路由 - 能力雷达图、进步趋势、薄弱项分析、智能推荐"""

from datetime import datetime, timedelta, date

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import (
    User, Question, PracticeRecord,
    Badge, UserBadge, FavoriteQuestion, CheckinRecord,
)
from app.utils.auth import get_current_user

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    仪表盘数据：能力雷达图 + 进步趋势 + 薄弱项 + 练习统计
    """
    uid = current_user.id

    # ========== 1. 获取所有已评分的练习记录 ==========
    stmt = (
        select(PracticeRecord, Question.category)
        .join(Question, PracticeRecord.question_id == Question.id)
        .where(
            PracticeRecord.user_id == uid,
            PracticeRecord.score_overall.isnot(None),
        )
        .order_by(PracticeRecord.created_at)
    )
    result = await db.execute(stmt)
    rows = result.all()

    total_practiced = len(rows)

    if total_practiced == 0:
        return {
            "total_practiced": 0,
            "radar": {"analysis": 0, "expression": 0, "adaptability": 0, "organization": 0},
            "trend": [],
            "weakness": {"category": "", "dimension": "", "score": 0, "suggestion": "完成首次练习后即可获得分析"},
            "stats": {"avg_score": 0, "best_score": 0, "this_week_count": 0, "streak_days": 0},
            "category_stats": {},
        }

    # ========== 2. 能力雷达图（四维平均分） ==========
    avg_analysis = sum(r[0].score_analysis or 0 for r in rows) / total_practiced
    avg_expression = sum(r[0].score_expression or 0 for r in rows) / total_practiced
    avg_adaptability = sum(r[0].score_adaptability or 0 for r in rows) / total_practiced
    avg_organization = sum(r[0].score_organization or 0 for r in rows) / total_practiced

    radar = {
        "analysis": round(avg_analysis, 1),
        "expression": round(avg_expression, 1),
        "adaptability": round(avg_adaptability, 1),
        "organization": round(avg_organization, 1),
    }

    # ========== 3. 进步趋势（按时间排序，每次练习的总分） ==========
    trend = []
    for r in rows:
        trend.append({
            "date": r[0].created_at.strftime("%m-%d %H:%M"),
            "score": round(r[0].score_overall or 0, 1),
            "category": r[1],
        })

    # 最多返回最近30条
    trend = trend[-30:]

    # ========== 4. 薄弱项分析 ==========
    # 4a. 找出四维中最低的维度
    dim_scores = {
        "综合分析能力": avg_analysis,
        "言语表达能力": avg_expression,
        "应变能力": avg_adaptability,
        "计划组织能力": avg_organization,
    }
    weakest_dim = min(dim_scores, key=dim_scores.get)
    weakest_dim_score = dim_scores[weakest_dim]

    # 4b. 按题型分类统计平均分
    category_scores: dict[str, list[float]] = {}
    for r in rows:
        cat = r[1]
        if cat not in category_scores:
            category_scores[cat] = []
        category_scores[cat].append(r[0].score_overall or 0)

    category_avg = {cat: round(sum(s) / len(s), 1) for cat, s in category_scores.items()}
    weakest_category = min(category_avg, key=category_avg.get) if category_avg else ""

    # 薄弱项建议
    weakness_suggestions = {
        "综合分析能力": "建议多关注时事热点，练习从多角度分析问题，注重逻辑框架的搭建",
        "言语表达能力": "建议练习口头表达，注意语言的准确性和条理性，多使用连接词",
        "应变能力": "建议模拟突发场景练习，培养冷静应对的心态，学会分轻重缓急处理问题",
        "计划组织能力": "建议学习活动策划的基本流程，练习从目标、计划、执行、总结四个环节展开",
    }

    weakness = {
        "dimension": weakest_dim,
        "dimension_score": round(weakest_dim_score, 1),
        "category": weakest_category,
        "category_score": category_avg.get(weakest_category, 0),
        "suggestion": weakness_suggestions.get(weakest_dim, "继续练习，全面提升"),
    }

    # ========== 5. 练习统计 ==========
    all_scores = [r[0].score_overall or 0 for r in rows]
    avg_score = round(sum(all_scores) / len(all_scores), 1)
    best_score = round(max(all_scores), 1)

    # 本周练习次数
    week_ago = datetime.utcnow() - timedelta(days=7)
    this_week_count = sum(1 for r in rows if r[0].created_at.replace(tzinfo=None) >= week_ago)

    # 连续练习天数
    practice_dates = sorted(set(r[0].created_at.date() for r in rows), reverse=True)
    streak_days = 0
    if practice_dates:
        today = datetime.utcnow().date()
        for i, d in enumerate(practice_dates):
            if (today - d).days == i:
                streak_days += 1
            else:
                break

    # ========== 6. 题型分类统计 ==========
    category_stats = {}
    for cat, scores in category_scores.items():
        category_stats[cat] = {
            "count": len(scores),
            "avg_score": round(sum(scores) / len(scores), 1),
            "best_score": round(max(scores), 1),
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


@router.get("/weakness-detail")
async def get_weakness_detail(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    薄弱项详细：低分题目列表 + 可重练
    """
    uid = current_user.id

    # 取最近30条已评分记录，按总分从低到高排
    stmt = (
        select(PracticeRecord, Question)
        .join(Question, PracticeRecord.question_id == Question.id)
        .where(
            PracticeRecord.user_id == uid,
            PracticeRecord.score_overall.isnot(None),
        )
        .order_by(PracticeRecord.score_overall.asc())
        .limit(30)
    )
    result = await db.execute(stmt)
    rows = result.all()

    if not rows:
        return {
            "ready": False,
            "message": "完成练习后即可查看薄弱项",
            "low_scores": [],
            "weakness": {},
            "category_stats": {},
        }

    # 取最低的8条作为"翻车题"
    low_scores = []
    for pr, q in rows[:8]:
        low_scores.append({
            "practice_id": str(pr.id),
            "question_id": str(q.id),
            "question_content": q.content,
            "question_category": q.category,
            "score_overall": round(pr.score_overall or 0, 0),
            "score_analysis": round(pr.score_analysis or 0, 0),
            "score_expression": round(pr.score_expression or 0, 0),
            "score_adaptability": round(pr.score_adaptability or 0, 0),
            "score_organization": round(pr.score_organization or 0, 0),
            "created_at": pr.created_at.strftime("%m-%d %H:%M"),
            "report_content": pr.report_content or "",
            "deduction_points": pr.deduction_points or "",
            "optimization_suggestions": pr.optimization_suggestions or "",
        })

    # 重新计算薄弱项（和 dashboard 一致）
    all_scores = [r[0].score_overall or 0 for r in rows]
    avg_analysis = sum(r[0].score_analysis or 0 for r in rows) / len(rows)
    avg_expression = sum(r[0].score_expression or 0 for r in rows) / len(rows)
    avg_adaptability = sum(r[0].score_adaptability or 0 for r in rows) / len(rows)
    avg_organization = sum(r[0].score_organization or 0 for r in rows) / len(rows)

    dim_scores = {
        "综合分析能力": avg_analysis,
        "言语表达能力": avg_expression,
        "应变能力": avg_adaptability,
        "计划组织能力": avg_organization,
    }
    weakest_dim = min(dim_scores, key=dim_scores.get)

    category_scores: dict[str, list[float]] = {}
    for pr, q in rows:
        cat = q.category
        if cat not in category_scores:
            category_scores[cat] = []
        category_scores[cat].append(pr.score_overall or 0)
    category_avg = {cat: round(sum(s) / len(s), 1) for cat, s in category_scores.items()}
    weakest_category = min(category_avg, key=category_avg.get) if category_avg else ""

    weakness_suggestions = {
        "综合分析能力": "多关注时事热点，练习从多角度分析问题，注重逻辑框架",
        "言语表达能力": "练习口头表达，注意准确性和条理性，多用连接词",
        "应变能力": "模拟突发场景，培养冷静心态，学会分轻重缓急",
        "计划组织能力": "学习活动策划流程，从目标、计划、执行、总结展开",
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
        "category_stats": {cat: {"count": len(s), "avg_score": round(sum(s) / len(s), 1), "best_score": round(max(s), 1)} for cat, s in category_scores.items()},
    }


@router.get("/recommend")
async def get_recommendation(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    智能推荐：根据薄弱项推荐练习方向
    """
    uid = current_user.id

    # 获取最近20条已评分记录
    stmt = (
        select(PracticeRecord, Question.category)
        .join(Question, PracticeRecord.question_id == Question.id)
        .where(
            PracticeRecord.user_id == uid,
            PracticeRecord.score_overall.isnot(None),
        )
        .order_by(PracticeRecord.created_at.desc())
        .limit(20)
    )
    result = await db.execute(stmt)
    rows = result.all()

    if len(rows) < 3:
        return {
            "ready": False,
            "message": "完成至少3次练习后即可获得个性化推荐",
            "recommendations": [],
        }

    # 分析各题型平均分
    cat_scores: dict[str, list[float]] = {}
    dim_scores: dict[str, list[float]] = {
        "analysis": [], "expression": [], "adaptability": [], "organization": []
    }

    for r in rows:
        cat = r[1]
        if cat not in cat_scores:
            cat_scores[cat] = []
        cat_scores[cat].append(r[0].score_overall or 0)

        if r[0].score_analysis:
            dim_scores["analysis"].append(r[0].score_analysis)
        if r[0].score_expression:
            dim_scores["expression"].append(r[0].score_expression)
        if r[0].score_adaptability:
            dim_scores["adaptability"].append(r[0].score_adaptability)
        if r[0].score_organization:
            dim_scores["organization"].append(r[0].score_organization)

    # 找出最弱的题型
    cat_avg = {cat: sum(s) / len(s) for cat, s in cat_scores.items()}
    weakest_cat = min(cat_avg, key=cat_avg.get)

    # 找出最弱的维度
    dim_avg = {d: sum(s) / len(s) for d, s in dim_scores.items() if s}
    weakest_dim = min(dim_avg, key=dim_avg.get) if dim_avg else ""

    dim_names = {
        "analysis": "综合分析能力",
        "expression": "言语表达能力",
        "adaptability": "应变能力",
        "organization": "计划组织能力",
    }

    # 生成推荐
    recommendations = []

    # 推荐弱项题型
    recommendations.append({
        "type": "category",
        "category": weakest_cat,
        "reason": f"你的「{weakest_cat}」题型平均分仅{cat_avg[weakest_cat]:.1f}分，建议重点突破",
        "difficulty": 3,
    })

    # 推荐弱项维度对应的题型
    dim_to_category = {
        "analysis": "综合分析",
        "expression": "人际沟通",
        "adaptability": "应急应变",
        "organization": "组织管理",
    }
    if weakest_dim in dim_to_category:
        rec_cat = dim_to_category[weakest_dim]
        if rec_cat != weakest_cat:
            recommendations.append({
                "type": "dimension",
                "category": rec_cat,
                "reason": f"你的「{dim_names[weakest_dim]}」维度偏弱({dim_avg[weakest_dim]:.1f}分)，建议通过{rec_cat}题型加强",
                "difficulty": 3,
            })

    # 如果某题型练习不足，推荐多练
    all_cats = ["综合分析", "人际沟通", "应急应变", "组织管理", "自我认知"]
    for cat in all_cats:
        if cat not in cat_scores or len(cat_scores[cat]) < 2:
            recommendations.append({
                "type": "coverage",
                "category": cat,
                "reason": f"「{cat}」题型练习不足，建议补充练习",
                "difficulty": 2,
            })

    # 去重（同类别只保留优先级最高的）
    seen_cats = set()
    final_recs = []
    for rec in recommendations:
        if rec["category"] not in seen_cats:
            seen_cats.add(rec["category"])
            final_recs.append(rec)

    return {
        "ready": True,
        "weakest_category": weakest_cat,
        "weakest_dimension": dim_names.get(weakest_dim, ""),
        "recommendations": final_recs[:3],
    }


@router.get("/excellent-answer/{practice_id}")
async def get_excellent_answer(
    practice_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    AI生成优秀参考答案（满分答案对照）
    """
    import json
    import re

    # 获取练习记录
    stmt = select(PracticeRecord).where(
        PracticeRecord.id == practice_id,
        PracticeRecord.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    practice = result.scalar_one_or_none()

    if practice is None:
        raise HTTPException(status_code=404, detail="练习记录不存在")

    # 获取题目
    q_stmt = select(Question).where(Question.id == practice.question_id)
    q_result = await db.execute(q_stmt)
    question = q_result.scalar_one_or_none()

    if question is None:
        raise HTTPException(status_code=404, detail="题目不存在")

    user_answer = practice.answer_text or "（用户未作答）"

    # 调用AI生成优秀答案
    from app.config import settings

    prompt = f"""你是VERINX，犀利直接的面试教练。针对这道面试题，给你一份优秀参考答案，再跟用户的回答对比一下。

【题目】
{question.content}

【类型】{question.category}

【用户的回答】
{user_answer}

严格按JSON返回：
{{
    "excellent_answer": "优秀参考答案（800字左右，结构清晰，要点突出）",
    "answer_framework": ["要点1", "要点2", "要点3", "要点4"],
    "comparison": {{
        "strengths": ["亮点1", "亮点2"],
        "gaps": ["硬伤1", "硬伤2", "硬伤3"],
        "improvement": "怎么改，具体说"
    }},
    "key_phrases": ["金句1", "金句2", "金句3"]
}}"""

    async def call_zhipu():
        import time
        import jwt as jwt_lib
        import httpx

        api_key = settings.ZHIPU_API_KEY
        kid, secret = api_key.split(".")
        payload = {
            "api_key": kid,
            "exp": int(time.time()) + 3600,
            "timestamp": int(time.time()),
        }
        token = jwt_lib.encode(
            payload, secret, algorithm="HS256",
            headers={"alg": "HS256", "sign_type": "SIGN"}
        )

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://open.bigmodel.cn/api/paas/v4/chat/completions",
                json={
                    "model": "glm-4-flash",
                    "messages": [
                        {"role": "system", "content": "你是资深公考面试考官和培训专家，擅长生成高质量参考答案。"},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.6,
                },
                headers={"Authorization": f"Bearer {token}"},
                timeout=90.0,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    async def call_doubao():
        import httpx

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                settings.DOUBAO_API_URL,
                json={
                    "model": settings.LLM_MODEL or "doubao-pro",
                    "messages": [
                        {"role": "system", "content": "你是资深公考面试考官和培训专家。"},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.6,
                },
                headers={"Authorization": f"Bearer {settings.DOUBAO_API_KEY}"},
                timeout=90.0,
            )
            resp.raise_for_status()
            data = resp.json()
            if "choices" in data:
                return data["choices"][0]["message"]["content"]
            return str(data)

    response_text = ""

    if settings.ZHIPU_API_KEY:
        try:
            response_text = await call_zhipu()
        except Exception as e:
            print(f"[优秀答案] 智谱调用失败: {e}")

    if not response_text and settings.DOUBAO_API_KEY:
        try:
            response_text = await call_doubao()
        except Exception as e:
            print(f"[优秀答案] 豆包调用失败: {e}")

    if not response_text:
        return {
            "excellent_answer": "（AI服务暂时不可用，请稍后重试）",
            "answer_framework": [],
            "comparison": {
                "strengths": [],
                "gaps": [],
                "improvement": "请稍后重试获取对比分析",
            },
            "key_phrases": [],
        }

    # 解析JSON
    def _extract_json(text: str):
        text = text.strip()
        m = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
        if m:
            text = m.group(1).strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
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

    parsed = _extract_json(response_text)

    if parsed and isinstance(parsed, dict):
        return parsed

    # 解析失败，返回原始文本
    return {
        "excellent_answer": response_text,
        "answer_framework": [],
        "comparison": {
            "strengths": [],
            "gaps": [],
            "improvement": "",
        },
        "key_phrases": [],
    }


# ==================== 打卡 & 连胜 ====================

@router.post("/checkin")
async def daily_checkin(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    last = current_user.last_checkin_date

    if last == today:
        return {
            "checked": True,
            "streak_days": current_user.streak_days,
            "max_streak_days": current_user.max_streak_days,
            "total_checkin_days": current_user.total_checkin_days,
            "message": "今天已经打过卡了，继续保持！",
        }

    if last == today - timedelta(days=1):
        current_user.streak_days = (current_user.streak_days or 0) + 1
    else:
        current_user.streak_days = 1

    current_user.last_checkin_date = today
    current_user.total_checkin_days = (current_user.total_checkin_days or 0) + 1
    if current_user.streak_days > (current_user.max_streak_days or 0):
        current_user.max_streak_days = current_user.streak_days

    await db.commit()
    return {
        "checked": True,
        "streak_days": current_user.streak_days,
        "max_streak_days": current_user.max_streak_days,
        "total_checkin_days": current_user.total_checkin_days,
        "message": f"打卡成功！已连续 {current_user.streak_days} 天",
    }


@router.get("/checkin-status")
async def get_checkin_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    last = current_user.last_checkin_date
    return {
        "checked_today": last == today,
        "streak_days": current_user.streak_days or 0,
        "max_streak_days": current_user.max_streak_days or 0,
        "total_checkin_days": current_user.total_checkin_days or 0,
    }


# ==================== 每日挑战 ====================

CHALLENGE_CATEGORIES = ["综合分析", "人际沟通", "应急应变", "组织管理", "自我认知"]

CHALLENGE_LEVELS = [
    {"level": "STAGE-01", "min_score": 0, "max_score": 60, "label": "新手", "color": "#ef4444"},
    {"level": "STAGE-02", "min_score": 60, "max_score": 70, "label": "入门", "color": "#f97316"},
    {"level": "STAGE-03", "min_score": 70, "max_score": 80, "label": "熟练", "color": "#eab308"},
    {"level": "STAGE-04", "min_score": 80, "max_score": 90, "label": "精通", "color": "#22c55e"},
    {"level": "STAGE-05", "min_score": 90, "max_score": 100, "label": "大师", "color": "#3b82f6"},
]


def _get_rank_level(score: float) -> dict:
    for lv in CHALLENGE_LEVELS:
        if lv["min_score"] <= score < lv["max_score"]:
            return lv
    return CHALLENGE_LEVELS[-1]


@router.get("/daily-challenge")
async def get_daily_challenge(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import random

    uid = current_user.id
    today = date.today()
    last = current_user.last_practice_date
    is_premium = current_user.member_type == "premium"

    # 获取薄弱项，针对性出题
    stmt = (
        select(PracticeRecord, Question.category)
        .join(Question, PracticeRecord.question_id == Question.id)
        .where(
            PracticeRecord.user_id == uid,
            PracticeRecord.score_overall.isnot(None),
        )
        .order_by(PracticeRecord.score_overall.asc())
        .limit(20)
    )
    result = await db.execute(stmt)
    rows = result.all()

    if rows:
        cat_scores: dict[str, list[float]] = {}
        for r in rows:
            cat = r[1]
            if cat not in cat_scores:
                cat_scores[cat] = []
            cat_scores[cat].append(r[0].score_overall or 0)
        cat_avgs = {c: sum(s) / len(s) for c, s in cat_scores.items()}
        target_category = min(cat_avgs, key=cat_avgs.get)
    else:
        target_category = random.choice(CHALLENGE_CATEGORIES)

    # 随机选一道该类别的题目
    q_stmt = (
        select(Question)
        .where(Question.category == target_category)
        .order_by(func.random())
        .limit(1)
    )
    q_result = await db.execute(q_stmt)
    question = q_result.scalar_one_or_none()

    completed = False
    today_count = 0
    if last == today:
        count_stmt = (
            select(func.count(PracticeRecord.id))
            .where(
                PracticeRecord.user_id == uid,
                PracticeRecord.score_overall.isnot(None),
                PracticeRecord.created_at >= datetime(today.year, today.month, today.day),
            )
        )
        count_res = await db.execute(count_stmt)
        today_count = count_res.scalar() or 0
        completed = today_count > 0

    challenge_level = _get_rank_level(current_user.avg_score or 0)

    return {
        "target_category": target_category,
        "challenge_name": f"今日挑战 · {target_category}",
        "question": {
            "id": str(question.id) if question else None,
            "content": question.content if question else None,
            "category": target_category,
            "difficulty": question.difficulty if question else 3,
        } if question else None,
        "completed_today": completed,
        "user_level": challenge_level,
        "streak_days": current_user.streak_days or 0,
        "today_practice_count": today_count,
        "daily_limit": None if is_premium else 3,
        "is_premium": is_premium,
    }


# ==================== 热力图 ====================

@router.get("/heatmap")
async def get_heatmap(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    days: int = Query(90, ge=7, le=365),
):
    uid = current_user.id
    today = date.today()
    start_date = today - timedelta(days=days - 1)

    stmt = (
        select(
            func.date_trunc("day", PracticeRecord.created_at).label("day"),
            func.count(PracticeRecord.id).label("count"),
            func.avg(PracticeRecord.score_overall).label("avg_score"),
        )
        .where(
            PracticeRecord.user_id == uid,
            PracticeRecord.created_at >= datetime(start_date.year, start_date.month, start_date.day),
        )
        .group_by("day")
    )
    result = await db.execute(stmt)
    rows = result.all()

    day_map: dict[str, dict] = {}
    for r in rows:
        day_key = r.day.strftime("%Y-%m-%d") if r.day else ""
        day_map[day_key] = {
            "count": r.count,
            "avg_score": round(r.avg_score, 1) if r.avg_score else 0,
        }

    heatmap_data = []
    current = start_date
    while current <= today:
        key = current.strftime("%Y-%m-%d")
        info = day_map.get(key, {"count": 0, "avg_score": 0})
        heatmap_data.append({
            "date": key,
            "count": info["count"],
            "avg_score": info["avg_score"],
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
        "max_streak_days": current_user.max_streak_days or 0,
        "heatmap": heatmap_data,
    }


# ==================== 段位系统 ====================

@router.get("/rank")
async def get_rank(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    uid = current_user.id
    total_practiced = current_user.total_practice_count or 0
    avg_score = current_user.avg_score or 0

    # 获取最近30天的练习记录
    month_ago = datetime.utcnow() - timedelta(days=30)
    stmt = (
        select(PracticeRecord)
        .where(
            PracticeRecord.user_id == uid,
            PracticeRecord.score_overall.isnot(None),
            PracticeRecord.created_at >= month_ago,
        )
        .order_by(PracticeRecord.created_at.desc())
        .limit(50)
    )
    result = await db.execute(stmt)
    recent = result.scalars().all()

    recent_count = len(recent)
    recent_avg = round(sum(r.score_overall or 0 for r in recent) / max(recent_count, 1), 1)

    # 动态计算段位分：综合考虑历史平均分 + 近期表现 + 练习量
    rank_score = round(
        avg_score * 0.4 +
        recent_avg * 0.3 +
        min(total_practiced / 5, 100) * 0.3,
        1
    )
    current_user.rank_score = rank_score
    await db.commit()

    level = _get_rank_level(rank_score)

    # 下一级进度
    next_level_idx = CHALLENGE_LEVELS.index(level) + 1
    if next_level_idx < len(CHALLENGE_LEVELS):
        next_level = CHALLENGE_LEVELS[next_level_idx]
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
        "recent_30d_count": recent_count,
        "recent_30d_avg": recent_avg,
        "avg_score": avg_score,
        "streak_days": current_user.streak_days or 0,
        "max_streak_days": current_user.max_streak_days or 0,
    }


# ==================== 徽章系统 ====================

BADGE_DEFINITIONS = [
    # 连胜徽章 — 神经进化层级
    {"code": "streak_7", "name": "SYNAPSE", "icon": "⟁", "description": "神经元激活 · 连续打卡7天", "type": "streak", "condition_value": 7, "tier": "synapse", "color": "#6b7280"},
    {"code": "streak_30", "name": "QUANTUM", "icon": "◈", "description": "量子跃迁 · 连续打卡30天", "type": "streak", "condition_value": 30, "tier": "quantum", "color": "#22d3ee"},
    {"code": "streak_100", "name": "SINGULARITY", "icon": "◉", "description": "奇点临近 · 连续打卡100天", "type": "streak", "condition_value": 100, "tier": "singularity", "color": "#818cf8"},
    {"code": "streak_365", "name": "TRANSCEND", "icon": "◐", "description": "超维意识 · 连续打卡365天", "type": "streak", "condition_value": 365, "tier": "transcend", "color": "#f0f0fa"},
    # 分数徽章 — 阈值突破
    {"code": "score_80", "name": "THRESHOLD", "icon": "△", "description": "临界点突破 · 单题80分", "type": "score", "condition_value": 80, "tier": "threshold", "color": "#34d399"},
    {"code": "score_90", "name": "DEEPSPACE", "icon": "◇", "description": "深空探测 · 单题90分", "type": "score", "condition_value": 90, "tier": "deepspace", "color": "#60a5fa"},
    {"code": "score_95", "name": "PERFECT WAVE", "icon": "◎", "description": "完美频率 · 单题95分", "type": "score", "condition_value": 95, "tier": "perfect", "color": "#c084fc"},
    # 练习量徽章 — 系统加载
    {"code": "practice_10", "name": "BOOT", "icon": "⊳", "description": "启动序列 · 累计10题", "type": "total", "condition_value": 10, "tier": "boot", "color": "#6b7280"},
    {"code": "practice_50", "name": "CORE", "icon": "◉", "description": "核心运转 · 累计50题", "type": "total", "condition_value": 50, "tier": "core", "color": "#22d3ee"},
    {"code": "practice_100", "name": "NEURAL", "icon": "◈", "description": "神经网络 · 累计100题", "type": "total", "condition_value": 100, "tier": "neural", "color": "#818cf8"},
    {"code": "practice_500", "name": "INFINITE", "icon": "◐", "description": "无限算力 · 累计500题", "type": "total", "condition_value": 500, "tier": "infinite", "color": "#f0f0fa"},
]


async def _ensure_badge_definitions(db: AsyncSession):
    for bdef in BADGE_DEFINITIONS:
        stmt = select(Badge).where(Badge.code == bdef["code"])
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        if not existing:
            badge = Badge(**bdef)
            db.add(badge)
        else:
            # 同步更新名称、图标、描述、颜色（调性迭代时自动生效）
            existing.name = bdef["name"]
            existing.icon = bdef["icon"]
            existing.description = bdef["description"]
            existing.color = bdef["color"]
            existing.tier = bdef["tier"]
    await db.flush()


async def _check_and_award_badges(current_user: User, db: AsyncSession):
    await _ensure_badge_definitions(db)
    uid = current_user.id
    awarded = []
    streak = current_user.streak_days or 0
    total = current_user.total_practice_count or 0

    for bdef in BADGE_DEFINITIONS:
        if bdef["type"] not in ("streak", "total"):
            continue
        val = streak if bdef["type"] == "streak" else total
        if val < bdef["condition_value"]:
            continue
        badge_stmt = select(Badge).where(Badge.code == bdef["code"])
        badge = (await db.execute(badge_stmt)).scalar_one_or_none()
        if not badge:
            continue
        ub_stmt = select(UserBadge).where(
            UserBadge.user_id == uid, UserBadge.badge_id == badge.id,
        )
        if not (await db.execute(ub_stmt)).scalar_one_or_none():
            db.add(UserBadge(user_id=uid, badge_id=badge.id))
            awarded.append({
                "code": bdef["code"], "name": bdef["name"], "icon": bdef["icon"],
                "tier": bdef["tier"], "color": bdef["color"],
            })

    if awarded:
        await db.commit()
    return awarded


@router.get("/badges")
async def get_user_badges(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    uid = current_user.id
    await _ensure_badge_definitions(db)
    stmt = (
        select(UserBadge, Badge)
        .join(Badge, UserBadge.badge_id == Badge.id)
        .where(UserBadge.user_id == uid)
        .order_by(UserBadge.earned_at.desc())
    )
    result = await db.execute(stmt)
    earned = []
    for ub, badge in result.all():
        earned.append({
            "code": badge.code, "name": badge.name, "icon": badge.icon,
            "description": badge.description, "type": badge.type,
            "condition_value": badge.condition_value, "tier": badge.tier,
            "color": badge.color,
            "earned_at": ub.earned_at.strftime("%Y-%m-%d %H:%M"),
        })

    streak = current_user.streak_days or 0
    total = current_user.total_practice_count or 0
    avg = current_user.avg_score or 0
    next_badges = []
    for bdef in BADGE_DEFINITIONS:
        if bdef["type"] == "streak" and streak < bdef["condition_value"]:
            next_badges.append({**bdef, "progress": streak, "target": bdef["condition_value"]})
        elif bdef["type"] == "total" and total < bdef["condition_value"]:
            next_badges.append({**bdef, "progress": total, "target": bdef["condition_value"]})
        elif bdef["type"] == "score" and avg < bdef["condition_value"]:
            next_badges.append({**bdef, "progress": avg, "target": bdef["condition_value"]})

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


# ==================== 收藏 ====================

@router.post("/favorites/{question_id}")
async def toggle_favorite(
    question_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    uid = current_user.id
    q = (await db.execute(select(Question).where(Question.id == question_id))).scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="题目不存在")
    fav_stmt = select(FavoriteQuestion).where(
        FavoriteQuestion.user_id == uid, FavoriteQuestion.question_id == question_id,
    )
    existing = (await db.execute(fav_stmt)).scalar_one_or_none()
    if existing:
        await db.delete(existing)
        await db.commit()
        return {"favorited": False}
    db.add(FavoriteQuestion(user_id=uid, question_id=question_id))
    await db.commit()
    return {"favorited": True}


@router.get("/favorites")
async def list_favorites(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    uid = current_user.id
    stmt = (
        select(FavoriteQuestion, Question)
        .join(Question, FavoriteQuestion.question_id == Question.id)
        .where(FavoriteQuestion.user_id == uid)
        .order_by(FavoriteQuestion.created_at.desc())
        .limit(50)
    )
    result = await db.execute(stmt)
    favs = []
    for fav, q in result.all():
        favs.append({
            "favorite_id": str(fav.id),
            "question_id": str(q.id),
            "content": q.content,
            "category": q.category,
            "difficulty": q.difficulty,
            "exam_type": q.exam_type,
        })
    return {"favorites": favs}


# ==================== 打卡记录 ====================

@router.post("/checkin-record")
async def create_checkin_record(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    uid = current_user.id
    today = date.today()
    exist_stmt = select(CheckinRecord).where(
        CheckinRecord.user_id == uid, CheckinRecord.checkin_date == today,
    )
    existing = (await db.execute(exist_stmt)).scalar_one_or_none()
    if existing:
        return {"ok": False, "message": "今日已打卡", "record_id": str(existing.id)}

    record = CheckinRecord(
        user_id=uid, checkin_date=today,
        category=body.get("category"),
        practice_record_id=body.get("practice_record_id"),
        score=body.get("score"),
    )
    db.add(record)
    current_user.last_checkin_date = today
    current_user.total_checkin_days = (current_user.total_checkin_days or 0) + 1

    yesterday = today - timedelta(days=1)
    last_stmt = select(CheckinRecord).where(
        CheckinRecord.user_id == uid, CheckinRecord.checkin_date == yesterday,
    )
    if (await db.execute(last_stmt)).scalar_one_or_none():
        current_user.streak_days = (current_user.streak_days or 0) + 1
    else:
        current_user.streak_days = 1
    if current_user.streak_days > (current_user.max_streak_days or 0):
        current_user.max_streak_days = current_user.streak_days

    awarded = await _check_and_award_badges(current_user, db)
    await db.commit()
    return {
        "ok": True,
        "record_id": str(record.id),
        "streak_days": current_user.streak_days,
        "new_badges": awarded,
        "message": f"打卡成功！已连续 {current_user.streak_days} 天",
    }


@router.get("/checkin-history")
async def get_checkin_history(
    limit: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    uid = current_user.id
    stmt = (
        select(CheckinRecord).where(CheckinRecord.user_id == uid)
        .order_by(CheckinRecord.checkin_date.desc()).limit(limit)
    )
    result = await db.execute(stmt)
    records = [{
        "id": str(r.id),
        "date": r.checkin_date.strftime("%Y-%m-%d"),
        "category": r.category,
        "score": r.score,
    } for r in result.scalars().all()]
    return {"records": records}
