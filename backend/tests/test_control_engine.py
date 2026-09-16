"""
Tests for Control Engine: Safety Interlocks and Actuator Commands.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.models.models import Base, Zone, ValveState, PumpState
from backend.app.control.engine import ControlEngine


@pytest.fixture
def db_session():
    test_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=test_engine)
    Session = sessionmaker(bind=test_engine)
    session = Session()

    zone1 = Zone(id=1, name="Zone 1", target_allocation_liters=50.0, current_valve_state="OPEN")
    session.add(zone1)
    session.commit()

    yield session
    session.close()


def test_control_engine_manual_commands(db_session):
    dispatched = []
    engine = ControlEngine(publish_mqtt_func=lambda topic, payload: dispatched.append((topic, payload)))

    # 1. Manual pump OFF
    record = engine.set_pump_state(db_session, "OFF", source="MANUAL", reason="Maintenance")
    assert record.state == "OFF"
    assert engine.current_pump_state == "OFF"
    assert len(dispatched) == 1
    assert dispatched[0][0] == "aqua-nexus/control/pump"
    assert dispatched[0][1]["state"] == "OFF"

    # 2. Manual valve 1 CLOSED
    v_record = engine.set_valve_state(db_session, zone_id=1, state="CLOSED", source="MANUAL")
    assert v_record.state == "CLOSED"
    assert engine.current_valve_states[1] == "CLOSED"
    assert len(dispatched) == 2
    assert dispatched[1][0] == "aqua-nexus/control/valve/1"
    assert dispatched[1][1]["state"] == "CLOSED"


def test_automated_interlock_allocation_cutoff(db_session):
    dispatched = []
    engine = ControlEngine(publish_mqtt_func=lambda topic, payload: dispatched.append((topic, payload)))
    engine.current_valve_states[1] = "OPEN"

    # Trigger allocation violation rule
    violations = {1: "EXCEEDED"}
    engine.evaluate_rules(db_session, tank_pct=50.0, allocation_violations=violations)

    assert engine.current_valve_states[1] == "CLOSED"
    zone = db_session.query(Zone).filter_by(id=1).first()
    assert zone.current_valve_state == "CLOSED"
    assert any("aqua-nexus/control/valve/1" in d[0] for d in dispatched)


def test_automated_interlock_overflow_pump_cutoff(db_session):
    dispatched = []
    engine = ControlEngine(publish_mqtt_func=lambda topic, payload: dispatched.append((topic, payload)))
    engine.current_pump_state = "ON"

    # Tank level rises to 92% (above 90% threshold)
    engine.evaluate_rules(db_session, tank_pct=92.0, allocation_violations={})

    assert engine.current_pump_state == "OFF"
    last_pump = db_session.query(PumpState).order_by(PumpState.id.desc()).first()
    assert last_pump.state == "OFF"
    assert last_pump.source == "AUTOMATIC"
    assert any("aqua-nexus/control/pump" in d[0] for d in dispatched)
