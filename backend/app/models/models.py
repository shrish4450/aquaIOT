"""
AQUA-NEXUS Relational Database Models
SQLAlchemy 2.0 ORM Declarations with proper foreign keys and index strategies.
"""

from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    Index
)
from sqlalchemy.orm import relationship
from backend.app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Device(Base):
    __tablename__ = "devices"

    id = Column(String(50), primary_key=True)  # e.g., 'esp32-main', 'esp32-zone1-2', 'esp32-zone3'
    name = Column(String(100), nullable=False)
    device_type = Column(String(50), nullable=False, default="ESP32")
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True)
    status = Column(String(20), nullable=False, default="ONLINE")  # ONLINE, OFFLINE, DEGRADED
    last_seen = Column(DateTime, default=utc_now, onupdate=utc_now)
    ip_address = Column(String(50), nullable=True, default="192.168.1.100")
    firmware_version = Column(String(20), nullable=True, default="v1.2.0-aqua")

    zone = relationship("Zone", back_populates="devices")


class Zone(Base):
    __tablename__ = "zones"

    id = Column(Integer, primary_key=True)  # 1, 2, 3
    name = Column(String(100), nullable=False)  # e.g., 'Zone 1: Residential Block A'
    description = Column(String(255), nullable=True)
    target_allocation_liters = Column(Float, nullable=False, default=50.0)
    current_valve_state = Column(String(20), nullable=False, default="OPEN")  # OPEN, CLOSED
    created_at = Column(DateTime, default=utc_now)

    devices = relationship("Device", back_populates="zone")
    allocations = relationship("Allocation", back_populates="zone", cascade="all, delete-orphan")
    valve_history = relationship("ValveState", back_populates="zone", cascade="all, delete-orphan")
    users = relationship("User", back_populates="zone")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(120), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False, default="ZONE_USER")  # ADMIN, ZONE_USER
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True)  # NULL for ADMIN, set for ZONE_USER
    status = Column(String(20), nullable=False, default="ACTIVE")  # ACTIVE, INACTIVE
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    zone = relationship("Zone", back_populates="users")


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=utc_now, index=True)
    device_id = Column(String(50), nullable=False, index=True)
    zone_id = Column(Integer, nullable=True, index=True)
    metric_type = Column(String(50), nullable=False, index=True)  # 'flow_rate', 'total_volume', 'received_volume'
    value = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False, default="L/min")

    __table_args__ = (
        Index("idx_sensor_time_metric", "timestamp", "metric_type", "zone_id"),
    )


class TankReading(Base):
    __tablename__ = "tank_readings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=utc_now, index=True)
    level_liters = Column(Float, nullable=False)
    level_percentage = Column(Float, nullable=False)
    raw_height_cm = Column(Float, nullable=True)

    __table_args__ = (
        Index("idx_tank_timestamp", "timestamp"),
    )


class Allocation(Base):
    __tablename__ = "allocations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False, index=True)
    date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    allocated_liters = Column(Float, nullable=False)
    consumed_liters = Column(Float, nullable=False, default=0.0)
    water_received_liters = Column(Float, nullable=False, default=0.0)
    zone_difference_liters = Column(Float, nullable=False, default=0.0)
    remaining_liters = Column(Float, nullable=False)
    percentage_used = Column(Float, nullable=False, default=0.0)
    status = Column(String(20), nullable=False, default="NORMAL")  # NORMAL, WARNING, EXCEEDED
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    zone = relationship("Zone", back_populates="allocations")

    __table_args__ = (
        Index("idx_allocation_zone_date", "zone_id", "date", unique=True),
    )


class ValveState(Base):
    __tablename__ = "valve_states"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=utc_now, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False, index=True)
    state = Column(String(20), nullable=False)  # OPEN, CLOSED
    source = Column(String(30), nullable=False, default="MANUAL")  # MANUAL, AUTOMATIC
    reason = Column(String(255), nullable=True)

    zone = relationship("Zone", back_populates="valve_history")


class PumpState(Base):
    __tablename__ = "pump_states"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=utc_now, index=True)
    state = Column(String(20), nullable=False)  # ON, OFF
    source = Column(String(30), nullable=False, default="MANUAL")  # MANUAL, AUTOMATIC
    reason = Column(String(255), nullable=True)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    alert_type = Column(String(50), nullable=False, index=True)
    # Types: LEAKAGE, OVERFLOW, LOW_LEVEL, CRITICAL_LEVEL, EXCESSIVE_CONSUMPTION,
    #        ALLOCATION_EXCEEDED, SENSOR_OFFLINE, DEVICE_OFFLINE, SYSTEM_ERROR
    severity = Column(String(20), nullable=False, default="WARNING")  # INFO, WARNING, CRITICAL
    message = Column(Text, nullable=False)
    zone_id = Column(Integer, nullable=True)
    device_id = Column(String(50), nullable=True)
    is_facility_wide = Column(Boolean, default=False, index=True)
    timestamp = Column(DateTime, default=utc_now, index=True)
    is_active = Column(Boolean, default=True, index=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("idx_alert_active_sev", "is_active", "severity"),
    )



class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=utc_now, index=True)
    event_type = Column(String(50), nullable=False)  # SCENARIO_CHANGE, CONTROL_ACTION, WATCHDOG
    details = Column(Text, nullable=False)
    source = Column(String(50), nullable=False, default="SYSTEM")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value = Column(String(255), nullable=False)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
