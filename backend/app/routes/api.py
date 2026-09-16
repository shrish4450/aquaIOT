"""
AQUA-NEXUS Comprehensive REST & WebSocket API Router
Implements all required telemetry queries, actuator controls, analytics, and demo scenario hooks.
"""

import asyncio
import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from backend.app.database import SyncSessionLocal, get_db
from backend.app.config import settings
from backend.app.models.models import (
    Device,
    Zone,
    SensorReading,
    TankReading,
    Allocation,
    ValveState,
    PumpState,
    Alert,
    Event,
    SystemSetting,
    utc_now
)
from backend.app.schemas.schemas import (
    DashboardSummaryResponse,
    TankStatusResponse,
    ZoneCardData,
    ZoneResponse,
    DeviceResponse,
    AllocationResponse,
    AllocationUpdate,
    PumpControlRequest,
    ValveControlRequest,
    ActuatorStateResponse,
    AlertResponse,
    EventResponse,
    SystemSettingResponse,
    SystemSettingUpdate,
    WaterAccountabilityMetrics,
    ScenarioChangeRequest,
    SimulatorStatusResponse
)
from backend.app.models.models import User
from backend.app.detection.engine import detection_engine
from backend.app.control.engine import control_engine
from backend.app.auth.dependencies import check_admin_permission_or_unauthenticated_dev

api_router = APIRouter(prefix="/api")

# In-memory WebSocket manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

ws_manager = ConnectionManager()
_active_scenario: str = "NORMAL"


def get_sync_session():
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- 1. Dashboard Overview Aggregation ---
@api_router.get("/dashboard", response_model=DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_sync_session)):
    global _active_scenario

    # Run device watchdog check
    detection_engine.evaluate_device_watchdog(db)

    now = utc_now()
    today_str = datetime.date.today().isoformat()

    # Tank Status
    latest_tank = db.query(TankReading).order_by(desc(TankReading.timestamp)).first()
    tank_liters = latest_tank.level_liters if latest_tank else detection_engine.latest_tank_level
    tank_pct = latest_tank.level_percentage if latest_tank else detection_engine.latest_tank_pct

    tank_status_str = "NORMAL"
    if tank_pct >= settings.tank_high_threshold_pct:
        tank_status_str = "HIGH"
    elif tank_pct <= settings.tank_critical_threshold_pct:
        tank_status_str = "CRITICAL"
    elif tank_pct <= settings.tank_low_threshold_pct:
        tank_status_str = "LOW"

    tank_obj = TankStatusResponse(
        capacity_liters=settings.tank_capacity_liters,
        current_level_liters=round(tank_liters, 2),
        level_percentage=round(tank_pct, 1),
        remaining_capacity_liters=round(max(0.0, settings.tank_capacity_liters - tank_liters), 2),
        high_threshold_pct=settings.tank_high_threshold_pct,
        low_threshold_pct=settings.tank_low_threshold_pct,
        critical_threshold_pct=settings.tank_critical_threshold_pct,
        pump_state=control_engine.current_pump_state,
        status=tank_status_str,
        last_updated=latest_tank.timestamp if latest_tank else now
    )

    # Zones & Consumption Aggregates
    zones = db.query(Zone).all()
    zone_cards: List[ZoneCardData] = []
    total_zone_consumed = 0.0

    for z in zones:
        alloc = db.query(Allocation).filter_by(zone_id=z.id, date=today_str).first()
        consumed = alloc.consumed_liters if alloc else detection_engine.latest_zone_totals.get(z.id, 0.0)
        allocated = alloc.allocated_liters if alloc else z.target_allocation_liters
        received = alloc.water_received_liters if (alloc and alloc.water_received_liters is not None and alloc.water_received_liters > 0) else round(consumed * 1.08, 2)
        diff = round(received - consumed, 2)
        remaining = max(0.0, allocated - consumed)
        pct = (consumed / allocated) * 100.0 if allocated > 0 else 0.0
        status = alloc.status if alloc else ("EXCEEDED" if pct >= 100 else ("WARNING" if pct >= 80 else "NORMAL"))

        total_zone_consumed += consumed
        flow_lpm = detection_engine.latest_zone_flows.get(z.id, 0.0)
        valve_st = control_engine.current_valve_states.get(z.id, z.current_valve_state)

        zone_cards.append(ZoneCardData(
            zone_id=z.id,
            name=z.name,
            current_flow_lpm=round(flow_lpm, 2),
            consumed_today_l=round(consumed, 2),
            water_received_today_l=round(received, 2),
            zone_difference_l=round(diff, 2),
            allocated_today_l=round(allocated, 2),
            remaining_today_l=round(remaining, 2),
            usage_percentage=round(pct, 1),
            valve_state=valve_st,
            status=status
        ))

    # Water Accountability
    total_incoming = detection_engine.latest_main_total
    accountability_dict = detection_engine.calculate_accountability(
        total_incoming=total_incoming,
        total_consumed=total_zone_consumed,
        warning_thresh_pct=settings.unaccounted_warning_pct,
        leak_thresh_pct=settings.unaccounted_leak_pct
    )
    accountability = WaterAccountabilityMetrics(**accountability_dict)

    # Alerts & Devices
    active_alerts = db.query(Alert).filter(Alert.is_active.is_(True)).order_by(desc(Alert.timestamp), desc(Alert.id)).all()
    crit_count = sum(1 for a in active_alerts if a.severity == "CRITICAL")
    devices = db.query(Device).all()
    recent_alerts = active_alerts[:10]

    from backend.app.mqtt.client import backend_mqtt

    return DashboardSummaryResponse(
        timestamp=now,
        active_scenario=_active_scenario,
        mqtt_connected=backend_mqtt.is_connected,
        tank=tank_obj,
        accountability=accountability,
        active_alerts_count=len(active_alerts),
        critical_alerts_count=crit_count,
        pump_state=control_engine.current_pump_state,
        zones=zone_cards,
        devices=[DeviceResponse.model_validate(d) for d in devices],
        recent_alerts=[AlertResponse.model_validate(a) for a in recent_alerts]
    )


