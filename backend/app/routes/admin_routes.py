"""
AQUA-NEXUS Admin Routes
Full infrastructure management: User administration, zone assignment, detailed zone telemetry,
and audit logging.
"""

from datetime import datetime, timezone, timedelta, date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import SyncSessionLocal
from backend.app.models.models import User, Zone, Allocation, SensorReading, Alert, Event, ValveState, utc_now
from backend.app.schemas.schemas import (
    UserResponse,
    UserCreateRequest,
    UserUpdateRequest,
    AdminZoneDetailResponse,
    AlertResponse
)
from backend.app.auth.security import hash_password
from backend.app.auth.dependencies import require_admin
from backend.app.detection.engine import detection_engine
from backend.app.control.engine import control_engine

admin_router = APIRouter(prefix="/api/admin", tags=["Admin Management"])


def get_sync_db():
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()


def build_user_response(user: User, db: Session) -> UserResponse:
    zone_name = None
    if user.zone_id:
        zone = db.query(Zone).filter(Zone.id == user.zone_id).first()
        if zone:
            zone_name = zone.name

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        zone_id=user.zone_id,
        zone_name=zone_name,
        status=user.status,
        created_at=user.created_at,
        last_login=user.last_login
    )


def log_admin_event(db: Session, admin_user: User, event_type: str, details: str):
    """Persists an administrative action to the immutable audit event log."""
    db.add(Event(
        timestamp=utc_now(),
        event_type=event_type,
        details=f"[{admin_user.email}] {details}",
        source="ADMIN_ACTION"
    ))
    db.commit()


@admin_router.get("/users", response_model=List[UserResponse])
def list_users(
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_sync_db)
):
    """
    Returns all registered system accounts with role and zone assignments.
    """
    users = db.query(User).order_by(User.id.asc()).all()
    return [build_user_response(u, db) for u in users]


@admin_router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    request: UserCreateRequest,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_sync_db)
):
    """
    Creates a new user account and optionally assigns them to a zone.
    """
    existing = db.query(User).filter(User.email == request.email.strip().lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User with email '{request.email}' already exists"
        )

    if request.zone_id:
        zone = db.query(Zone).filter(Zone.id == request.zone_id).first()
        if not zone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target Zone {request.zone_id} does not exist"
            )

    new_user = User(
        email=request.email.strip().lower(),
        full_name=request.full_name.strip(),
        role=request.role,
        zone_id=request.zone_id,
        hashed_password=hash_password(request.password),
        status="ACTIVE"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_admin_event(
        db=db,
        admin_user=admin_user,
        event_type="USER_CREATED",
        details=f"Created user {new_user.email} (Role: {new_user.role}, Zone: {new_user.zone_id})"
    )

    return build_user_response(new_user, db)


@admin_router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    request: UserUpdateRequest,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_sync_db)
):
    """
    Updates user details, zone assignment, or active status.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    changes = []
    if request.email and request.email.strip().lower() != user.email:
        user.email = request.email.strip().lower()
        changes.append(f"email={user.email}")

    if request.full_name:
        user.full_name = request.full_name.strip()
        changes.append(f"name={user.full_name}")

    if request.role:
        user.role = request.role
        changes.append(f"role={user.role}")

    if request.zone_id is not None:
        if request.zone_id > 0:
            zone = db.query(Zone).filter(Zone.id == request.zone_id).first()
            if not zone:
                raise HTTPException(status_code=400, detail=f"Zone {request.zone_id} does not exist")
            user.zone_id = request.zone_id
            changes.append(f"zone={request.zone_id}")
        else:
            user.zone_id = None
            changes.append("zone=Unassigned")

    if request.status:
        user.status = request.status
        changes.append(f"status={user.status}")

    if request.password:
        user.hashed_password = hash_password(request.password)
        changes.append("password_reset=true")

    db.commit()
    db.refresh(user)

    log_admin_event(
        db=db,
        admin_user=admin_user,
        event_type="USER_UPDATED",
        details=f"Updated user ID {user.id} ({user.email}): {', '.join(changes)}"
    )

    return build_user_response(user, db)


@admin_router.delete("/users/{user_id}")
def deactivate_user(
    user_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_sync_db)
):
    """
    Deactivates a user account (soft delete).
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == admin_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own administrator account")

    user.status = "INACTIVE"
    db.commit()

    log_admin_event(
        db=db,
        admin_user=admin_user,
        event_type="USER_DEACTIVATED",
        details=f"Deactivated user account ID {user.id} ({user.email})"
    )

    return {"message": f"User {user.email} deactivated successfully", "status": "INACTIVE"}


@admin_router.get("/zones/{zone_id}/detail", response_model=AdminZoneDetailResponse)
def get_admin_zone_detail(
    zone_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_sync_db)
):
    """
    Provides comprehensive deep-dive telemetry, assignment, and accountability metrics
    for a specific zone from the Facility Manager's perspective.
    """
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone {zone_id} not found")

    today_str = date.today().isoformat()
    alloc = db.query(Allocation).filter_by(zone_id=zone_id, date=today_str).first()

    consumed = alloc.consumed_liters if alloc else detection_engine.latest_zone_totals.get(zone_id, 0.0)
    allocated = alloc.allocated_liters if alloc else zone.target_allocation_liters
    received = alloc.water_received_liters if (alloc and alloc.water_received_liters is not None and alloc.water_received_liters > 0) else round(consumed * 1.08, 2)
    difference = round(received - consumed, 2)
    remaining = max(0.0, round(allocated - consumed, 2))
    usage_pct = round((consumed / allocated) * 100.0, 1) if allocated > 0 else 0.0

    current_flow = detection_engine.latest_zone_flows.get(zone_id, 0.0)
    valve_state = control_engine.current_valve_states.get(zone_id, zone.current_valve_state)

    status_str = alloc.status if alloc else ("EXCEEDED" if usage_pct >= 100 else ("WARNING" if usage_pct >= 80 else "NORMAL"))

    # Assigned user for this zone
    assigned_user = db.query(User).filter(User.zone_id == zone_id, User.status == "ACTIVE").first()
    assigned_user_resp = build_user_response(assigned_user, db) if assigned_user else None

    # Telemetry readings (last 40 points)
    readings = (
        db.query(SensorReading)
        .filter(SensorReading.zone_id == zone_id)
        .order_by(SensorReading.timestamp.desc())
        .limit(40)
        .all()
    )
    readings_data = [
        {
            "id": r.id,
            "timestamp": r.timestamp.isoformat(),
            "value": r.value,
            "unit": r.unit
        }
        for r in reversed(readings)
    ]

    # Active and recent alerts for this zone
    alerts = (
        db.query(Alert)
        .filter(Alert.zone_id == zone_id)
        .order_by(Alert.timestamp.desc())
        .limit(10)
        .all()
    )

    return AdminZoneDetailResponse(
        zone_id=zone.id,
        name=zone.name,
        description=zone.description,
        assigned_user=assigned_user_resp,
        current_flow_lpm=round(current_flow, 2),
        water_received_today_l=round(received, 2),
        water_consumed_today_l=round(consumed, 2),
        zone_difference_l=round(difference, 2),
        allocated_today_l=round(allocated, 2),
        remaining_today_l=round(remaining, 2),
        usage_percentage=usage_pct,
        valve_state=valve_state,
        status=status_str,
        recent_readings=readings_data,
        alerts=[AlertResponse.model_validate(a) for a in alerts]
    )
