"""用户路由"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import User
from app.schemas.schemas import UserResponse, UserUpdateRequest
from app.utils.auth import get_current_user

router = APIRouter()


@router.get("/info", response_model=UserResponse)
async def get_user_info(
    current_user: User = Depends(get_current_user),
):
    """获取当前用户信息"""
    return UserResponse.model_validate(current_user)


@router.put("/info", response_model=UserResponse)
async def update_user_info(
    body: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新用户信息（姓名/头像）"""
    if body.name is not None:
        current_user.name = body.name
    if body.avatar is not None:
        current_user.avatar = body.avatar

    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)