# --- 2. Tank Telemetry ---
@api_router.get("/tank", response_model=TankStatusResponse)
def get_tank_details(db: Session = Depends(get_sync_session)):
    latest_tank = db.query(TankReading).order_by(desc(TankReading.timestamp)).first()
    tank_liters = latest_tank.level_liters if latest_tank else detection_engine.latest_tank_level
    tank_pct = latest_tank.level_percentage if latest_tank else detection_engine.latest_tank_pct

    tank_status_str = "NORMAL"
    if tank_pct >= settings.tank_high_threshold_pct:
        tank_status_str = "HIGH"
    elif tank_pct <= settings.tank_critical_threshold_pct:
        tank_status_str = "CRITICAL"
    elif tank_pct <= settings.tank_low_threshold_pct:
        tank_status_str = "LOW"

    return TankStatusResponse(
        capacity_liters=settings.tank_capacity_liters,
        current_level_liters=round(tank_liters, 2),
        level_percentage=round(tank_pct, 1),
        remaining_capacity_liters=round(max(0.0, settings.tank_capacity_liters - tank_liters), 2),
        high_threshold_pct=settings.tank_high_threshold_pct,
        low_threshold_pct=settings.tank_low_threshold_pct,
        critical_threshold_pct=settings.tank_critical_threshold_pct,
        pump_state=control_engine.current_pump_state,
        status=tank_status_str,
        last_updated=latest_tank.timestamp if latest_tank else utc_now()
    )


