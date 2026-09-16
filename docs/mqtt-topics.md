# AQUA-NEXUS MQTT Topics & Protocol Specification

This document defines the formal MQTT communication contract between edge microcontrollers (ESP32 / Virtual Simulator) and the AQUA-NEXUS processing backend.

---

## 1. Topic Hierarchy Architecture

```
aqua-nexus/
├── tank/
│   ├── level                 [Telemetry] Reservoir volume and depth
│   └── status                [Telemetry] Operating status and pump link
├── main/
│   ├── flow                  [Telemetry] Main inlet flow rate (L/min)
│   └── total                 [Telemetry] Cumulative inlet volume (L)
├── zone/
│   ├── 1/
│   │   ├── flow              [Telemetry] Zone 1 flow rate
│   │   ├── total             [Telemetry] Zone 1 cumulative volume
│   │   └── status            [Telemetry] Zone 1 valve state & status
│   ├── 2/
│   │   ├── flow              [Telemetry] Zone 2 flow rate
│   │   ├── total             [Telemetry] Zone 2 cumulative volume
│   │   └── status            [Telemetry] Zone 2 valve state & status
│   └── 3/
│       ├── flow              [Telemetry] Zone 3 flow rate
│       ├── total             [Telemetry] Zone 3 cumulative volume
│       └── status            [Telemetry] Zone 3 valve state & status
├── device/
│   └── {device_id}/
│       └── status            [Heartbeat] Node connectivity and health
├── control/
│   ├── pump                  [Command] Primary booster pump (ON / OFF)
│   └── valve/
│       └── {zone_id}         [Command] Solenoid valve (OPEN / CLOSED)
├── simulator/
│   └── scenario              [Command] Demo scenario trigger
├── alerts                    [Notification] System-wide broadcast alerts
└── events                    [Audit] Actuation and event logging
```

---

## 2. Topic Catalog

| Topic | Direction | QoS | Interval | Description |
|---|---|---|---|---|
| `aqua-nexus/tank/level` | Sensor → Backend | 0 | 1.0s | Reservoir water level, percentage, and ultrasonic depth |
| `aqua-nexus/tank/status` | Sensor → Backend | 0 | 1.0s | Tank capacity, state, and associated pump state |
| `aqua-nexus/main/flow` | Sensor → Backend | 0 | 1.0s | Instantaneous municipal inlet flow rate |
| `aqua-nexus/main/total` | Sensor → Backend | 0 | 1.0s | Total cumulative water delivered to system |
| `aqua-nexus/zone/{id}/flow` | Sensor → Backend | 0 | 1.0s | Instantaneous flow rate for specific zone |
| `aqua-nexus/zone/{id}/total`| Sensor → Backend | 0 | 1.0s | Total cumulative water consumed by zone |
| `aqua-nexus/zone/{id}/status`| Sensor → Backend | 0 | 1.0s | Zone solenoid valve state (`OPEN` / `CLOSED`) |
| `aqua-nexus/device/{id}/status` | Sensor → Backend | 0 | 5.0s | Node heartbeat watchdog ping |
| `aqua-nexus/control/pump` | Backend → Actuator | 1 | On-Demand | Booster pump control (`ON` / `OFF`) |
| `aqua-nexus/control/valve/{id}` | Backend → Actuator | 1 | On-Demand | Solenoid valve control (`OPEN` / `CLOSED`) |
| `aqua-nexus/simulator/scenario` | Backend → Simulator| 1 | On-Demand | Demo scenario selector |

---

## 3. Payload Schemas & Examples

### 3.1 Tank Level Telemetry (`aqua-nexus/tank/level`)
```json
{
  "device_id": "esp32-main",
  "level_liters": 75.20,
  "level_percentage": 75.2,
  "raw_height_cm": 24.8,
  "timestamp": "2026-09-08T10:00:00Z"
}
```

### 3.2 Main Inlet Flow Rate (`aqua-nexus/main/flow`)
```json
{
  "device_id": "esp32-main",
  "flow_rate_lpm": 3.02,
  "unit": "L/min",
  "timestamp": "2026-09-08T10:00:00Z"
}
```

### 3.3 Zone Flow & Cumulative Volume (`aqua-nexus/zone/2/flow` & `.../total`)
```json
{
  "device_id": "esp32-zone1-2",
  "zone_id": 2,
  "flow_rate_lpm": 1.25,
  "timestamp": "2026-09-08T10:00:00Z"
}
```
```json
{
  "device_id": "esp32-zone1-2",
  "zone_id": 2,
  "total_volume_l": 26.50,
  "timestamp": "2026-09-08T10:00:00Z"
}
```

### 3.4 Pump Actuation Command (`aqua-nexus/control/pump`)
```json
{
  "state": "OFF",
  "source": "AUTOMATIC",
  "reason": "Overflow protection: Reservoir level reached 92%",
  "timestamp": "2026-09-08T10:00:05Z"
}
```

### 3.5 Valve Actuation Command (`aqua-nexus/control/valve/2`)
```json
{
  "zone_id": 2,
  "state": "CLOSED",
  "source": "AUTOMATIC",
  "reason": "Quota exhausted: Zone 2 exceeded daily allocation",
  "timestamp": "2026-09-08T10:00:10Z"
}
```

### 3.6 Microcontroller Heartbeat (`aqua-nexus/device/esp32-main/status`)
```json
{
  "device_id": "esp32-main",
  "status": "ONLINE",
  "ip_address": "192.168.1.101",
  "firmware_version": "v1.2.0-aqua",
  "uptime_seconds": 3600,
  "timestamp": "2026-09-08T10:00:00Z"
}
```
