"""
AQUA-NEXUS Control Engine
Handles automated actuator logic, safety interlocks, and manual operator overrides.
"""

import json
import logging
from typing import Optional, Dict, Any, Callable
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.models.models import (
    Zone,
    ValveState,
    PumpState,
    Event,
    utc_now
)

logger = logging.getLogger("AQUA-NEXUS-CONTROL")


class ControlEngine:
    def __init__(self, publish_mqtt_func: Optional[Callable[[str, Dict[str, Any]], None]] = None):
        self.publish_mqtt = publish_mqtt_func
        self.current_pump_state: str = "ON"
        self.current_valve_states: Dict[int, str] = {1: "OPEN", 2: "OPEN", 3: "OPEN"}

    def set_mqtt_publisher(self, publish_func: Callable[[str, Dict[str, Any]], None]):
        self.publish_mqtt = publish_func

    def dispatch_mqtt(self, topic: str, payload: Dict[str, Any]):
        if self.publish_mqtt:
            self.publish_mqtt(topic, payload)
        else:
            logger.warning(f"MQTT publisher not configured. Command dropped: [{topic}] -> {payload}")

    def evaluate_rules(
        self,
        session: Session,
        tank_pct: float,
        allocation_violations: Dict[int, str]
    ):
        """
        Executes automated control interlocks:
        1. Allocation exceeded -> close affected zone valve
        2. High tank level (overflow risk) -> stop filling pump
        3. Critical low tank level -> dry-run protection
        """
        # Rule 1: Allocation exceeded auto-cutoff
        if settings.auto_cutoff_valve_on_allocation:
            for zone_id, status in allocation_violations.items():
                if status == "EXCEEDED" and self.current_valve_states.get(zone_id) != "CLOSED":
                    logger.warning(f"Rule Triggered: Auto-closing Zone {zone_id} valve due to allocation breach.")
                    self.set_valve_state(
                        session=session,
                        zone_id=zone_id,
                        state="CLOSED",
                        source="AUTOMATIC",
                        reason=f"Quota exhausted: Zone {zone_id} exceeded daily allocation limit."
                    )

        # Rule 2: High tank level overflow protection
        if settings.auto_cutoff_pump_on_overflow:
            if tank_pct >= settings.tank_high_threshold_pct and self.current_pump_state == "ON":
                logger.warning(f"Rule Triggered: Auto-stopping pump due to tank level at {tank_pct:.1f}%.")
                self.set_pump_state(
                    session=session,
                    state="OFF",
                    source="AUTOMATIC",
                    reason=f"Overflow protection: Reservoir level ({tank_pct:.1f}%) reached high threshold."
                )

        # Rule 3: Dry-run pump protection on critical level
        if settings.auto_protect_pump_on_dry_run:
            if tank_pct <= settings.tank_critical_threshold_pct:
                logger.warning(f"Rule Triggered: Reservoir at critical reserve ({tank_pct:.1f}%).")

    def set_pump_state(
        self,
        session: Session,
        state: str,
        source: str = "MANUAL",
        reason: Optional[str] = None
    ) -> PumpState:
        state = state.upper()
        if state not in ("ON", "OFF"):
            raise ValueError("Pump state must be ON or OFF")

        self.current_pump_state = state
        now = utc_now()

        # Database record
        record = PumpState(
            timestamp=now,
            state=state,
            source=source,
            reason=reason or f"{source} command"
        )
        session.add(record)

        # Event log
        event = Event(
            timestamp=now,
            event_type="PUMP_COMMAND",
            details=f"Pump switched {state} by {source}. Reason: {reason}",
            source=source
        )
        session.add(event)
        session.commit()

        # Publish command to MQTT
        self.dispatch_mqtt("aqua-nexus/control/pump", {
            "state": state,
            "source": source,
            "reason": reason,
            "timestamp": now.isoformat()
        })

        return record

    def set_valve_state(
        self,
        session: Session,
        zone_id: int,
        state: str,
        source: str = "MANUAL",
        reason: Optional[str] = None
    ) -> ValveState:
        state = state.upper()
        if state not in ("OPEN", "CLOSED"):
            raise ValueError("Valve state must be OPEN or CLOSED")

        self.current_valve_states[zone_id] = state
        now = utc_now()

        # Update Zone current state
        zone = session.query(Zone).filter_by(id=zone_id).first()
        if zone:
            zone.current_valve_state = state

        # Database record
        record = ValveState(
            timestamp=now,
            zone_id=zone_id,
            state=state,
            source=source,
            reason=reason or f"{source} command"
        )
        session.add(record)

        # Event log
        event = Event(
            timestamp=now,
            event_type="VALVE_COMMAND",
            details=f"Zone {zone_id} valve switched {state} by {source}. Reason: {reason}",
            source=source
        )
        session.add(event)
        session.commit()

        # Publish command to MQTT
        self.dispatch_mqtt(f"aqua-nexus/control/valve/{zone_id}", {
            "zone_id": zone_id,
            "state": state,
            "source": source,
            "reason": reason,
            "timestamp": now.isoformat()
        })

        return record


control_engine = ControlEngine()
