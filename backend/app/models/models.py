"""ORM 模型定义"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Text, Integer, Float, DateTime, ForeignKey, Date,
)
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import relationship

from app.database import Base, IS_SQLITE

ID_TYPE = String(36) if IS_SQLITE else PostgresUUID


def generate_uuid():
    return str(uuid.uuid4()) if IS_SQLITE else uuid.uuid4()


class User(Base):
    __tablename__ = "users"

    id = Column(ID_TYPE, primary_key=True, default=generate_uuid)
    phone = Column(String(20), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=True)
    name = Column(String(50), nullable=True)
    avatar = Column(String(255), nullable=True)
    member_type = Column(String(20), default="free")  # free / premium
    member_expire_at = Column(DateTime, nullable=True)
    daily_practice_count = Column(Integer, default=0)
    last_practice_date = Column(Date, nullable=True)
    total_practice_count = Column(Integer, default=0)
    avg_score = Column(Float, default=0)
    streak_days = Column(Integer, default=0)
    max_streak_days = Column(Integer, default=0)
    last_checkin_date = Column(Date, nullable=True)
    total_checkin_days = Column(Integer, default=0)
    rank_score = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    practices = relationship("PracticeRecord", back_populates="user")


class Question(Base):
    __tablename__ = "questions"

    id = Column(ID_TYPE, primary_key=True, default=generate_uuid)
    category = Column(String(30), nullable=False, index=True)  # 综合分析/人际沟通/应急应变/组织管理/自我认知
    exam_type = Column(String(30), nullable=False, index=True)  # 国考/省考/事业单位
    province = Column(String(20), nullable=True)  # 省考省份
    content = Column(Text, nullable=False)
    difficulty = Column(Integer, default=1)  # 1-5
    answer_reference = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    practices = relationship("PracticeRecord", back_populates="question")


class PracticeRecord(Base):
    __tablename__ = "practice_records"

    id = Column(ID_TYPE, primary_key=True, default=generate_uuid)
    user_id = Column(ID_TYPE, ForeignKey("users.id"), nullable=False, index=True)
    question_id = Column(ID_TYPE, ForeignKey("questions.id"), nullable=False)
    practice_mode = Column(String(20), nullable=False)  # single / full
    thinking_time = Column(Integer, nullable=True)  # 秒
    answer_time = Column(Integer, nullable=True)  # 秒
    answer_text = Column(Text, nullable=True)
    audio_url = Column(String(255), nullable=True)
    video_url = Column(String(255), nullable=True)
    # 5维度评分
    score_overall = Column(Float, nullable=True)
    score_analysis = Column(Float, nullable=True)
    score_expression = Column(Float, nullable=True)
    score_adaptability = Column(Float, nullable=True)
    score_organization = Column(Float, nullable=True)
    score_appearance = Column(Float, nullable=True)
    # 报告内容
    report_content = Column(Text, nullable=True)
    dimension_analysis = Column(Text, nullable=True)
    deduction_points = Column(Text, nullable=True)
    optimization_suggestions = Column(Text, nullable=True)
    # 文件过期时间（按会员等级设置）
    file_expire_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="practices")
    question = relationship("Question", back_populates="practices")
    follow_ups = relationship("FollowUpRecord", back_populates="practice_record", order_by="FollowUpRecord.created_at")


class FollowUpRecord(Base):
    __tablename__ = "follow_up_records"

    id = Column(ID_TYPE, primary_key=True, default=generate_uuid)
    practice_record_id = Column(ID_TYPE, ForeignKey("practice_records.id"), nullable=False, index=True)
    round_number = Column(Integer, nullable=False)  # 第几轮追问（1-3）
    question_text = Column(Text, nullable=False)
    answer_text = Column(Text, nullable=True)
    audio_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    practice_record = relationship("PracticeRecord", back_populates="follow_ups")


class VerificationCode(Base):
    __tablename__ = "verification_codes"

    id = Column(ID_TYPE, primary_key=True, default=generate_uuid)
    phone = Column(String(20), nullable=False, index=True)
    code = Column(String(6), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Badge(Base):
    """成就徽章定义"""
    __tablename__ = "badges"

    id = Column(ID_TYPE, primary_key=True, default=generate_uuid)
    code = Column(String(30), unique=True, nullable=False, index=True)
    name = Column(String(50), nullable=False)
    icon = Column(String(10), nullable=False)  # emoji 或符号
    description = Column(Text, nullable=True)
    type = Column(String(20), nullable=False)  # streak / score / challenge
    condition_value = Column(Integer, nullable=False)  # 达成条件数值
    tier = Column(String(20), default="bronze")  # bronze / silver / gold / legend
    color = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserBadge(Base):
    """用户已获得的徽章"""
    __tablename__ = "user_badges"

    id = Column(ID_TYPE, primary_key=True, default=generate_uuid)
    user_id = Column(ID_TYPE, ForeignKey("users.id"), nullable=False, index=True)
    badge_id = Column(ID_TYPE, ForeignKey("badges.id"), nullable=False, index=True)
    earned_at = Column(DateTime, default=datetime.utcnow)


class FavoriteQuestion(Base):
    """用户收藏的题目"""
    __tablename__ = "favorite_questions"

    id = Column(ID_TYPE, primary_key=True, default=generate_uuid)
    user_id = Column(ID_TYPE, ForeignKey("users.id"), nullable=False, index=True)
    question_id = Column(ID_TYPE, ForeignKey("questions.id"), nullable=False, index=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class CheckinRecord(Base):
    """打卡记录（每日一次）"""
    __tablename__ = "checkin_records"

    id = Column(ID_TYPE, primary_key=True, default=generate_uuid)
    user_id = Column(ID_TYPE, ForeignKey("users.id"), nullable=False, index=True)
    checkin_date = Column(Date, nullable=False, index=True)
    category = Column(String(30), nullable=True)  # 打卡练习的题型
    practice_record_id = Column(ID_TYPE, ForeignKey("practice_records.id"), nullable=True)
    score = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
