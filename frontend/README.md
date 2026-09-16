# AQUA-NEXUS Frontend Dashboard

A modern, high-craft Cyber-Hydro IoT telemetry dashboard built with React 19, Vite, and an industrial glassmorphism design system.

## Key Features

- **Interactive Hydraulic Topology Schematic**: 2D animated vector diagram rendering live reservoir fill levels, rotating booster pump impellers, dynamic pipe flow particle pulses, and click-to-actuate solenoid valves.
- **Real-Time Telemetry & Mass Balance**: Instant calculation of incoming water, accounted zone consumption, and unaccounted loss percentage with automatic leak classification.
- **Zone Quota Cards**: Visual allocation progress gauges, remaining allowances, flow meters, and manual valve toggles.
- **Dedicated Alert Center**: Real-time incident triage with severity badges and operator ACK / Resolve workflows.
- **ESP32 Fleet Health Monitor**: Heartbeat watchdog tracking microcontroller connectivity, IP addresses, firmware versions, and last ping timestamps.
- **Live Demo Scenario Controller**: Instant switching between `NORMAL`, `LEAK`, `OVERFLOW`, `LOW_LEVEL`, `EXCESSIVE_CONSUMPTION`, and `SENSOR_FAILURE` with live physical explanations.

## Development

```bash
cd frontend
npm install
npm run dev
```

The dev server will launch at `http://localhost:5173` with automatic API proxying to `http://localhost:8000`.
