# AQUA-NEXUS Virtual IoT ESP32 Multi-Sensor Simulator

The simulator models physical ESP32 microcontrollers, water flow sensors (YF-S201), ultrasonic tank level sensors (HC-SR04), and relay-driven solenoid valves & submersible pumps.

## Topics Published

| Topic | Metric | Payload Schema |
|---|---|---|
| `aqua-nexus/tank/level` | Tank water volume & percentage | `{"level_liters": 75.2, "level_percentage": 75.2, ...}` |
| `aqua-nexus/tank/status` | Capacity, status, pump state | `{"status": "NORMAL", "pump_state": "ON", ...}` |
| `aqua-nexus/main/flow` | Inflow rate from main supply | `{"flow_rate_lpm": 3.0, "unit": "L/min", ...}` |
| `aqua-nexus/main/total` | Cumulative incoming volume | `{"total_volume_l": 120.5, ...}` |
| `aqua-nexus/zone/1/flow` | Zone 1 Flow rate | `{"zone_id": 1, "flow_rate_lpm": 1.0, ...}` |
| `aqua-nexus/zone/1/total`| Zone 1 Total volume consumed | `{"zone_id": 1, "total_volume_l": 22.5, ...}` |
| `aqua-nexus/zone/1/status`| Zone 1 Valve state & status | `{"zone_id": 1, "valve_state": "OPEN", ...}` |
| `aqua-nexus/zone/2/*` | Zone 2 Telemetry | Same as Zone 1 |
| `aqua-nexus/zone/3/*` | Zone 3 Telemetry | Same as Zone 1 |
| `aqua-nexus/device/+/status` | ESP32 Heartbeat | `{"device_id": "esp32-main", "status": "ONLINE", ...}` |

## Subscribed Control Topics

| Topic | Expected Payload | Effect |
|---|---|---|
| `aqua-nexus/control/pump` | `{"state": "ON"}` or `{"state": "OFF"}` | Sets pump state, affects inflow |
| `aqua-nexus/control/valve/1` | `{"state": "OPEN"}` or `{"state": "CLOSED"}` | Actuates Zone 1 valve |
| `aqua-nexus/control/valve/2` | `{"state": "OPEN"}` or `{"state": "CLOSED"}` | Actuates Zone 2 valve |
| `aqua-nexus/control/valve/3` | `{"state": "OPEN"}` or `{"state": "CLOSED"}` | Actuates Zone 3 valve |
| `aqua-nexus/simulator/scenario` | `{"scenario": "LEAK"}` | Switches simulation scenario |

## Supported Scenarios

1. **`NORMAL`**: Standard operation. Main flow matches sum of zone flows (~3.0 L/min).
2. **`LEAK`**: Pipe rupture simulation. Main flow = 5.2 L/min, zone sum = 3.0 L/min (~42% unaccounted water loss).
3. **`OVERFLOW`**: Tank filling rapidly (>7.5 L/min), approaches >90% capacity, testing auto pump shutoff.
4. **`LOW_LEVEL`**: Inflow dry, tank drains below 20% warning and 10% critical threshold.
5. **`EXCESSIVE_CONSUMPTION`**: Zone 2 flows at 8.5 L/min, consuming remaining daily allowance rapidly to trigger quota cutoff.
6. **`SENSOR_FAILURE`**: Zone 2 sensor goes silent, triggering watchdog detection and offline alert.