# --- 3. Zones & Cards ---
@api_router.get("/zones", response_model=List[ZoneCardData])
def get_zones_summary(db: Session = Depends(get_sync_session)):
    today_str = datetime.date.today().isoformat()
    zones = db.query(Zone).all()
    results = []
    for z in zones:
        alloc = db.query(Allocation).filter_by(zone_id=z.id, date=today_str).first()
        consumed = alloc.consumed_liters if alloc else detection_engine.latest_zone_totals.get(z.id, 0.0)
        allocated = alloc.allocated_liters if alloc else z.target_allocation_liters
        received = alloc.water_received_liters if (alloc and alloc.water_received_liters is not None and alloc.water_received_liters > 0) else round(consumed * 1.08, 2)
        diff = round(received - consumed, 2)
        remaining = max(0.0, allocated - consumed)
        pct = (consumed / allocated) * 100.0 if allocated > 0 else 0.0
        status = alloc.status if alloc else ("EXCEEDED" if pct >= 100 else ("WARNING" if pct >= 80 else "NORMAL"))

        flow_lpm = detection_engine.latest_zone_flows.get(z.id, 0.0)
        valve_st = control_engine.current_valve_states.get(z.id, z.current_valve_state)

        results.append(ZoneCardData(
            zone_id=z.id,
            name=z.name,
            current_flow_lpm=round(flow_lpm, 2),
            consumed_today_l=round(consumed, 2),
            water_received_today_l=round(received, 2),
            zone_difference_l=round(diff, 2),
            allocated_today_l=round(allocated, 2),
            remaining_today_l=round(remaining, 2),
            usage_percentage=round(pct, 1),
            valve_state=valve_st,
            status=status
        ))
    return results


# --- 4. Consumption & Historical Analytics ---
@api_router.get("/consumption")
def get_consumption_analytics(db: Session = Depends(get_sync_session)):
    now = utc_now()
    today_str = datetime.date.today().isoformat()

    # 1. 24-hour hourly curve
    hourly_data = []
    for h in range(23, -1, -1):
        t_start = now - datetime.timedelta(hours=h+1)
        t_end = now - datetime.timedelta(hours=h)
        label = t_end.strftime("%H:00")

        # Query average flow for main and zones
        readings = db.query(
            SensorReading.metric_type,
            SensorReading.zone_id,
            func.avg(SensorReading.value).label("avg_val")
        ).filter(
            SensorReading.timestamp >= t_start,
            SensorReading.timestamp < t_end,
            SensorReading.metric_type == "flow_rate"
        ).group_by(SensorReading.zone_id).all()

        z1 = 0.0
        z2 = 0.0
        z3 = 0.0
        main_flow = 0.0
        for r in readings:
            if r.zone_id == 1:
                z1 = round(float(r.avg_val or 0.0), 2)
            elif r.zone_id == 2:
                z2 = round(float(r.avg_val or 0.0), 2)
            elif r.zone_id == 3:
                z3 = round(float(r.avg_val or 0.0), 2)
            elif r.zone_id is None:
                main_flow = round(float(r.avg_val or 0.0), 2)

        if main_flow == 0.0 and (z1 + z2 + z3) > 0.0:
            main_flow = round(z1 + z2 + z3, 2)

        hourly_data.append({
            "time": label,
            "main_flow": main_flow,
            "zone_1": z1,
            "zone_2": z2,
            "zone_3": z3,
            "sum_zones": round(z1 + z2 + z3, 2),
            "unaccounted": max(0.0, round(main_flow - (z1 + z2 + z3), 2))
        })

    # 2. Zone-wise consumption breakdown
    allocs = db.query(Allocation).filter_by(date=today_str).all()
    zone_breakdown = [
        {"name": f"Zone {a.zone_id}", "consumed": round(a.consumed_liters, 2), "allocated": round(a.allocated_liters, 2)}
        for a in allocs
    ]

    # 3. Tank Level over time (last 24 points)
    tank_readings = db.query(TankReading).order_by(desc(TankReading.timestamp)).limit(24).all()
    tank_trend = [
        {"time": tr.timestamp.strftime("%H:%M"), "level": round(tr.level_liters, 1), "pct": round(tr.level_percentage, 1)}
        for tr in reversed(tank_readings)
    ]

    return {
        "hourly_data": hourly_data,
        "zone_breakdown": zone_breakdown,
        "tank_trend": tank_trend
    }


