"""
AQUA-NEXUS Detection & Water Accountability Engine
Implements flow mass balance, leak classification, quota tracking, and threshold watchdogs.
"""

import datetime
from typing import Dict, Any, Optional, Tuple, List
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.models.models import (
    Device,
    Zone,
    SensorReading,
    TankReading,
    Allocation,
    Alert,
    Event,
    utc_now
)


class DetectionEngine:
    def __init__(self):
        # Rolling cache of recent readings for fast evaluation
        self.latest_main_flow: float = 0.0
        self.latest_zone_flows: Dict[int, float] = {1: 0.0, 2: 0.0, 3: 0.0}
        self.latest_main_total: float = 120.0
        self.latest_zone_totals: Dict[int, float] = {1: 22.5, 2: 26.0, 3: 18.0}
        self.latest_tank_level: float = 75.0
        self.latest_tank_pct: float = 75.0

    @staticmethod
    def calculate_accountability(
        total_incoming: float,
        total_consumed: float,
        warning_thresh_pct: float = 5.0,
        leak_thresh_pct: float = 10.0
    ) -> Dict[str, Any]:
        """
        Calculates unaccounted water and percentage, with division-by-zero protection.
        Formula:
            unaccounted_water = total_incoming_water - total_zone_consumption
            unaccounted_percentage = (unaccounted_water / total_incoming_water) * 100
        """
        unaccounted = max(0.0, total_incoming - total_consumed)
        if total_incoming <= 0.001:
            percentage = 0.0
        else:
            percentage = (unaccounted / total_incoming) * 100.0

        percentage = round(percentage, 2)
        unaccounted = round(unaccounted, 2)

        # Classification
        if percentage < warning_thresh_pct:
            status = "NORMAL"
        elif percentage < leak_thresh_pct:
            status = "WARNING"
        elif percentage < 25.0:
            status = "POSSIBLE_LEAK"
        else:
            status = "CRITICAL"

        return {
            "total_incoming_liters": round(total_incoming, 2),
            "total_consumed_liters": round(total_consumed, 2),
            "unaccounted_liters": unaccounted,
            "unaccounted_percentage": percentage,
            "status": status,
            "threshold_warning_pct": warning_thresh_pct,
            "threshold_leak_pct": leak_thresh_pct
        }

    def evaluate_flow_balance(self, session: Session) -> Optional[Alert]:
        """
        Evaluates instantaneous flow rates across the main inlet and all zones.
        If main flow substantially exceeds the sum of zone flows, creates an active LEAKAGE alert.
        """
        sum_zone_flows = sum(self.latest_zone_flows.values())
        diff = self.latest_main_flow - sum_zone_flows

        if self.latest_main_flow > 1.0 and diff > 0.8:
            discrepancy_pct = (diff / self.latest_main_flow) * 100.0
            if discrepancy_pct >= settings.unaccounted_leak_pct:
                severity = "CRITICAL" if discrepancy_pct >= 30.0 else "WARNING"
                msg = (
                    f"Flow imbalance detected: Main inlet is {self.latest_main_flow:.2f} L/min, "
                    f"zones consuming {sum_zone_flows:.2f} L/min. Loss: {diff:.2f} L/min ({discrepancy_pct:.1f}%)."
                )
                return self.get_or_create_alert(
                    session=session,
                    alert_type="LEAKAGE",
                    severity=severity,
                    message=msg,
                    zone_id=None,
                    device_id="esp32-main"
                )
        else:
            # Resolve existing active LEAKAGE alert if discrepancy cleared
            self.resolve_alert_type(session, "LEAKAGE")

        return None

    def evaluate_tank_level(self, session: Session, level_pct: float) -> Optional[Alert]:
        """
        Evaluates tank level against high (overflow), low, and critical thresholds.
        """
        self.latest_tank_pct = level_pct
        high_thresh = settings.tank_high_threshold_pct
        low_thresh = settings.tank_low_threshold_pct
        crit_thresh = settings.tank_critical_threshold_pct

        alert = None
        if level_pct >= high_thresh:
            alert = self.get_or_create_alert(
                session=session,
                alert_type="OVERFLOW",
                severity="WARNING" if level_pct < 96.0 else "CRITICAL",
                message=f"Storage reservoir level at {level_pct:.1f}% exceeds safe limit ({high_thresh:.0f}%). Overflow risk!",
                zone_id=None,
                device_id="esp32-main"
            )
        else:
            self.resolve_alert_type(session, "OVERFLOW")

        if level_pct <= crit_thresh:
            alert = self.get_or_create_alert(
                session=session,
                alert_type="CRITICAL_LEVEL",
                severity="CRITICAL",
                message=f"Storage reservoir level at {level_pct:.1f}% has reached critical reserve ({crit_thresh:.0f}%). Dry-run danger!",
                zone_id=None,
                device_id="esp32-main"
            )
        elif level_pct <= low_thresh:
            alert = self.get_or_create_alert(
                session=session,
                alert_type="LOW_LEVEL",
                severity="WARNING",
                message=f"Storage reservoir level at {level_pct:.1f}% is below warning threshold ({low_thresh:.0f}%).",
                zone_id=None,
                device_id="esp32-main"
            )
        else:
            self.resolve_alert_type(session, "CRITICAL_LEVEL")
            self.resolve_alert_type(session, "LOW_LEVEL")

        return alert

    def evaluate_zone_allocation(self, session: Session, zone_id: int, total_consumed: float) -> Tuple[Allocation, Optional[Alert]]:
        """
        Tracks zone consumption against today's allocation budget.
        Triggers WARNING at allocation_warning_pct (default 80%) and CRITICAL at 100%.
        """
        today_str = datetime.date.today().isoformat()
        allocation = session.query(Allocation).filter_by(zone_id=zone_id, date=today_str).first()
        if not allocation:
            zone = session.query(Zone).filter_by(id=zone_id).first()
            target_alloc = zone.target_allocation_liters if zone else 50.0
            allocation = Allocation(
                zone_id=zone_id,
                date=today_str,
                allocated_liters=target_alloc,
                consumed_liters=total_consumed,
                remaining_liters=max(0.0, target_alloc - total_consumed),
                percentage_used=round((total_consumed / target_alloc) * 100, 1),
                status="NORMAL"
            )
            session.add(allocation)
            session.commit()

        # Update consumed
        allocation.consumed_liters = round(total_consumed, 2)
        allocation.remaining_liters = max(0.0, round(allocation.allocated_liters - total_consumed, 2))
        pct = (total_consumed / allocation.allocated_liters) * 100.0 if allocation.allocated_liters > 0 else 0.0
        allocation.percentage_used = round(pct, 1)

        alert = None
        if pct >= 100.0:
            allocation.status = "EXCEEDED"
            alert = self.get_or_create_alert(
                session=session,
                alert_type="ALLOCATION_EXCEEDED",
                severity="CRITICAL",
                message=f"Zone {zone_id} has exhausted daily allocation ({total_consumed:.1f}L / {allocation.allocated_liters:.1f}L - {pct:.1f}%).",
                zone_id=zone_id,
                device_id=None
            )
        elif pct >= settings.allocation_warning_pct:
            allocation.status = "WARNING"
            alert = self.get_or_create_alert(
                session=session,
                alert_type="EXCESSIVE_CONSUMPTION",
                severity="WARNING",
                message=f"Zone {zone_id} consumption at {pct:.1f}% ({total_consumed:.1f}L / {allocation.allocated_liters:.1f}L) approaching limit.",
                zone_id=zone_id,
                device_id=None
            )
        else:
            allocation.status = "NORMAL"
            self.resolve_alert_type(session, "ALLOCATION_EXCEEDED", zone_id=zone_id)
            self.resolve_alert_type(session, "EXCESSIVE_CONSUMPTION", zone_id=zone_id)

        session.commit()
        return allocation, alert

    def evaluate_device_watchdog(self, session: Session) -> List[Alert]:
        """
        Scans all registered devices. If last_seen exceeds timeout, marks device OFFLINE and raises alert.
        """
        now = utc_now()
        timeout_delta = datetime.timedelta(seconds=settings.device_offline_timeout_sec)
        devices = session.query(Device).all()
        generated_alerts = []

        for dev in devices:
            if dev.last_seen:
                # Ensure tz aware comparison
                last_seen_tz = dev.last_seen if dev.last_seen.tzinfo else dev.last_seen.replace(tzinfo=datetime.timezone.utc)
                if (now - last_seen_tz) > timeout_delta:
                    if dev.status != "OFFLINE":
                        dev.status = "OFFLINE"
                        session.commit()
                        alert = self.get_or_create_alert(
                            session=session,
                            alert_type="DEVICE_OFFLINE",
                            severity="CRITICAL",
                            message=f"Device '{dev.name}' ({dev.id}) offline! No telemetry received for >{settings.device_offline_timeout_sec}s.",
                            zone_id=dev.zone_id,
                            device_id=dev.id
                        )
                        if alert:
                            generated_alerts.append(alert)
                else:
                    if dev.status == "OFFLINE":
                        dev.status = "ONLINE"
                        session.commit()
                        self.resolve_alert_type(session, "DEVICE_OFFLINE", device_id=dev.id)

        return generated_alerts

    @staticmethod
    def get_or_create_alert(
        session: Session,
        alert_type: str,
        severity: str,
        message: str,
        zone_id: Optional[int] = None,
        device_id: Optional[str] = None
    ) -> Alert:
        """Finds existing active alert of same type & zone/device to avoid spam, or creates a new one."""
        query = session.query(Alert).filter(
            Alert.alert_type == alert_type,
            Alert.is_active.is_(True)
        )
        if zone_id is not None:
            query = query.filter(Alert.zone_id == zone_id)
        if device_id is not None:
            query = query.filter(Alert.device_id == device_id)

        existing = query.first()
        if existing:
            # Update message / timestamp
            existing.message = message
            existing.severity = severity
            existing.timestamp = utc_now()
            session.commit()
            return existing

        new_alert = Alert(
            alert_type=alert_type,
            severity=severity,
            message=message,
            zone_id=zone_id,
            device_id=device_id,
            timestamp=utc_now(),
            is_active=True
        )
        session.add(new_alert)
        session.commit()
        return new_alert

    @staticmethod
    def resolve_alert_type(
        session: Session,
        alert_type: str,
        zone_id: Optional[int] = None,
        device_id: Optional[str] = None
    ):
        """Resolves active alerts of specified type when condition clears."""
        query = session.query(Alert).filter(
            Alert.alert_type == alert_type,
            Alert.is_active.is_(True)
        )
        if zone_id is not None:
            query = query.filter(Alert.zone_id == zone_id)
        if device_id is not None:
            query = query.filter(Alert.device_id == device_id)

        alerts = query.all()
        for a in alerts:
            a.is_active = False
            a.resolved_at = utc_now()
        if alerts:
            session.commit()


detection_engine = DetectionEngine()
