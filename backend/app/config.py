"""VerinX公考AI全真面试模拟 - 全局配置"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """应用配置，优先从环境变量读取"""

    # 应用
    APP_NAME: str = "VerinX·AI全真面试模拟"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # 数据库
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/gongkaoxing"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 120

    # 文件上传
    UPLOAD_DIR: str = str(Path(__file__).resolve().parent.parent / "uploads")
    AUDIO_MAX_SIZE_MB: int = 10
    VIDEO_MAX_SIZE_MB: int = 50
    FREE_USER_FILE_RETENTION_DAYS: int = 7
    PREMIUM_USER_FILE_RETENTION_DAYS: int = 30

    # 会员权限
    FREE_DAILY_PRACTICE_LIMIT: int = 3
    FREE_FOLLOW_UP_LIMIT: int = 1
    PREMIUM_FOLLOW_UP_LIMIT: int = 3
    MAX_FOLLOW_UP_PER_SESSION: int = 3

    # 评分权重（配置化，二期可动态调整）
    SCORE_WEIGHT_ANALYSIS: float = 0.30
    SCORE_WEIGHT_EXPRESSION: float = 0.25
    SCORE_WEIGHT_ADAPTABILITY: float = 0.25
    SCORE_WEIGHT_ORGANIZATION: float = 0.20

    # 第三方AI服务
    TTS_API_KEY: str = ""
    TTS_API_URL: str = ""
    ASR_API_KEY: str = ""
    ASR_API_URL: str = ""
    LLM_API_KEY: str = ""
    LLM_API_URL: str = ""
    LLM_MODEL: str = ""

    # 豆包API配置（优先使用豆包）
    DOUBAO_API_KEY: str = ""
    DOUBAO_API_URL: str = "https://api.doubao.com/v1/chat/completions"

    # 讯飞开放平台API配置
    XFYUN_APP_ID: str = ""
    XFYUN_API_KEY: str = ""
    XFYUN_API_SECRET: str = ""
    XFYUN_ASR_URL: str = "wss://iat-api.xfyun.cn/v2/iat"

    # 百度语音识别配置（国内速度快，有免费额度）
    BAIDU_API_KEY: str = ""
    BAIDU_SECRET_KEY: str = ""

    # 打卡与每日挑战
    PREMIUM_UNLIMITED_DAILY_PRACTICE: bool = True

    # 智谱GLM配置（GLM-4-Flash完全免费）
    ZHIPU_API_KEY: str = ""

    # 题库增量更新配置
    QUESTION_BANK_CLOUD_URL: str = ""
    QUESTION_BANK_AUTO_SYNC: bool = True
    QUESTION_BANK_SYNC_INTERVAL_HOURS: int = 24

    # 短信验证码（MVP用模拟方式）
    SMS_ENABLED: bool = False
    SMS_API_KEY: str = ""
    SMS_API_URL: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
