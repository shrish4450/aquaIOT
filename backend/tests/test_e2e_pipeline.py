"""
End-to-End Pipeline Verification Test
Validates: Simulator Physics -> Ingestion Processing -> Detection -> Control Interlocks -> Database -> REST APIs.
"""

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database import SyncSessionLocal, Base, sync_engine
from backend.app.database_seed import seed_database
from backend.app.mqtt.client import backend_mqtt
from backend.app.models.models import Alert, TankReading, SensorReading, Zone, Allocation
from simulator.scenarios import ScenarioEngine, ScenarioType


@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(bind=sync_engine)
    seed_database()
    with TestClient(app) as test_client:
        yield test_client


def test_e2e_normal_to_leak_scenario(client):
    # 1. Simulate NORMAL telemetry packet
    backend_mqtt.process_telemetry("aqua-nexus/main/flow", {
        "device_id": "esp32-main",
        "flow_rate_lpm": 3.0,
        "timestamp": "2026-09-08T10:00:00Z"
    })
    backend_mqtt.process_telemetry("aqua-nexus/zone/1/flow", {
        "device_id": "esp32-zone1-2",
        "flow_rate_lpm": 1.0,
        "timestamp": "2026-09-08T10:00:00Z"
    })
    backend_mqtt.process_telemetry("aqua-nexus/zone/2/flow", {
        "device_id": "esp32-zone1-2",
        "flow_rate_lpm": 1.2,
        "timestamp": "2026-09-08T10:00:00Z"
    })
    backend_mqtt.process_telemetry("aqua-nexus/zone/3/flow", {
        "device_id": "esp32-zone3",
        "flow_rate_lpm": 0.8,
        "timestamp": "2026-09-08T10:00:00Z"
    })

    # In NORMAL, no leak alerts
    res_normal = client.get("/api/dashboard")
    assert res_normal.status_code == 200
    normal_data = res_normal.json()
    assert not any(a["alert_type"] == "LEAKAGE" for a in normal_data["recent_alerts"])

    # 2. Trigger LEAK telemetry packet: Main jumps to 6.0 L/min, while zones only total 3.0 L/min (50% loss!)
    backend_mqtt.process_telemetry("aqua-nexus/main/flow", {
        "device_id": "esp32-main",
        "flow_rate_lpm": 6.0,
        "timestamp": "2026-09-08T10:00:02Z"
    })

    # Dashboard should now show active leak alert
    res_leak = client.get("/api/dashboard")
    assert res_leak.status_code == 200
    leak_data = res_leak.json()
    assert any(a["alert_type"] == "LEAKAGE" for a in leak_data["recent_alerts"])



def test_e2e_overflow_scenario_triggers_pump_cutoff(client):
    # Simulate high tank level telemetry (93%)
    backend_mqtt.process_telemetry("aqua-nexus/tank/level", {
        "device_id": "esp32-main",
        "level_liters": 93.0,
        "level_percentage": 93.0,
        "timestamp": "2026-09-08T10:05:00Z"
    })

    # Verify pump was automatically shut down and alert generated
    dash = client.get("/api/dashboard").json()
    assert dash["pump_state"] == "OFF"
    assert any(a["alert_type"] == "OVERFLOW" for a in dash["recent_alerts"])


def test_e2e_excessive_consumption_triggers_valve_cutoff(client):
    # Simulate zone 2 exceeding quota (allocation 40L, consumed 42L)
    backend_mqtt.process_telemetry("aqua-nexus/zone/2/total", {
        "device_id": "esp32-zone1-2",
        "zone_id": 2,
        "total_volume_l": 42.0,
        "timestamp": "2026-09-08T10:10:00Z"
    })

    # Verify Zone 2 valve auto-closed and allocation exceeded alert generated
    dash = client.get("/api/dashboard").json()
    zone2 = next(z for z in dash["zones"] if z["zone_id"] == 2)
    assert zone2["valve_state"] == "CLOSED"
    assert zone2["status"] == "EXCEEDED"
    assert any(a["alert_type"] == "ALLOCATION_EXCEEDED" for a in dash["recent_alerts"])
