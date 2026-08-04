"""Pydantic 数据校验模型"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ========== 用户认证 ==========

class SendCodeRequest(BaseModel):
    phone: str = Field(..., pattern=r"^1[3-9]\d{9}$", description="手机号")


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


# ========== 用户 ==========

class UserResponse(BaseModel):
    id: str
    phone: str
    name: Optional[str] = None
    avatar: Optional[str] = None
    member_type: str = "free"
    member_expire_at: Optional[datetime] = None
    daily_practice_count: int = 0
    total_practice_count: int = 0
    avg_score: float = 0

    model_config = {"from_attributes": True}


class UserUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=50)
    avatar: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ========== 题库 ==========

class QuestionResponse(BaseModel):
    id: str
    category: str
    exam_type: str
    province: Optional[str] = None
    content: str
    difficulty: int = 1
    answer_reference: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class QuestionListQuery(BaseModel):
    category: Optional[str] = None
    exam_type: Optional[str] = None
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


# ========== 练习 ==========

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


class FollowUpCreateRequest(BaseModel):
    answer_text: Optional[str] = None


class FollowUpResponse(BaseModel):
    id: str
    practice_record_id: str
    round_number: int
    question_text: str
    answer_text: Optional[str] = None
    audio_url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PracticeRecordResponse(BaseModel):
    id: str
    user_id: str
    question_id: str
    question: Optional[QuestionResponse] = None
    practice_mode: str
    thinking_time: Optional[int] = None
    answer_time: Optional[int] = None
    answer_text: Optional[str] = None
    audio_url: Optional[str] = None
    video_url: Optional[str] = None
    score_overall: Optional[float] = None
    score_analysis: Optional[float] = None
    score_expression: Optional[float] = None
    score_adaptability: Optional[float] = None
    score_organization: Optional[float] = None
    score_appearance: Optional[float] = None
    report_content: Optional[str] = None
    deduction_points: Optional[str] = None
    optimization_suggestions: Optional[str] = None
    follow_ups: list[FollowUpResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


# ========== AI ==========

class TTSRequest(BaseModel):
    text: str = Field(..., max_length=5000)
    speed: float = Field(1.0, ge=0.5, le=2.0)


class ASRRequest(BaseModel):
    audio_url: Optional[str] = None
    audio_duration: Optional[float] = None


class ScoreRequest(BaseModel):
    question_content: str
    answer_text: str
    question_category: str


class FollowUpQuestionRequest(BaseModel):
    question_content: str
    answer_text: str
    question_category: str
    round_number: int = Field(..., ge=1, le=3)
