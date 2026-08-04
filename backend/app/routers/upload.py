"""文件上传路由"""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.models import User
from app.utils.auth import get_current_user

router = APIRouter()

ALLOWED_AUDIO_TYPES = {"audio/wav", "audio/mp3", "audio/mpeg", "audio/ogg", "audio/webm"}
ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".ogg", ".webm"}
ALLOWED_VIDEO_TYPES = {"video/webm", "video/mp4"}
ALLOWED_VIDEO_EXTENSIONS = {".webm", ".mp4"}


@router.post("/audio")
async def upload_audio(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """上传音频文件（最大10MB，支持 wav/mp3/ogg/webm）"""
    # 验证文件大小
    max_size = settings.AUDIO_MAX_SIZE_MB * 1024 * 1024
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"音频文件大小不能超过{settings.AUDIO_MAX_SIZE_MB}MB",
        )

    # 验证文件类型
    ext = Path(file.filename or "audio.wav").suffix.lower()
    content_type = file.content_type or ""
    if ext not in ALLOWED_AUDIO_EXTENSIONS and content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不支持的音频格式，仅支持 wav/mp3/ogg/webm",
        )

    # 确定扩展名
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        ext = ".wav"

    # 保存文件: uploads/audio/{user_id}/{uuid}.ext
    file_name = f"{uuid.uuid4()}{ext}"
    user_dir = Path(settings.UPLOAD_DIR) / "audio" / str(current_user.id)
    user_dir.mkdir(parents=True, exist_ok=True)
    file_path = user_dir / file_name

    import aiofiles
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    file_url = f"/uploads/audio/{current_user.id}/{file_name}"
    return {"url": file_url, "file_name": file_name}


@router.post("/video")
async def upload_video(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """上传视频文件（最大50MB，支持 webm/mp4）"""
    # 验证文件大小
    max_size = settings.VIDEO_MAX_SIZE_MB * 1024 * 1024
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"视频文件大小不能超过{settings.VIDEO_MAX_SIZE_MB}MB",
        )

    # 验证文件类型
    ext = Path(file.filename or "video.webm").suffix.lower()
    content_type = file.content_type or ""
    if ext not in ALLOWED_VIDEO_EXTENSIONS and content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不支持的视频格式，仅支持 webm/mp4",
        )

    # 确定扩展名
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        ext = ".webm"

    # 保存文件: uploads/video/{user_id}/{uuid}.ext
    file_name = f"{uuid.uuid4()}{ext}"
    user_dir = Path(settings.UPLOAD_DIR) / "video" / str(current_user.id)
    user_dir.mkdir(parents=True, exist_ok=True)
    file_path = user_dir / file_name

    import aiofiles
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    file_url = f"/uploads/video/{current_user.id}/{file_name}"
    return {"url": file_url, "file_name": file_name}
