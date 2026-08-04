"""文件清理服务 - 清理过期的上传文件"""

import logging
from datetime import datetime
from pathlib import Path

from sqlalchemy import select, update

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.models import PracticeRecord

logger = logging.getLogger(__name__)


async def cleanup_expired_files() -> dict:
    """
    清理过期文件：
    1. 查询 file_expire_at < now 的练习记录
    2. 删除磁盘上的音视频文件
    3. 清除数据库中的 URL 字段
    适用于 APScheduler 定时调用
    """
    now = datetime.utcnow()
    cleaned_count = 0
    errors = []

    async with AsyncSessionLocal() as db:
        # 查找过期但尚未清理的记录（URL非空表示文件还在）
        stmt = select(PracticeRecord).where(
            PracticeRecord.file_expire_at < now,
            (PracticeRecord.audio_url.isnot(None)) | (PracticeRecord.video_url.isnot(None)),
        )
        result = await db.execute(stmt)
        expired_records = result.scalars().all()

        for record in expired_records:
            # 删除音频文件
            if record.audio_url:
                deleted = _delete_file(record.audio_url)
                if deleted:
                    record.audio_url = None

            # 删除视频文件
            if record.video_url:
                deleted = _delete_file(record.video_url)
                if deleted:
                    record.video_url = None

            cleaned_count += 1

        await db.commit()

    logger.info(f"文件清理完成：共清理 {cleaned_count} 条过期记录")
    return {
        "cleaned_count": cleaned_count,
        "errors": errors,
        "cleaned_at": now.isoformat(),
    }


def _delete_file(url_path: str) -> bool:
    """根据URL路径删除磁盘文件"""
    try:
        # URL 格式: /uploads/audio/{user_id}/{file_name} 或 /uploads/video/{user_id}/{file_name}
        # 磁盘路径: {UPLOAD_DIR}/audio/{user_id}/{file_name}
        if url_path.startswith("/uploads/"):
            relative_path = url_path[len("/uploads/"):]
            file_path = Path(settings.UPLOAD_DIR) / relative_path
        else:
            file_path = Path(url_path)

        if file_path.exists():
            file_path.unlink()
            return True
        return True  # 文件已不存在，视为清理成功
    except Exception as e:
        logger.error(f"删除文件失败 {url_path}: {e}")
        return False
