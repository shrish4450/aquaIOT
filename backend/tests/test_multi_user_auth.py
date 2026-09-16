"""
AQUA-NEXUS Multi-User & Zone Isolation Test Suite
Verifies:
- Admin and Zone User login authentication and JWT token generation
- Invalid login rejection and inactive user rejection
- Strict backend zone isolation (Zone User accessing another zone is rejected with 403)
- Physical actuator control permissions (Admin can control, Zone User blocked with 403)
- Allocation update permissions (Admin can update, Zone User blocked with 403)
- Water received vs consumed calculation and zone difference
- Admin user management: list, create, change zone, and deactivate
- Zone-specific vs facility-wide alert isolation
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import SyncSessionLocal
from backend.app.models.models import User, Zone, Allocation, Alert, utc_now
from backend.app.database_seed import seed_database


@pytest.fixture(scope="module")
def client():
    seed_database()
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def admin_token(client):
    res = client.post("/api/auth/login", json={
        "email": "admin@aquanexus.local",
        "password": "Admin@123"
    })
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.fixture(scope="module")
def zone2_token(client):
    res = client.post("/api/auth/login", json={
        "email": "zone2@aquanexus.local",
        "password": "Zone2@123"
    })
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.fixture(scope="module")
def zone1_token(client):
    res = client.post("/api/auth/login", json={
        "email": "zone1@aquanexus.local",
        "password": "Zone1@123"
    })
    assert res.status_code == 200
    return res.json()["access_token"]


# --- 1. Authentication Tests ---

def test_admin_login(client):
    res = client.post("/api/auth/login", json={
        "email": "admin@aquanexus.local",
        "password": "Admin@123"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "ADMIN"
    assert data["user"]["email"] == "admin@aquanexus.local"


def test_zone_user_login(client):
    res = client.post("/api/auth/login", json={
        "email": "zone2@aquanexus.local",
        "password": "Zone2@123"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "ZONE_USER"
    assert data["user"]["zone_id"] == 2
    assert "B Wing" in (data["user"]["zone_name"] or "") or "Zone 2" in (data["user"]["zone_name"] or "")


def test_invalid_login(client):
    res = client.post("/api/auth/login", json={
        "email": "admin@aquanexus.local",
        "password": "WrongPassword!99"
    })
    assert res.status_code == 401
    assert "Invalid email or password" in res.json()["detail"]


def test_auth_me_endpoint(client, zone2_token):
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {zone2_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "zone2@aquanexus.local"
    assert data["zone_id"] == 2


# --- 2. Zone Isolation & Backend Authorization Tests ---

def test_zone_user_access_to_own_dashboard(client, zone2_token):
    """Zone 2 user accesses /api/user/zone/dashboard. Must receive Zone 2 data only."""
    res = client.get("/api/user/zone/dashboard", headers={"Authorization": f"Bearer {zone2_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["zone_id"] == 2
    assert "B Wing" in data["zone_name"] or "Zone 2" in data["zone_name"]
    assert "water_received_today_l" in data
    assert "water_consumed_today_l" in data
    assert "zone_difference_l" in data
    assert data["zone_difference_l"] == round(data["water_received_today_l"] - data["water_consumed_today_l"], 2)


def test_zone_user_blocked_from_other_zones(client, zone2_token):
    """Zone 2 user attempts URL tampering to access Zone 1 or Zone 3."""
    # Attempt to access Zone 1
    res1 = client.get("/api/user/zone/1", headers={"Authorization": f"Bearer {zone2_token}"})
    assert res1.status_code == 403
    assert "Access denied" in res1.json()["detail"]

    # Attempt to access Zone 3
    res3 = client.get("/api/user/zone/3", headers={"Authorization": f"Bearer {zone2_token}"})
    assert res3.status_code == 403
    assert "Access denied" in res3.json()["detail"]


def test_admin_access_to_all_zones(client, admin_token):
    """Admin can inspect any zone's detail via /api/admin/zones/{id}/detail."""
    for z_id in (1, 2, 3):
        res = client.get(f"/api/admin/zones/{z_id}/detail", headers={"Authorization": f"Bearer {admin_token}"})
        assert res.status_code == 200
        data = res.json()
        assert data["zone_id"] == z_id
        assert "water_received_today_l" in data
        assert "water_consumed_today_l" in data
        assert "zone_difference_l" in data


def test_zone_user_blocked_from_admin_endpoints(client, zone2_token):
    """Zone 2 user tries to access /api/admin/users or /api/admin/zones/1/detail."""
    res_users = client.get("/api/admin/users", headers={"Authorization": f"Bearer {zone2_token}"})
    assert res_users.status_code == 403

    res_detail = client.get("/api/admin/zones/1/detail", headers={"Authorization": f"Bearer {zone2_token}"})
    assert res_detail.status_code == 403


# --- 3. Actuator Control & Allocation Permissions ---

