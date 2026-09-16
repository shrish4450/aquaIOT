"""
AQUA-NEXUS Pydantic Schemas
Data validation contracts for REST APIs and WebSocket messages.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


# --- Device Schemas ---
class DeviceBase(BaseModel):
    id: str
    name: str
    device_type: str = "ESP32"
    zone_id: Optional[int] = None
    status: str = "ONLINE"
    ip_address: Optional[str] = None
    firmware_version: Optional[str] = None


class DeviceResponse(DeviceBase):
    last_seen: datetime
    model_config = ConfigDict(from_attributes=True)



# --- Zone Schemas ---
class ZoneBase(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    target_allocation_liters: float = Field(..., ge=0.0)
    current_valve_state: str = "OPEN"


class ZoneResponse(ZoneBase):
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ZoneCardData(BaseModel):
    zone_id: int
    name: str
    current_flow_lpm: float
    consumed_today_l: float
    water_received_today_l: float = 0.0
    zone_difference_l: float = 0.0
    allocated_today_l: float
    remaining_today_l: float
    usage_percentage: float
    valve_state: str
    status: str  # NORMAL, WARNING, EXCEEDED



# --- Telemetry & Sensor Schemas ---
class SensorReadingCreate(BaseModel):
    device_id: str
    zone_id: Optional[int] = None
    metric_type: str
    value: float
    unit: str = "L/min"
    timestamp: Optional[datetime] = None


class SensorReadingResponse(SensorReadingCreate):
    id: int
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)


class TankReadingCreate(BaseModel):
    level_liters: float
    level_percentage: float
    raw_height_cm: Optional[float] = None
    timestamp: Optional[datetime] = None


class TankReadingResponse(TankReadingCreate):
    id: int
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)


class TankStatusResponse(BaseModel):
    capacity_liters: float
    current_level_liters: float
    level_percentage: float
    remaining_capacity_liters: float
    high_threshold_pct: float
    low_threshold_pct: float
    critical_threshold_pct: float
    pump_state: str
    status: str  # NORMAL, HIGH, LOW, CRITICAL
    last_updated: datetime


# --- Allocation Schemas ---
class AllocationBase(BaseModel):
    zone_id: int
    date: str
    allocated_liters: float
    consumed_liters: float = 0.0
    water_received_liters: float = 0.0
    zone_difference_liters: float = 0.0


class AllocationUpdate(BaseModel):
    allocated_liters: float = Field(..., gt=0.0)


class AllocationResponse(AllocationBase):
    id: int
    remaining_liters: float
    percentage_used: float
    status: str
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Control & Actuators ---
class PumpControlRequest(BaseModel):
    state: str = Field(..., pattern="^(ON|OFF)$")
    reason: Optional[str] = "Manual operator action"


class ValveControlRequest(BaseModel):
    state: str = Field(..., pattern="^(OPEN|CLOSED)$")
    reason: Optional[str] = "Manual operator action"


class ActuatorStateResponse(BaseModel):
    pump: str
    valves: Dict[int, str]
    last_action_timestamp: datetime


# --- Alert Schemas ---
class AlertResponse(BaseModel):
    id: int
    alert_type: str
    severity: str
    message: str
    zone_id: Optional[int] = None
    device_id: Optional[str] = None
    timestamp: datetime
    is_active: bool
    is_facility_wide: bool = False
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# --- System & Event Schemas ---
class EventResponse(BaseModel):
    id: int
    timestamp: datetime
    event_type: str
    details: str
    source: str
    model_config = ConfigDict(from_attributes=True)


class SystemSettingUpdate(BaseModel):
    value: str
    description: Optional[str] = None


class SystemSettingResponse(BaseModel):
    key: str
    value: str
    description: Optional[str] = None
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)



# --- Water Accountability ---
class WaterAccountabilityMetrics(BaseModel):
    total_incoming_liters: float
    total_consumed_liters: float
    unaccounted_liters: float
    unaccounted_percentage: float
    status: str  # NORMAL, WARNING, POSSIBLE_LEAK, CRITICAL
    threshold_warning_pct: float
    threshold_leak_pct: float


# --- Dashboard Overview Aggregation ---
class DashboardSummaryResponse(BaseModel):
    timestamp: datetime
    active_scenario: str
    mqtt_connected: bool
    tank: TankStatusResponse
    accountability: WaterAccountabilityMetrics
    active_alerts_count: int
    critical_alerts_count: int
    pump_state: str
    zones: List[ZoneCardData]
    devices: List[DeviceResponse]
    recent_alerts: List[AlertResponse]


# --- Scenario Controls ---
class ScenarioChangeRequest(BaseModel):
    scenario: str = Field(
        ...,
        pattern="^(NORMAL|LEAK|OVERFLOW|LOW_LEVEL|EXCESSIVE_CONSUMPTION|SENSOR_FAILURE)$"
    )
    zone_id: Optional[int] = 2


class SimulatorStatusResponse(BaseModel):
    active_scenario: str
    inlet_flow_lpm: float
    tank_level_liters: float
    tank_level_pct: float
    zone_flows_lpm: Dict[int, float]
    pump_state: str
    valve_states: Dict[int, str]
    uptime_seconds: float


# --- User & Auth Schemas ---
class UserBase(BaseModel):
    email: str
    full_name: str
    role: str = "ZONE_USER"  # ADMIN or ZONE_USER
    zone_id: Optional[int] = None
    status: str = "ACTIVE"  # ACTIVE or INACTIVE


class UserCreateRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=6)
    full_name: str
    role: str = "ZONE_USER"
    zone_id: Optional[int] = None


class UserUpdateRequest(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    zone_id: Optional[int] = None
    status: Optional[str] = None
    password: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    zone_id: Optional[int] = None
    zone_name: Optional[str] = None
    status: str
    created_at: datetime
    last_login: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# --- Zone User Portal Schemas ---
class ZoneUserDashboardResponse(BaseModel):
    zone_id: int
    zone_name: str
    user_name: str
    user_email: str
    water_received_today_l: float
    water_consumed_today_l: float
    zone_difference_l: float
    allocated_today_l: float
    remaining_allocation_l: float
    usage_percentage: float
    current_flow_lpm: float
    valve_state: str  # OPEN, CLOSED
    supply_status: str  # AVAILABLE, INTERRUPTED, RESTRICTED
    zone_status: str  # NORMAL, WARNING, CRITICAL, EXCEEDED
    recent_readings: List[Dict[str, Any]]
    active_alerts: List[AlertResponse]


class ZoneUserHistoryResponse(BaseModel):
    zone_id: int
    zone_name: str
    range: str  # TODAY, YESTERDAY, 7DAYS, 30DAYS
    total_received_l: float
    total_consumed_l: float
    total_difference_l: float
    allocation_l: float
    usage_percentage: float
    average_daily_l: float
    peak_flow_lpm: float
    current_flow_lpm: float
    data_points: List[Dict[str, Any]]


class AdminZoneDetailResponse(BaseModel):
    zone_id: int
    name: str
    description: Optional[str] = None
    assigned_user: Optional[UserResponse] = None
    current_flow_lpm: float
    water_received_today_l: float
    water_consumed_today_l: float
    zone_difference_l: float
    allocated_today_l: float
    remaining_today_l: float
    usage_percentage: float
    valve_state: str
    status: str
    recent_readings: List[Dict[str, Any]]
    alerts: List[AlertResponse]

