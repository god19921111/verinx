"""数据库连接与会话管理"""

from sqlalchemy import create_engine, types
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID

from app.config import settings

IS_SQLITE = settings.DATABASE_URL.startswith("sqlite")

class SqliteUUID(types.TypeDecorator):
    """SQLite UUID 类型，将 UUID 转换为字符串存储和读取"""
    impl = types.CHAR
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, str):
            return value
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        return str(value)

if IS_SQLITE:
    _sqlite_path = settings.DATABASE_URL.replace("sqlite:///", "")
    sync_engine = create_engine(
        f"sqlite:///{_sqlite_path}",
        echo=settings.DEBUG,
        connect_args={"check_same_thread": False},
    )
    async_engine = create_async_engine(
        f"sqlite+aiosqlite:///{_sqlite_path}",
        echo=settings.DEBUG,
    )
else:
    sync_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+psycopg://")
    sync_engine = create_engine(sync_url, echo=settings.DEBUG)
    async_database_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
    async_engine = create_async_engine(async_database_url, echo=settings.DEBUG)

AsyncSessionLocal = sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_db():
    """FastAPI 依赖注入：获取异步数据库会话"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
