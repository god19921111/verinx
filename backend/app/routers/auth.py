"""认证路由"""

import random
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import User, VerificationCode
from app.schemas.schemas import (
    SendCodeRequest,
    LoginCodeRequest,
    LoginPasswordRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.utils.auth import create_access_token

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


@router.post("/send-code")
async def send_code(
    body: SendCodeRequest,
    db: AsyncSession = Depends(get_db),
):
    """发送手机验证码（MVP阶段模拟发送，实际返回验证码用于测试）"""
    # 频率限制：每分钟每手机号1条
    one_minute_ago = datetime.utcnow() - timedelta(minutes=1)
    stmt = (
        select(VerificationCode)
        .where(
            VerificationCode.phone == body.phone,
            VerificationCode.created_at >= one_minute_ago,
        )
        .order_by(VerificationCode.created_at.desc())
    )
    result = await db.execute(stmt)
    recent_code = result.scalar_one_or_none()
    if recent_code:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="发送验证码过于频繁，请1分钟后再试",
        )

    # 生成6位数字验证码
    code = f"{random.randint(0, 999999):06d}"
    verification = VerificationCode(phone=body.phone, code=code)
    db.add(verification)
    await db.commit()

    # MVP：直接返回验证码便于测试；生产环境应通过短信发送
    return {"msg": "验证码已发送", "code": code}


@router.post("/login-code", response_model=TokenResponse)
async def login_with_code(
    body: LoginCodeRequest,
    db: AsyncSession = Depends(get_db),
):
    """验证码登录"""
    # 查找5分钟内的最新验证码
    five_minutes_ago = datetime.utcnow() - timedelta(minutes=5)
    stmt = (
        select(VerificationCode)
        .where(
            VerificationCode.phone == body.phone,
            VerificationCode.created_at >= five_minutes_ago,
        )
        .order_by(VerificationCode.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    code_record = result.scalar_one_or_none()

    if not code_record or code_record.code != body.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码错误或已过期",
        )

    # 查找或创建用户
    stmt = select(User).where(User.phone == body.phone)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        user = User(phone=body.phone)
        db.add(user)
        await db.commit()
        await db.refresh(user)

    token = create_access_token(str(user.id))
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/login-password", response_model=TokenResponse)
async def login_with_password(
    body: LoginPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """密码登录"""
    stmt = select(User).where(User.phone == body.phone)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None or user.password is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="手机号或密码错误",
        )

    if not verify_password(body.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="手机号或密码错误",
        )

    token = create_access_token(str(user.id))
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/quick-login", response_model=TokenResponse)
async def quick_login(
    db: AsyncSession = Depends(get_db),
):
    """VIP快速登录（体验账号，免验证码）"""
    vip_phone = "13800000000"
    stmt = select(User).where(User.phone == vip_phone)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        # 创建VIP用户
        user = User(
            phone=vip_phone,
            name="VIP体验用户",
            member_type="premium",
            member_expire_at=datetime.utcnow() + timedelta(days=365),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    elif user.member_type != "premium":
        # 升级为VIP
        user.member_type = "premium"
        user.member_expire_at = datetime.utcnow() + timedelta(days=365)
        await db.commit()
        await db.refresh(user)

    token = create_access_token(str(user.id))
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/register", response_model=TokenResponse)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """用户注册"""
    # 校验验证码
    five_minutes_ago = datetime.utcnow() - timedelta(minutes=5)
    stmt = (
        select(VerificationCode)
        .where(
            VerificationCode.phone == body.phone,
            VerificationCode.created_at >= five_minutes_ago,
        )
        .order_by(VerificationCode.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    code_record = result.scalar_one_or_none()

    if not code_record or code_record.code != body.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码错误或已过期",
        )

    # 检查手机号是否已注册
    stmt = select(User).where(User.phone == body.phone)
    result = await db.execute(stmt)
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该手机号已注册",
        )

    # 创建用户
    hashed_password = get_password_hash(body.password)
    user = User(phone=body.phone, password=hashed_password)
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(str(user.id))
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )
