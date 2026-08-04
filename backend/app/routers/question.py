"""题库路由"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Question
from app.schemas.schemas import QuestionResponse, QuestionListQuery

router = APIRouter()


@router.get("", response_model=dict)
async def list_questions(
    category: str = Query(None, description="题目分类"),
    exam_type: str = Query(None, description="考试类型"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """获取题目列表（分页 + 筛选）"""
    # 构建查询条件
    stmt = select(Question)
    count_stmt = select(func.count(Question.id))

    if category:
        stmt = stmt.where(Question.category == category)
        count_stmt = count_stmt.where(Question.category == category)
    if exam_type:
        stmt = stmt.where(Question.exam_type == exam_type)
        count_stmt = count_stmt.where(Question.exam_type == exam_type)

    # 总数
    total_result = await db.execute(count_stmt)
    total = total_result.scalar()

    # 分页
    offset = (page - 1) * page_size
    stmt = stmt.order_by(Question.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(stmt)
    questions = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [QuestionResponse.model_validate(q) for q in questions],
    }


@router.get("/random", response_model=QuestionResponse)
async def random_question(
    category: str = Query(None, description="题目分类"),
    exam_type: str = Query(None, description="考试类型"),
    db: AsyncSession = Depends(get_db),
):
    """随机获取一道题目"""
    stmt = select(Question).order_by(func.random())

    if category:
        stmt = stmt.where(Question.category == category)
    if exam_type:
        stmt = stmt.where(Question.exam_type == exam_type)

    stmt = stmt.limit(1)
    result = await db.execute(stmt)
    question = result.scalar_one_or_none()

    if question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="没有找到符合条件的题目",
        )

    return QuestionResponse.model_validate(question)


@router.get("/{question_id}", response_model=QuestionResponse)
async def get_question(
    question_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取题目详情"""
    stmt = select(Question).where(Question.id == question_id)
    result = await db.execute(stmt)
    question = result.scalar_one_or_none()

    if question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="题目不存在",
        )

    return QuestionResponse.model_validate(question)
