# AQUA-NEXUS Database Schema & Storage Layer

AQUA-NEXUS uses SQLAlchemy 2.0 ORM with SQLite for the college prototype, structured cleanly so that it can be effortlessly transitioned to PostgreSQL for municipal-scale production.

## Relational Architecture

- **`devices`**: Tracks ESP32 nodes (`esp32-main`, `esp32-zone1-2`, `esp32-zone3`), online status, IP address, and last-seen heartbeats.
- **`zones`**: Defines physical water distribution zones (Zone 1 Residential, Zone 2 Commercial, Zone 3 Irrigation), allocation budgets, and solenoid valve states.
- **`sensor_readings`**: High-resolution time-series records for flow rates (L/min) and total cumulative volume (L).
- **`tank_readings`**: Water level percentage, volume in liters, and ultrasonic distance.
- **`allocations`**: Daily water quota allocations, cumulative consumption, remaining allowance, and violation status.
- **`valve_states` & `pump_states`**: Actuator event history, recording state transitions (`OPEN`/`CLOSED`, `ON`/`OFF`), trigger sources (`AUTOMATIC`/`MANUAL`), and safety reasons.
- **`alerts`**: Incident audit trail for leaks, overflows, dry-run conditions, excessive consumption, and sensor offline states.
- **`events`**: System audit log.
- **`system_settings`**: Dynamic operational parameters (thresholds, auto-cutoff toggles).