# --- 5. Alerts Center ---
@api_router.get("/alerts", response_model=List[AlertResponse])
def get_alerts(active_only: bool = Query(False), db: Session = Depends(get_sync_session)):
    query = db.query(Alert)
    if active_only:
        query = query.filter(Alert.is_active.is_(True))
    alerts = query.order_by(desc(Alert.timestamp)).limit(100).all()
    return [AlertResponse.model_validate(a) for a in alerts]


@api_router.get("/alerts/active", response_model=List[AlertResponse])
def get_active_alerts(db: Session = Depends(get_sync_session)):
    alerts = db.query(Alert).filter(Alert.is_active.is_(True)).order_by(desc(Alert.timestamp)).all()
    return [AlertResponse.model_validate(a) for a in alerts]


@api_router.post("/alerts/{alert_id}/ack", response_model=AlertResponse)
def acknowledge_alert(alert_id: int, db: Session = Depends(get_sync_session)):
    alert = db.query(Alert).filter_by(id=alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged_at = utc_now()
    db.commit()
    db.refresh(alert)
    return AlertResponse.model_validate(alert)


@api_router.post("/alerts/{alert_id}/resolve", response_model=AlertResponse)
def resolve_alert(alert_id: int, db: Session = Depends(get_sync_session)):
    alert = db.query(Alert).filter_by(id=alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_active = False
    alert.resolved_at = utc_now()
    db.commit()
    db.refresh(alert)
    return AlertResponse.model_validate(alert)


# --- 6. Actuator Controls ---
@api_router.post("/control/pump", response_model=ActuatorStateResponse)
def control_pump(
    req: PumpControlRequest,
    db: Session = Depends(get_sync_session),
    admin_user: Optional[User] = Depends(check_admin_permission_or_unauthenticated_dev)
):
    reason_str = f"[{admin_user.email}] {req.reason}" if admin_user else (req.reason or "Manual dashboard action")
    control_engine.set_pump_state(
        session=db,
        state=req.state,
        source="MANUAL",
        reason=reason_str
    )
    return ActuatorStateResponse(
        pump=control_engine.current_pump_state,
        valves=control_engine.current_valve_states,
        last_action_timestamp=utc_now()
    )


@api_router.post("/control/valve/{zone_id}", response_model=ActuatorStateResponse)
def control_valve(
    zone_id: int,
    req: ValveControlRequest,
    db: Session = Depends(get_sync_session),
    admin_user: Optional[User] = Depends(check_admin_permission_or_unauthenticated_dev)
):
    if zone_id not in (1, 2, 3):
        raise HTTPException(status_code=400, detail="Invalid zone ID. Supported zones are 1, 2, 3.")
    reason_str = f"[{admin_user.email}] {req.reason}" if admin_user else (req.reason or "Manual dashboard action")
    control_engine.set_valve_state(
        session=db,
        zone_id=zone_id,
        state=req.state,
        source="MANUAL",
        reason=reason_str
    )
    return ActuatorStateResponse(
        pump=control_engine.current_pump_state,
        valves=control_engine.current_valve_states,
        last_action_timestamp=utc_now()
    )


@api_router.get("/control/status", response_model=ActuatorStateResponse)
def get_control_status():
    return ActuatorStateResponse(
        pump=control_engine.current_pump_state,
        valves=control_engine.current_valve_states,
        last_action_timestamp=utc_now()
    )


# --- 7. Allocations ---
@api_router.get("/allocations", response_model=List[AllocationResponse])
def get_allocations(db: Session = Depends(get_sync_session)):
    today_str = datetime.date.today().isoformat()
    allocs = db.query(Allocation).filter_by(date=today_str).all()
    return [AllocationResponse.model_validate(a) for a in allocs]


@api_router.put("/allocations/{zone_id}", response_model=AllocationResponse)
def update_allocation(
    zone_id: int,
    req: AllocationUpdate,
    db: Session = Depends(get_sync_session),
    admin_user: Optional[User] = Depends(check_admin_permission_or_unauthenticated_dev)
):
    today_str = datetime.date.today().isoformat()
    alloc = db.query(Allocation).filter_by(zone_id=zone_id, date=today_str).first()
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation record for today not found")

    alloc.allocated_liters = req.allocated_liters
    alloc.remaining_liters = max(0.0, round(alloc.allocated_liters - alloc.consumed_liters, 2))
    pct = (alloc.consumed_liters / alloc.allocated_liters) * 100.0 if alloc.allocated_liters > 0 else 0.0
    alloc.percentage_used = round(pct, 1)
    alloc.status = "EXCEEDED" if pct >= 100 else ("WARNING" if pct >= 80 else "NORMAL")
    db.commit()
    db.refresh(alloc)

    if admin_user:
        db.add(Event(
            timestamp=utc_now(),
            event_type="ALLOCATION_MODIFIED",
            details=f"[{admin_user.email}] Modified Zone {zone_id} daily allocation to {req.allocated_liters:.1f} L",
            source="ADMIN_ACTION"
        ))
        db.commit()

    return AllocationResponse.model_validate(alloc)


# --- 8. System & Readings ---
@api_router.get("/system/status")
def get_system_status(db: Session = Depends(get_sync_session)):
    detection_engine.evaluate_device_watchdog(db)
    devices = db.query(Device).all()
    from backend.app.mqtt.client import backend_mqtt

    return {
        "status": "HEALTHY",
        "mqtt_connected": backend_mqtt.is_connected,
        "database_connected": True,
        "devices": [DeviceResponse.model_validate(d) for d in devices],
        "active_scenario": _active_scenario,
        "timestamp": utc_now()
    }


@api_router.get("/readings/history")
def get_readings_history(
    metric: str = Query("flow_rate"),
    zone_id: Optional[int] = Query(None),
    limit: int = Query(50),
    db: Session = Depends(get_sync_session)
):
    query = db.query(SensorReading).filter(SensorReading.metric_type == metric)
    if zone_id is not None:
        query = query.filter(SensorReading.zone_id == zone_id)
    readings = query.order_by(desc(SensorReading.timestamp)).limit(limit).all()
    return readings


# --- 9. System Settings ---
@api_router.get("/settings", response_model=List[SystemSettingResponse])
def get_system_settings(db: Session = Depends(get_sync_session)):
    records = db.query(SystemSetting).all()
    return [SystemSettingResponse.model_validate(r) for r in records]


@api_router.put("/settings/{key}", response_model=SystemSettingResponse)
def update_system_setting(key: str, req: SystemSettingUpdate, db: Session = Depends(get_sync_session)):
    setting = db.query(SystemSetting).filter_by(key=key).first()
    if not setting:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")
    setting.value = req.value
    if req.description:
        setting.description = req.description
    db.commit()
    db.refresh(setting)
    return SystemSettingResponse.model_validate(setting)


# --- 10. Simulator Scenario Controls ---
@api_router.post("/simulator/scenario", response_model=Dict[str, Any])
def change_simulation_scenario(req: ScenarioChangeRequest):
    global _active_scenario
    _active_scenario = req.scenario.upper()

    from backend.app.mqtt.client import backend_mqtt
    # Dispatch scenario command to simulator via MQTT
    backend_mqtt.publish_message("aqua-nexus/simulator/scenario", {
        "scenario": _active_scenario,
        "zone_id": req.zone_id or 2,
        "timestamp": utc_now().isoformat()
    })

    return {
        "status": "SUCCESS",
        "active_scenario": _active_scenario,
        "message": f"Simulator scenario set to {_active_scenario}"
    }


@api_router.get("/simulator/status")
def get_simulator_status():
    global _active_scenario
    return {
        "active_scenario": _active_scenario,
        "inlet_flow_lpm": round(detection_engine.latest_main_flow, 2),
        "tank_level_liters": round(detection_engine.latest_tank_level, 2),
        "tank_level_pct": round(detection_engine.latest_tank_pct, 1),
        "zone_flows_lpm": {k: round(v, 2) for k, v in detection_engine.latest_zone_flows.items()},
        "pump_state": control_engine.current_pump_state,
        "valve_states": control_engine.current_valve_states
    }


# --- 11. WebSocket Telemetry Stream ---
@api_router.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keepalive / receive client pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)
