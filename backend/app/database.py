"""
AQUA-NEXUS Database Engine and Session Management
Supports both Async SQLAlchemy for FastAPI endpoints and Sync SQLAlchemy for seed/migration utilities.
"""

from typing import AsyncGenerator
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, sessionmaker

from backend.app.config import settings

# Async Engine (Default for FastAPI & WebSockets)
async_engine = create_async_engine(
    settings.database_url,
    echo=False,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {}
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

# Sync Engine (Used for seeding, setup, or synchronous test harnesses)
sync_engine = create_engine(
    settings.database_sync_url,
    echo=False,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_sync_url else {}
)

SyncSessionLocal = sessionmaker(
    bind=sync_engine,
    autocommit=False,
    autoflush=False
)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for injecting Async database session into FastAPI routes."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
