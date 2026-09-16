# AQUA-NEXUS: Smart Water Tracking, Allocation, Monitoring & Control System

[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](LICENSE)
[![Python: 3.13](https://img.shields.io/badge/Python-3.13-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![MQTT: 3.1.1](https://img.shields.io/badge/Messaging-MQTT%20v3.1.1-orange.svg)](mqtt/)
[![React: 19](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61dafb.svg)](frontend/)
[![Tests: 41 Passed](https://img.shields.io/badge/Tests-41%20Passed-brightgreen.svg)](docs/testing.md)

**AQUA-NEXUS** is an end-to-end IoT-enabled cyber-physical water management, allocation, and telemetry platform. Designed for academic complexes, residential blocks, and municipal water grids, it monitors real-time municipal inlet flow, sub-zone water consumption, and reservoir storage levels, calculates mass balance across transmission lines to detect leaks, enforces daily zone allocations through automated solenoid valve interlocks, protects pumping infrastructure against overflow and dry-run damage, and provides a **role-based multi-user architecture** with strict cryptographic zone isolation.

---

## Key Features

1. **Role-Based Multi-User Architecture**: 
   - **ADMIN (Facility Manager)**: Complete facility view, all 3 zones, reservoir, booster pump, solenoid valves, user management, and system-wide analytics.
   - **ZONE USER (Assigned Resident)**: Clean, dedicated portal strictly isolated to one zone. Shows water received vs consumed, remaining quota, instantaneous flow, and zone-specific alerts. Backend strictly enforces zone boundaries (`403 Forbidden` on URL/parameter spoofing).
2. **Two-Tier Water Accountability Framework**:
   - **Tier 1 (Facility Transmission)**: $V_{\text{facility\_unaccounted}} = V_{\text{total\_incoming}} - \sum V_{\text{zone\_received}}$
   - **Tier 2 (Zone Consumption)**: $V_{\text{zone\_difference}} = V_{\text{zone\_received}} - V_{\text{zone\_consumed}}$
3. **Dynamic Water Allocation & Interlocks**: Tracks daily zone budgets (A Wing: 50L, B Wing: 40L, C Wing: 60L). Automated interlocks isolate zone solenoid valves upon quota breach.
4. **Storage Reservoir Monitoring**: Tracks tank depth, remaining capacity, and triggers automated booster pump shutoff when water reaches $\ge 90\%$ capacity.
5. **Dry-Run Protection**: Alerts operators and protects equipment when reservoir depth drops below critical reserve ($\le 10\%$).
6. **Interactive Hydraulic Topology Schematic**: 2D animated vector diagram with dynamic water fill heights, rotating pump impellers, fluid particle pulses, and click-to-actuate solenoid valves.
7. **Admin Zone Overview Table & Detail Inspector**: Live table displaying Received, Consumed, Difference, Allocation, Remaining, Flow, Valve, and Status per zone, with click-to-open SVG telemetry waveforms.
8. **Realistic Virtual IoT Simulator**: 6 dynamic scenarios (`NORMAL`, `LEAK`, `OVERFLOW`, `LOW_LEVEL`, `EXCESSIVE_CONSUMPTION`, `SENSOR_FAILURE`) enabling complete evaluation without physical hardware.

---

## Default Demonstration Accounts

The system automatically initializes and seeds four demo accounts with standard PBKDF2 password hashing:

| Name | Role | Email | Password | Assigned Zone |
| :--- | :--- | :--- | :--- | :--- |
| **Facility Administrator** | `ADMIN` | `admin@aquanexus.local` | `Admin@123` | Full Facility (All Zones) |
| **A Wing User** | `ZONE_USER` | `zone1@aquanexus.local` | `Zone1@123` | A Wing |
| **B Wing User** | `ZONE_USER` | `zone2@aquanexus.local` | `Zone2@123` | B Wing |
| **C Wing User** | `ZONE_USER` | `zone3@aquanexus.local` | `Zone3@123` | C Wing |

---

## Technology Stack

- **Backend**: Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2.0, Paho-MQTT, WebSockets, PBKDF2/HMAC Token Auth.
- **Database**: SQLite (Async + Sync) with cleanly decoupled ORM architecture ready for PostgreSQL.
- **IoT Messaging**: MQTT v3.1.1 with Mosquitto configuration and zero-dependency embedded runner.
- **Frontend**: React 19, Vite, Cyber-Hydro glassmorphism design system, Lucide Icons, Pure SVG Data Visualization.
- **Testing**: Pytest with 41 unit, integration, RBAC, and E2E pipeline tests.

---

## Project Structure

```
AQUA_NEXUS/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI entrypoint, lifespan & router mounting
│   │   ├── config.py             # Pydantic BaseSettings configuration
│   │   ├── database.py           # Async & sync SQLAlchemy engines
│   │   ├── database_seed.py      # Database table initialization, demo users & seed curves
│   │   ├── auth/                 # PBKDF2 hashing, HMAC tokens & RBAC dependencies
│   │   │   ├── security.py
│   │   │   └── dependencies.py
│   │   ├── models/               # Relational database models (User, Zone, Allocation, Alert, etc.)
│   │   ├── schemas/              # Pydantic validation schemas
│   │   ├── routes/               # REST API & WebSocket routers (auth, user, admin, telemetry)
│   │   ├── detection/            # Water accountability & leak algorithms
│   │   ├── control/              # Actuator command dispatch & auto-interlocks
│   │   └── mqtt/                 # Paho-MQTT telemetry ingestion worker
│   ├── tests/                    # 41 automated pytest test suites
│   ├── requirements.txt          # Python dependencies
│   └── README.md
│
├── frontend/
│   ├── src/
│   │   ├── components/           # UI cards, topology diagram, charts, modals, RBAC portals
│   │   │   ├── ZoneUserDashboard.jsx    # Dedicated Zone Resident Portal
│   │   │   ├── AdminUserManagement.jsx  # Admin user creation & zone assignment
│   │   │   ├── AdminZoneDetailModal.jsx # Zone detail inspector with SVG waveforms
│   │   │   ├── ZoneCards.jsx            # Admin Zone Overview Table & cards
│   │   │   └── LoginModal.jsx           # 1-click demo login & authentication modal
│   │   ├── services/             # REST & WebSocket API clients with auth headers
│   │   ├── App.jsx               # Navigation tabs, role-based routing & reactive state
│   │   └── index.css             # Cyber-Hydro glassmorphism design system
│   ├── index.html                # Typography, meta tags & favicon
│   ├── vite.config.js            # Vite bundler & API proxy configuration
│   └── package.json              # Frontend npm dependencies
│
├── simulator/
│   ├── simulator.py              # Virtual ESP32 multi-sensor telemetry & received/consumed generator
│   ├── config.py                 # Virtual sensor & system parameters
│   ├── mqtt_client.py            # Simulator MQTT pub/sub client
│   ├── scenarios.py              # Physics models for all 6 scenarios
│   └── README.md
│
├── mqtt/
│   ├── mosquitto.conf            # Mosquitto broker configuration
│   ├── broker_runner.py          # Standalone broker runner (Mosquitto / Embedded)
│   └── README.md
│
├── docs/
│   ├── role-based-access.md      # RBAC architecture, tokens, permissions & security boundaries
│   ├── zone-user-system.md       # Zone User portal, views, telemetry & UX specifications
│   ├── water-accountability.md   # Two-tier facility & zone mass balance equations
│   ├── architecture.md           # C4 & sequence architecture diagrams
│   ├── database-schema.md        # Normalized ER diagrams & table specifications
│   ├── mqtt-topics.md            # Complete MQTT topic & JSON payload catalog
│   ├── algorithms.md             # Mathematical equations & detection bounds
│   ├── hardware-integration.md   # BOM, pinout diagrams, & ESP32 C++ firmware
│   └── testing.md                # Automated test matrix & coverage report
│
├── docker-compose.yml            # Multi-container orchestration specification
├── pytest.ini                    # Pytest configuration
├── .env.example                  # Environment configuration template
└── README.md                     # Master project documentation
```

---

## Quick Start Guide

### Prerequisites
- Python 3.10+ (Tested on Python 3.13)
- Node.js 18+ & npm
- Git

### 1. Setup Environment
```bash
# Setup Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install backend dependencies
pip install -r backend/requirements.txt

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Run MQTT Broker
```bash
python mqtt/broker_runner.py
```
*Listens on `0.0.0.0:1883`.*

### 3. Initialize Database & Run Backend Server
In a new terminal:
```bash
source .venv/bin/activate

# Seed initial baseline parameters, demo accounts & 24h historical telemetry curves
python -m backend.app.database_seed

# Start FastAPI server
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
*API documentation available at `http://localhost:8000/docs`.*

### 4. Start Virtual IoT ESP32 Simulator
In a new terminal:
```bash
source .venv/bin/activate
python simulator/simulator.py
```

### 5. Start Web Telemetry Dashboard
In a new terminal:
```bash
cd frontend
npm run dev
```
*Open your browser to `http://localhost:5173`.*

---

## Multi-User Verification & Testing

### Running Automated Test Suite
Run all 41 unit, integration, RBAC, and E2E tests:
```bash
PYTHONPATH=. .venv/bin/pytest backend/tests -v
```

### End-to-End Evaluation Workflow
1. **Admin Inspection**:
   - Log in as `admin@aquanexus.local` (`Admin@123`).
   - View the **Zone Overview Table** displaying Water Received, Consumed, Zone Difference, Allocation, Flow, and Valve state.
   - Click "Inspect" on Zone 2 to view the real-time SVG waveform and water balance breakdown.
2. **Zone User Isolation**:
   - Click "Switch Account" in the top bar and select **B Wing User (B Wing)**.
   - Observe that the dashboard strictly presents B Wing telemetry:
     - Water Received Today (e.g. 28.5 L)
     - Water Consumed Today (e.g. 26.2 L)
     - Zone Difference (+2.3 L)
     - Remaining Quota & Live Flow Telemetry waveform
     - No actuator controls and no visibility into A Wing or C Wing.
3. **Backend Authorization Verification**:
   - Direct API request to another zone (e.g., `GET /api/user/zone/1`) using B Wing User's bearer token returns:
     `403 Forbidden: Access denied: You are assigned to Zone 2 and cannot access Zone 1`.
4. **Physical Actuator Interlock**:
   - Switch to Admin and trigger **B Wing Excessive Consumption** or manually close the B Wing Valve.
   - The MQTT command dispatches: `Admin -> Backend -> MQTT -> Simulator`.
   - Switch back to B Wing User: The dashboard immediately updates with Valve `CLOSED`, Flow `0.00 L/min`, and Supply `INTERRUPTED`.
   - Reopen the valve from the Admin console to restore normal flow.

---

## Documentation Index

- [Role-Based Access Control Architecture](docs/role-based-access.md)
- [Zone User Portal & Subsystem](docs/zone-user-system.md)
- [Two-Tier Water Accountability Framework](docs/water-accountability.md)
- [System Architecture & Data Flows](docs/architecture.md)
- [Database Schema & ER Diagrams](docs/database-schema.md)
- [MQTT Topic Hierarchy](docs/mqtt-topics.md)
- [Hardware Integration Guide & ESP32 Firmware](docs/hardware-integration.md)
- [Testing Matrix](docs/testing.md)

---

## License
Distributed under the MIT License. See [LICENSE](LICENSE) for details.
