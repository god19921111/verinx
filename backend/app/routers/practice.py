"""练习路由"""

import json
from datetime import datetime, timedelta, date

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.models import User, Question, PracticeRecord, FollowUpRecord
from app.schemas.schemas import (
    PracticeCreateRequest,
    PracticeUpdateRequest,
    PracticeRecordResponse,
    FollowUpCreateRequest,
    FollowUpResponse,
    QuestionResponse,
)
from app.utils.auth import get_current_user

router = APIRouter()


@router.post("", response_model=PracticeRecordResponse)
async def create_practice(
    body: PracticeCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建练习记录"""
    # 检查每日练习限制
    today = date.today()
    is_premium = current_user.member_type == "premium"

    # 如果是新的一天，重置计数
    if current_user.last_practice_date != today:
        current_user.daily_practice_count = 0
        current_user.last_practice_date = today

    # 免费用户每日5次限制
    if not is_premium and current_user.daily_practice_count >= settings.FREE_DAILY_PRACTICE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"免费用户每日练习上限为{settings.FREE_DAILY_PRACTICE_LIMIT}次，升级会员可无限练习",
        )

    # 检查题目是否存在
    stmt = select(Question).where(Question.id == body.question_id)
    result = await db.execute(stmt)
    question = result.scalar_one_or_none()
    if question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="题目不存在",
        )

    # 计算文件过期时间
    retention_days = (
        settings.PREMIUM_USER_FILE_RETENTION_DAYS
        if is_premium
        else settings.FREE_USER_FILE_RETENTION_DAYS
    )
    file_expire_at = datetime.utcnow() + timedelta(days=retention_days)

    # 创建练习记录
    practice = PracticeRecord(
        user_id=current_user.id,
        question_id=body.question_id,
        practice_mode=body.practice_mode,
        file_expire_at=file_expire_at,
    )
    db.add(practice)

    # 更新用户练习计数
    current_user.daily_practice_count += 1
    current_user.total_practice_count += 1

    # 将题目加入去重池，防止重复出题
    from app.services.dedup import get_deduplicator
    dedup = get_deduplicator()
    if question and question.content:
        dedup.add_question(question.content)

    await db.commit()
    await db.refresh(practice)

    stmt = select(Question).where(Question.id == practice.question_id)
    result = await db.execute(stmt)
    question = result.scalar_one_or_none()

    question_resp = None
    if question:
        question_resp = QuestionResponse(
            id=str(question.id),
            category=question.category,
            exam_type=question.exam_type,
            province=question.province,
            content=question.content,
            difficulty=question.difficulty,
            answer_reference=question.answer_reference,
            created_at=question.created_at,
        )

    return {
        "id": str(practice.id),
        "user_id": str(practice.user_id),
        "question_id": str(practice.question_id),
        "question": question_resp,
        "practice_mode": practice.practice_mode,
        "thinking_time": practice.thinking_time,
        "answer_time": practice.answer_time,
        "answer_text": practice.answer_text,
        "audio_url": practice.audio_url,
        "video_url": practice.video_url,
        "score_overall": practice.score_overall,
        "score_analysis": practice.score_analysis,
        "score_expression": practice.score_expression,
        "score_adaptability": practice.score_adaptability,
        "score_organization": practice.score_organization,
        "score_appearance": practice.score_appearance,
        "report_content": practice.report_content,
        "dimension_analysis": (
            json.loads(practice.dimension_analysis)
            if practice.dimension_analysis and isinstance(practice.dimension_analysis, str)
            else practice.dimension_analysis
        ),
        "deduction_points": practice.deduction_points,
        "optimization_suggestions": practice.optimization_suggestions,
        "follow_ups": [],
        "created_at": practice.created_at,
    }


@router.get("", response_model=dict)
async def list_practices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前用户的练习记录列表"""
    # 总数
    count_stmt = select(func.count(PracticeRecord.id)).where(
        PracticeRecord.user_id == current_user.id
    )
    total_result = await db.execute(count_stmt)
    total = total_result.scalar()

    # 分页查询
    offset = (page - 1) * page_size
    stmt = (
        select(PracticeRecord)
        .where(PracticeRecord.user_id == current_user.id)
        .order_by(PracticeRecord.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    practices = result.scalars().all()

    # 加载关联的question
    items = []
    for p in practices:
        stmt = select(Question).where(Question.id == p.question_id)
        q_result = await db.execute(stmt)
        p.question = q_result.scalar_one_or_none()

        resp = PracticeRecordResponse.model_validate(p)
        resp.question = QuestionResponse.model_validate(p.question) if p.question else None
        items.append(resp)

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": items,
    }


@router.get("/{practice_id}", response_model=PracticeRecordResponse)
async def get_practice(
    practice_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取练习记录详情（含题目和追问）"""
    stmt = select(PracticeRecord).where(
        PracticeRecord.id == practice_id,
        PracticeRecord.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    practice = result.scalar_one_or_none()

    if practice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="练习记录不存在",
        )

    # 加载关联的question
    q_stmt = select(Question).where(Question.id == practice.question_id)
    q_result = await db.execute(q_stmt)
    practice.question = q_result.scalar_one_or_none()

    # 加载追问
    fu_stmt = (
        select(FollowUpRecord)
        .where(FollowUpRecord.practice_record_id == practice.id)
        .order_by(FollowUpRecord.created_at)
    )
    fu_result = await db.execute(fu_stmt)
    follow_ups = fu_result.scalars().all()

    resp = PracticeRecordResponse.model_validate(practice)
    resp.question = QuestionResponse.model_validate(practice.question) if practice.question else None
    resp.follow_ups = [FollowUpResponse.model_validate(fu) for fu in follow_ups]
    return resp


@router.put("/{practice_id}", response_model=PracticeRecordResponse)
async def update_practice(
    practice_id: str,
    body: PracticeUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新练习记录（思考时间/答题时间/答题文本）"""
    stmt = select(PracticeRecord).where(
        PracticeRecord.id == practice_id,
        PracticeRecord.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    practice = result.scalar_one_or_none()

    if practice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="练习记录不存在",
        )

    if body.thinking_time is not None:
        practice.thinking_time = body.thinking_time
    if body.answer_time is not None:
        practice.answer_time = body.answer_time
    if body.answer_text is not None:
        practice.answer_text = body.answer_text
    if body.score_overall is not None:
        practice.score_overall = body.score_overall
    if body.score_analysis is not None:
        practice.score_analysis = body.score_analysis
    if body.score_expression is not None:
        practice.score_expression = body.score_expression
    if body.score_adaptability is not None:
        practice.score_adaptability = body.score_adaptability
    if body.score_organization is not None:
        practice.score_organization = body.score_organization
    if body.report_content is not None:
        practice.report_content = body.report_content
    if body.dimension_analysis is not None:
        import json
        practice.dimension_analysis = json.dumps(body.dimension_analysis, ensure_ascii=False)
    if body.deduction_points is not None:
        practice.deduction_points = body.deduction_points
    if body.optimization_suggestions is not None:
        practice.optimization_suggestions = body.optimization_suggestions

    await db.commit()
    await db.refresh(practice)

    # 加载关联的question
    q_stmt = select(Question).where(Question.id == practice.question_id)
    q_result = await db.execute(q_stmt)
    practice.question = q_result.scalar_one_or_none()

    resp = PracticeRecordResponse.model_validate(practice)
    resp.question = QuestionResponse.model_validate(practice.question) if practice.question else None
    return resp


@router.post("/{practice_id}/follow-up", response_model=FollowUpResponse)
async def create_follow_up(
    practice_id: str,
    body: FollowUpCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建追问记录"""
    # 查找练习记录
    stmt = select(PracticeRecord).where(
        PracticeRecord.id == practice_id,
        PracticeRecord.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    practice = result.scalar_one_or_none()

    if practice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="练习记录不存在",
        )

    # 查询已有追问数量
    count_stmt = select(func.count(FollowUpRecord.id)).where(
        FollowUpRecord.practice_record_id == practice_id,
    )
    count_result = await db.execute(count_stmt)
    existing_count = count_result.scalar()

    # 全局最大追问数限制
    if existing_count >= settings.MAX_FOLLOW_UP_PER_SESSION:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"每场练习最多{settings.MAX_FOLLOW_UP_PER_SESSION}次追问",
        )

    # 按会员等级追问次数限制
    is_premium = current_user.member_type == "premium"
    follow_up_limit = (
        settings.PREMIUM_FOLLOW_UP_LIMIT
        if is_premium
        else settings.FREE_FOLLOW_UP_LIMIT
    )
    if existing_count >= follow_up_limit:
        if is_premium:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"会员用户最多{follow_up_limit}次追问",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"免费用户最多{follow_up_limit}次追问，升级会员可追问{settings.PREMIUM_FOLLOW_UP_LIMIT}次",
            )

    # 自动计算轮次号
    round_number = existing_count + 1

    # 创建追问记录（question_text 由 AI 服务在 /ai/follow-up 中生成，此处留空占位）
    follow_up = FollowUpRecord(
        practice_record_id=practice_id,
        round_number=round_number,
        question_text="",  # 将在AI追问接口中更新
        answer_text=body.answer_text,
    )
    db.add(follow_up)
    await db.commit()
    await db.refresh(follow_up)

    return FollowUpResponse.model_validate(follow_up)
