"""
AQUA-NEXUS Configuration Settings
Uses Pydantic BaseSettings for strongly typed, environment-driven configuration.
"""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application Info
    app_name: str = "AQUA-NEXUS"
    environment: str = "development"
    debug: bool = True
    log_level: str = "INFO"

    # Server Network Binding
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]

    # Database URLs
    database_url: str = "sqlite+aiosqlite:///./aqua_nexus.db"
    database_sync_url: str = "sqlite:///./aqua_nexus.db"

    # MQTT Broker
    mqtt_broker_host: str = "localhost"
    mqtt_broker_port: int = 1883
    mqtt_client_id: str = "aqua-nexus-backend"
    mqtt_username: str = ""
    mqtt_password: str = ""
    mqtt_keepalive: int = 60

    # Physical System Geometry
    tank_capacity_liters: float = 100.0
    tank_high_threshold_pct: float = 90.0
    tank_low_threshold_pct: float = 20.0
    tank_critical_threshold_pct: float = 10.0

    # Leak Detection Thresholds
    unaccounted_warning_pct: float = 5.0
    unaccounted_leak_pct: float = 10.0

    # Quota Enforcement Thresholds
    allocation_warning_pct: float = 80.0

    # Device Watchdog
    device_offline_timeout_sec: int = 10

    # Automatic Actuator Control
    auto_cutoff_valve_on_allocation: bool = True
    auto_cutoff_pump_on_overflow: bool = True
    auto_protect_pump_on_dry_run: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
