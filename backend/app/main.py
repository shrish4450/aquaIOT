"""
AQUA-NEXUS FastAPI Application Entrypoint
Orchestrates lifespan management, background watchdog routines, WebSocket streams, and REST routes.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import settings
from backend.app.database import sync_engine, Base
from backend.app.database_seed import seed_database, run_migrations
from backend.app.models.models import SystemSetting
from backend.app.database import SyncSessionLocal
from backend.app.mqtt.client import backend_mqtt
from backend.app.routes.api import api_router, ws_manager, get_dashboard_summary
from backend.app.routes.auth import auth_router
from backend.app.routes.user_routes import user_router
from backend.app.routes.admin_routes import admin_router

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s"
)
logger = logging.getLogger("AQUA-NEXUS-MAIN")


async def periodic_telemetry_broadcaster():
    """Periodically broadcasts complete dashboard state to connected WebSocket clients."""
    while True:
        try:
            await asyncio.sleep(1.0)
            if ws_manager.active_connections:
                session = SyncSessionLocal()
                try:
                    summary = get_dashboard_summary(db=session)
                    await ws_manager.broadcast({
                        "type": "TELEMETRY_SNAPSHOT",
                        "payload": summary.model_dump(mode="json")
                    })
                finally:
                    session.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.debug(f"Error in telemetry broadcaster: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing AQUA-NEXUS Backend Services...")

    # 1. Initialize Tables & Seed Data if empty
    run_migrations()
    Base.metadata.create_all(bind=sync_engine)
    session = SyncSessionLocal()
    try:
        if session.query(SystemSetting).count() == 0:
            logger.info("Database appears unseeded. Running seed_database()...")
            seed_database()
    finally:
        session.close()

    # 2. Start Backend MQTT Client
    backend_mqtt.start()

    # 3. Start background periodic WebSocket broadcaster
    broadcast_task = asyncio.create_task(periodic_telemetry_broadcaster())

    logger.info("AQUA-NEXUS Backend fully operational.")
    yield

    # Cleanup on shutdown
    broadcast_task.cancel()
    try:
        await broadcast_task
    except asyncio.CancelledError:
        pass
    backend_mqtt.stop()
    logger.info("AQUA-NEXUS Backend shutdown cleanly.")


app = FastAPI(
    title=settings.app_name,
    description="Smart Water Tracking, Allocation, Monitoring, and Control System",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(api_router)
app.include_router(auth_router)
app.include_router(user_router)
app.include_router(admin_router)


@app.get("/")
def root():
    return {
        "system": settings.app_name,
        "status": "ONLINE",
        "docs": "/docs",
        "api": "/api/dashboard"
    }


@app.get("/health")
def health_check():
    return {
        "status": "HEALTHY",
        "mqtt_connected": backend_mqtt.is_connected,
        "database": "OK"
    }
