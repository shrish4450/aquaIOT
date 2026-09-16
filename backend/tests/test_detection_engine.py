"""
Tests for Detection Engine: Leakage, Thresholds, Allocations, and Watchdog.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.models.models import (
    Base,
    Zone,
    Allocation,
    Alert,
    Device,
    utc_now
)
from backend.app.detection.engine import DetectionEngine


@pytest.fixture
def db_session():
    # Use in-memory SQLite for test isolation
    test_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=test_engine)
    Session = sessionmaker(bind=test_engine)
    session = Session()

    # Seed baseline zone and device
    zone = Zone(id=1, name="Zone 1", target_allocation_liters=50.0, current_valve_state="OPEN")
    device = Device(id="esp32-main", name="Main Node", status="ONLINE", last_seen=utc_now())
    session.add_all([zone, device])
    session.commit()

    yield session
    session.close()


def test_leak_detection_flow_discrepancy(db_session):
    engine = DetectionEngine()
    # Case 1: Balanced flows (Main = 3.0, Z1 = 1.0, Z2 = 1.2, Z3 = 0.8)
    engine.latest_main_flow = 3.0
    engine.latest_zone_flows = {1: 1.0, 2: 1.2, 3: 0.8}
    alert = engine.evaluate_flow_balance(db_session)
    assert alert is None
    assert db_session.query(Alert).filter_by(alert_type="LEAKAGE", is_active=True).count() == 0

    # Case 2: Leak discrepancy (Main = 5.5, Sum of zones = 3.0) -> Discrepancy 2.5 L/min (45%)
    engine.latest_main_flow = 5.5
    alert = engine.evaluate_flow_balance(db_session)
    assert alert is not None
    assert alert.alert_type == "LEAKAGE"
    assert alert.severity == "CRITICAL"
    assert "Loss: 2.50 L/min" in alert.message

    # Case 3: Recovery -> Alert resolved
    engine.latest_main_flow = 3.0
    engine.evaluate_flow_balance(db_session)
    active_leaks = db_session.query(Alert).filter_by(alert_type="LEAKAGE", is_active=True).all()
    assert len(active_leaks) == 0


def test_tank_overflow_and_critical_detection(db_session):
    engine = DetectionEngine()

    # Normal Level (75%)
    alert = engine.evaluate_tank_level(db_session, 75.0)
    assert alert is None

    # Overflow Level (92%)
    alert = engine.evaluate_tank_level(db_session, 92.0)
    assert alert is not None
    assert alert.alert_type == "OVERFLOW"
    assert alert.is_active is True

    # Critical Low Level (8%)
    alert_crit = engine.evaluate_tank_level(db_session, 8.0)
    assert alert_crit is not None
    assert alert_crit.alert_type == "CRITICAL_LEVEL"
    assert alert_crit.severity == "CRITICAL"


def test_allocation_exhaustion_detection(db_session):
    engine = DetectionEngine()

    # Consumed 20L of 50L (40%) -> NORMAL
    alloc, alert = engine.evaluate_zone_allocation(db_session, zone_id=1, total_consumed=20.0)
    assert alloc.status == "NORMAL"
    assert alert is None

    # Consumed 42L of 50L (84%) -> WARNING
    alloc, alert = engine.evaluate_zone_allocation(db_session, zone_id=1, total_consumed=42.0)
    assert alloc.status == "WARNING"
    assert alert is not None
    assert alert.alert_type == "EXCESSIVE_CONSUMPTION"

    # Consumed 52L of 50L (104%) -> EXCEEDED
    alloc, alert = engine.evaluate_zone_allocation(db_session, zone_id=1, total_consumed=52.0)
    assert alloc.status == "EXCEEDED"
    assert alert is not None
    assert alert.alert_type == "ALLOCATION_EXCEEDED"
    assert alert.severity == "CRITICAL"


def test_alert_deduplication(db_session):
    engine = DetectionEngine()
    # Calling evaluate multiple times during an overflow condition should not spam multiple active alerts
    engine.evaluate_tank_level(db_session, 93.0)
    engine.evaluate_tank_level(db_session, 94.0)
    engine.evaluate_tank_level(db_session, 95.0)

    overflow_alerts = db_session.query(Alert).filter_by(alert_type="OVERFLOW", is_active=True).all()
    assert len(overflow_alerts) == 1
