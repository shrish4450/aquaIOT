"""
AQUA-NEXUS Database Seed Script
Creates database tables and populates realistic zones, allocations, settings, devices,
and 24-hour historical telemetry curves for instant visualization.
"""

import datetime
import random
from sqlalchemy.orm import Session

from backend.app.database import sync_engine, SyncSessionLocal, Base
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
    User
)
from sqlalchemy import text
from backend.app.auth.security import hash_password


def run_migrations():
    """Applies non-destructive column additions to existing SQLite tables if they exist."""
    with sync_engine.connect() as conn:
        try:
            alloc_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(allocations)")).fetchall()]
            if alloc_cols:
                if "water_received_liters" not in alloc_cols:
                    conn.execute(text("ALTER TABLE allocations ADD COLUMN water_received_liters FLOAT DEFAULT 0.0"))
                if "zone_difference_liters" not in alloc_cols:
                    conn.execute(text("ALTER TABLE allocations ADD COLUMN zone_difference_liters FLOAT DEFAULT 0.0"))

            alert_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(alerts)")).fetchall()]
            if alert_cols:
                if "is_facility_wide" not in alert_cols:
                    conn.execute(text("ALTER TABLE alerts ADD COLUMN is_facility_wide BOOLEAN DEFAULT 0"))

            user_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()]
            if user_cols:
                if "last_login" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN last_login DATETIME"))

            conn.commit()
        except Exception as e:
            print(f"Migration notice: {e}")