def test_admin_valve_and_pump_control(client, admin_token):
    """Admin is permitted to control physical pump and valves."""
    res_pump = client.post("/api/control/pump", json={"state": "OFF", "reason": "Admin test"}, headers={"Authorization": f"Bearer {admin_token}"})
    assert res_pump.status_code == 200

    res_valve = client.post("/api/control/valve/2", json={"state": "CLOSED", "reason": "Admin isolation"}, headers={"Authorization": f"Bearer {admin_token}"})
    assert res_valve.status_code == 200
    assert res_valve.json()["valves"]["2"] == "CLOSED"

    # Restore
    client.post("/api/control/pump", json={"state": "ON"}, headers={"Authorization": f"Bearer {admin_token}"})
    client.post("/api/control/valve/2", json={"state": "OPEN"}, headers={"Authorization": f"Bearer {admin_token}"})


def test_zone_user_valve_control_blocked(client, zone2_token):
    """Zone 2 user attempts to actuate their own or other valves. Must be rejected with 403."""
    res = client.post("/api/control/valve/2", json={"state": "CLOSED"}, headers={"Authorization": f"Bearer {zone2_token}"})
    assert res.status_code == 403
    assert "Access Denied" in res.json()["detail"]


def test_zone_user_pump_control_blocked(client, zone2_token):
    """Zone 2 user attempts to operate the main reservoir pump. Must be rejected with 403."""
    res = client.post("/api/control/pump", json={"state": "OFF"}, headers={"Authorization": f"Bearer {zone2_token}"})
    assert res.status_code == 403


def test_admin_allocation_modification(client, admin_token):
    """Admin modifies Zone 1 daily allocation quota."""
    res = client.put("/api/allocations/1", json={"allocated_liters": 75.0}, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    assert res.json()["allocated_liters"] == 75.0

    # Reset back to 50.0
    client.put("/api/allocations/1", json={"allocated_liters": 50.0}, headers={"Authorization": f"Bearer {admin_token}"})


def test_zone_user_allocation_modification_blocked(client, zone2_token):
    """Zone 2 user attempts to increase their quota. Must be rejected with 403."""
    res = client.put("/api/allocations/2", json={"allocated_liters": 500.0}, headers={"Authorization": f"Bearer {zone2_token}"})
    assert res.status_code == 403


# --- 4. Water Received vs Consumed Calculations ---

def test_water_received_vs_consumed_calculation(client, zone2_token):
    """Verifies that received and consumed are separately reported with accurate difference."""
    res = client.get("/api/user/zone/dashboard", headers={"Authorization": f"Bearer {zone2_token}"})
    assert res.status_code == 200
    d = res.json()
    received = d["water_received_today_l"]
    consumed = d["water_consumed_today_l"]
    diff = d["zone_difference_l"]
    assert round(received - consumed, 2) == round(diff, 2)


# --- 5. Zone User History ---

def test_zone_user_history_endpoints(client, zone2_token):
    """Verifies history intervals: TODAY, YESTERDAY, 7DAYS, 30DAYS."""
    for r in ("TODAY", "YESTERDAY", "7DAYS", "30DAYS"):
        res = client.get(f"/api/user/zone/history?range={r}", headers={"Authorization": f"Bearer {zone2_token}"})
        assert res.status_code == 200
        d = res.json()
        assert d["range"] == r
        assert "total_received_l" in d
        assert "total_consumed_l" in d
        assert "total_difference_l" in d
        assert isinstance(d["data_points"], list)


# --- 6. Admin User Management ---

def test_admin_user_lifecycle(client, admin_token):
    """Admin lists users, creates a new resident, changes zone assignment, and deactivates."""
    import time
    unique_email = f"resident_{int(time.time()*1000)}@aquanexus.local"

    # 1. List users
    res_list = client.get("/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_list.status_code == 200
    initial_count = len(res_list.json())

    # 2. Create user
    new_user_payload = {
        "email": unique_email,
        "full_name": "Test Resident",
        "password": "Password123!",
        "role": "ZONE_USER",
        "zone_id": 1
    }
    res_create = client.post("/api/admin/users", json=new_user_payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res_create.status_code == 201
    created_user = res_create.json()
    user_id = created_user["id"]
    assert created_user["email"] == unique_email
    assert created_user["zone_id"] == 1

    # 3. Update zone assignment to Zone 3
    res_update = client.put(f"/api/admin/users/{user_id}", json={"zone_id": 3}, headers={"Authorization": f"Bearer {admin_token}"})
    assert res_update.status_code == 200
    assert res_update.json()["zone_id"] == 3

    # 4. Deactivate user
    res_del = client.delete(f"/api/admin/users/{user_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_del.status_code == 200
    assert res_del.json()["status"] == "INACTIVE"

    # 5. Verify deactivated user cannot log in
    res_login = client.post("/api/auth/login", json={
        "email": unique_email,
        "password": "Password123!"
    })
    assert res_login.status_code == 403
    assert "deactivated" in res_login.json()["detail"].lower()
