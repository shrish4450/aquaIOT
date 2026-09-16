"""
Tests for FastAPI REST API Endpoints.
"""

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database import SyncSessionLocal, Base, sync_engine
from backend.app.database_seed import seed_database


@pytest.fixture(scope="module")
def client():
    # Ensure tables and baseline seed data exist
    Base.metadata.create_all(bind=sync_engine)
    seed_database()
    with TestClient(app) as test_client:
        yield test_client


def test_root_and_health(client):
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["system"] == "AQUA-NEXUS"

    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "HEALTHY"


def test_dashboard_endpoint(client):
    res = client.get("/api/dashboard")
    assert res.status_code == 200
    data = res.json()
    assert "tank" in data
    assert "accountability" in data
    assert "zones" in data
    assert len(data["zones"]) == 3
    assert "active_scenario" in data


def test_tank_endpoint(client):
    res = client.get("/api/tank")
    assert res.status_code == 200
    data = res.json()
    assert data["capacity_liters"] == 100.0
    assert "current_level_liters" in data
    assert "level_percentage" in data


def test_zones_endpoint(client):
    res = client.get("/api/zones")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 3
    assert data[0]["zone_id"] == 1


def test_consumption_endpoint(client):
    res = client.get("/api/consumption")
    assert res.status_code == 200
    data = res.json()
    assert "hourly_data" in data
    assert "zone_breakdown" in data
    assert "tank_trend" in data
    assert len(data["hourly_data"]) == 24


def test_alerts_endpoints(client):
    res = client.get("/api/alerts")
    assert res.status_code == 200
    assert isinstance(res.json(), list)

    res_active = client.get("/api/alerts/active")
    assert res_active.status_code == 200
    assert isinstance(res_active.json(), list)


def test_actuator_controls(client):
    # Test Pump control
    pump_res = client.post("/api/control/pump", json={"state": "OFF", "reason": "Test shutdown"})
    assert pump_res.status_code == 200
    assert pump_res.json()["pump"] == "OFF"

    # Restore pump
    client.post("/api/control/pump", json={"state": "ON", "reason": "Restore"})

    # Test Valve control
    valve_res = client.post("/api/control/valve/2", json={"state": "CLOSED", "reason": "Test isolation"})
    assert valve_res.status_code == 200
    assert valve_res.json()["valves"]["2"] == "CLOSED"

    # Restore valve
    client.post("/api/control/valve/2", json={"state": "OPEN", "reason": "Restore"})


def test_simulator_scenario_trigger(client):
    res = client.post("/api/simulator/scenario", json={"scenario": "LEAK", "zone_id": 2})
    assert res.status_code == 200
    assert res.json()["active_scenario"] == "LEAK"

    # Reset to normal
    res_norm = client.post("/api/simulator/scenario", json={"scenario": "NORMAL"})
    assert res_norm.status_code == 200
    assert res_norm.json()["active_scenario"] == "NORMAL"


def test_system_settings(client):
    res = client.get("/api/settings")
    assert res.status_code == 200
    settings_list = res.json()
    assert any(s["key"] == "tank_capacity_liters" for s in settings_list)