def seed_database():
    print("Applying schema migrations...")
    run_migrations()
    print("Creating all database tables...")
    Base.metadata.create_all(bind=sync_engine)

    session: Session = SyncSessionLocal()
    try:
        # 1. System Settings
        default_settings = [
            ("tank_capacity_liters", "100.0", "Total storage capacity of the primary reservoir in liters"),
            ("tank_high_threshold_pct", "90.0", "Overflow warning threshold percentage"),
            ("tank_low_threshold_pct", "20.0", "Low level warning threshold percentage"),
            ("tank_critical_threshold_pct", "10.0", "Critical emergency cutoff threshold percentage"),
            ("unaccounted_warning_pct", "5.0", "Threshold for warning level water loss discrepancy"),
            ("unaccounted_leak_pct", "10.0", "Threshold for possible pipe leakage classification"),
            ("allocation_warning_pct", "80.0", "Percentage of daily allocation that triggers a warning"),
            ("device_offline_timeout_sec", "10", "Heartbeat timeout before marking node OFFLINE"),
            ("auto_cutoff_valve_on_allocation", "true", "Automatically close zone valve when quota exceeded"),
            ("auto_cutoff_pump_on_overflow", "true", "Automatically stop pump when tank reaches high threshold"),
            ("auto_protect_pump_on_dry_run", "true", "Automatically protect pump on critical low tank level"),
        ]

        for key, val, desc in default_settings:
            existing = session.query(SystemSetting).filter_by(key=key).first()
            if not existing:
                session.add(SystemSetting(key=key, value=val, description=desc))

        session.commit()

        # 2. Zones
        zones_data = [
            (1, "A Wing", "A Wing distribution sector", 50.0),
            (2, "B Wing", "B Wing distribution sector", 40.0),
            (3, "C Wing", "C Wing distribution sector", 60.0),
        ]

        for z_id, name, desc, alloc in zones_data:
            zone = session.query(Zone).filter_by(id=z_id).first()
            if not zone:
                zone = Zone(
                    id=z_id,
                    name=name,
                    description=desc,
                    target_allocation_liters=alloc,
                    current_valve_state="OPEN"
                )
                session.add(zone)
            else:
                zone.name = name
                zone.description = desc

        session.commit()

        # 3. Devices
        devices_data = [
            ("esp32-main", "ESP32 Primary Reservoir Node", "ESP32", None, "ONLINE", "192.168.1.101"),
            ("esp32-zone1-2", "ESP32 Multi-Zone Controller A", "ESP32", 1, "ONLINE", "192.168.1.102"),
            ("esp32-zone3", "ESP32 Irrigation Controller B", "ESP32", 3, "ONLINE", "192.168.1.103"),
        ]

        for d_id, name, dtype, z_id, status, ip in devices_data:
            dev = session.query(Device).filter_by(id=d_id).first()
            if not dev:
                dev = Device(
                    id=d_id,
                    name=name,
                    device_type=dtype,
                    zone_id=z_id,
                    status=status,
                    ip_address=ip,
                    last_seen=datetime.datetime.now(datetime.timezone.utc)
                )
                session.add(dev)

        session.commit()

        # 4. Today's Allocations
        today_str = datetime.date.today().isoformat()
        initial_allocs = [
            (1, 50.0, 22.5, 25.0),
            (2, 40.0, 26.0, 28.5),
            (3, 60.0, 18.0, 20.0),
        ]

        for z_id, allocated, consumed, received in initial_allocs:
            alloc_entry = session.query(Allocation).filter_by(zone_id=z_id, date=today_str).first()
            diff = round(received - consumed, 2)
            remaining = max(0.0, allocated - consumed)
            pct = round((consumed / allocated) * 100, 1)
            status = "EXCEEDED" if pct >= 100 else ("WARNING" if pct >= 80 else "NORMAL")
            
            if not alloc_entry:
                session.add(Allocation(
                    zone_id=z_id,
                    date=today_str,
                    allocated_liters=allocated,
                    consumed_liters=consumed,
                    water_received_liters=received,
                    zone_difference_liters=diff,
                    remaining_liters=remaining,
                    percentage_used=pct,
                    status=status
                ))
            else:
                if not alloc_entry.water_received_liters:
                    alloc_entry.water_received_liters = received
                    alloc_entry.zone_difference_liters = diff

        session.commit()

        # 4b. Seed Demo Users
        demo_users = [
            ("admin@aquanexus.local", "Facility Administrator", "ADMIN", None, "Admin@123"),
            ("zone1@aquanexus.local", "A Wing User", "ZONE_USER", 1, "Zone1@123"),
            ("zone2@aquanexus.local", "B Wing User", "ZONE_USER", 2, "Zone2@123"),
            ("zone3@aquanexus.local", "C Wing User", "ZONE_USER", 3, "Zone3@123"),
        ]

        for email, full_name, role, zone_id, password in demo_users:
            user = session.query(User).filter_by(email=email).first()
            if not user:
                user = User(
                    email=email,
                    full_name=full_name,
                    role=role,
                    zone_id=zone_id,
                    hashed_password=hash_password(password),
                    status="ACTIVE"
                )
                session.add(user)
            else:
                user.full_name = full_name
                user.role = role
                user.zone_id = zone_id
                user.status = "ACTIVE"
                user.hashed_password = hash_password(password)

        session.commit()

        # 5. Initial Actuator and Tank Records
        now = datetime.datetime.now(datetime.timezone.utc)
        if session.query(TankReading).count() == 0:
            session.add(TankReading(
                timestamp=now,
                level_liters=75.0,
                level_percentage=75.0,
                raw_height_cm=25.0
            ))

        if session.query(PumpState).count() == 0:
            session.add(PumpState(
                timestamp=now,
                state="ON",
                source="AUTOMATIC",
                reason="System startup sequence"
            ))

        for z_id in (1, 2, 3):
            if session.query(ValveState).filter_by(zone_id=z_id).count() == 0:
                session.add(ValveState(
                    timestamp=now,
                    zone_id=z_id,
                    state="OPEN",
                    source="AUTOMATIC",
                    reason="Initial zone feed enabled"
                ))

        # 6. Generate 24-Hour Historical Readings
        if session.query(SensorReading).count() == 0:
            print("Generating 24-hour realistic historical telemetry...")
            for hour in range(24, 0, -1):
                t_point = now - datetime.timedelta(hours=hour)
                # Realistic hourly curve (peaks around morning 8-10 AM and evening 6-9 PM)
                hour_of_day = t_point.hour
                diurnal_factor = 1.0
                if 7 <= hour_of_day <= 10:
                    diurnal_factor = 1.8
                elif 18 <= hour_of_day <= 21:
                    diurnal_factor = 1.5
                elif 0 <= hour_of_day <= 5:
                    diurnal_factor = 0.3

                z1_flow = round(1.0 * diurnal_factor + random.uniform(-0.1, 0.1), 2)
                z2_flow = round(1.2 * diurnal_factor + random.uniform(-0.1, 0.1), 2)
                z3_flow = round(0.8 * diurnal_factor + random.uniform(-0.1, 0.1), 2)
                main_flow = round((z1_flow + z2_flow + z3_flow) * (1.0 + random.uniform(0.01, 0.03)), 2)

                session.add(SensorReading(
                    timestamp=t_point,
                    device_id="esp32-main",
                    zone_id=None,
                    metric_type="flow_rate",
                    value=main_flow,
                    unit="L/min"
                ))
                session.add(SensorReading(
                    timestamp=t_point,
                    device_id="esp32-zone1-2",
                    zone_id=1,
                    metric_type="flow_rate",
                    value=z1_flow,
                    unit="L/min"
                ))
                session.add(SensorReading(
                    timestamp=t_point,
                    device_id="esp32-zone1-2",
                    zone_id=2,
                    metric_type="flow_rate",
                    value=z2_flow,
                    unit="L/min"
                ))
                session.add(SensorReading(
                    timestamp=t_point,
                    device_id="esp32-zone3",
                    zone_id=3,
                    metric_type="flow_rate",
                    value=z3_flow,
                    unit="L/min"
                ))

                # Historical Tank level points
                level = round(70.0 + 10.0 * random.uniform(-1, 1), 1)
                session.add(TankReading(
                    timestamp=t_point,
                    level_liters=level,
                    level_percentage=level,
                    raw_height_cm=100.0 - level
                ))

        # Initial Events
        if session.query(Event).count() == 0:
            session.add(Event(
                timestamp=now,
                event_type="SYSTEM_INITIALIZED",
                details="AQUA-NEXUS database tables initialized with baseline parameters",
                source="SEED_SCRIPT"
            ))

        session.commit()
        print("Database seed completed successfully.")

    except Exception as e:
        session.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    seed_database()
