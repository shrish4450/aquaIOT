# AQUA-NEXUS Backend Services

A modular, production-ready FastAPI backend for IoT telemetry ingestion, real-time leak detection, daily quota monitoring, automated pump & valve protection, and WebSocket dashboard streaming.

## Architecture

- **`backend/app/main.py`**: Lifespan manager, background tasks, CORS, and WebSocket orchestrator.
- **`backend/app/config.py`**: Pydantic BaseSettings management.
- **`backend/app/database.py`**: Async and sync SQLAlchemy engine management for SQLite / PostgreSQL.
- **`backend/app/models/`**: Relational models (`Device`, `Zone`, `SensorReading`, `TankReading`, `Allocation`, `ValveState`, `PumpState`, `Alert`, `Event`, `SystemSetting`).
- **`backend/app/detection/`**: Algorithmic detection of flow discrepancies, volume loss, tank thresholds, and quota limits.
- **`backend/app/control/`**: Automatic safety interlocks and manual actuator dispatch via MQTT.
- **`backend/app/mqtt/`**: Paho MQTT subscriber client and telemetry ingestion worker.
- **`backend/app/routes/`**: Comprehensive REST APIs and WebSocket endpoints.

## Running Locally

```bash
# Activate virtual environment
source .venv/bin/activate

# Install requirements
pip install -r backend/requirements.txt

# Seed baseline database
python -m backend.app.database_seed

# Start backend server
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

## API Documentation
Once running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- WebSocket Telemetry: `ws://localhost:8000/api/ws/telemetry`
