# AQUA-NEXUS Verification & Testing Documentation

This document outlines the testing strategy, test suite coverage, and verification procedures for the AQUA-NEXUS platform.

---

## 1. Test Architecture Overview

The automated test suite is implemented using `pytest` and `FastAPI TestClient`. It covers four testing tiers:
1. **Unit Tests**: Mathematical equations, zero-division boundaries, threshold classifications, and isolated detection routines.
2. **Integration Tests**: Actuator commands, safety interlocks, database transactions, and REST API contracts.
3. **RBAC & Security Tests**: Token cryptographic verification, role authorization, server-side zone isolation, URL/body spoofing rejection, and actuator permission guards.
4. **End-to-End Pipeline Tests**: Complete flow from simulated MQTT message generation, ingestion, detection, DB persistence, and REST/WebSocket exposure.

---

## 2. Test Suite Matrix

| Test Module | Coverage Area | Assertions Verified | Status |
|---|---|---|---|
| `test_water_accountability.py` | Mass Balance Calculations | Unaccounted water formula, zero-division safety, `NORMAL`, `WARNING`, `POSSIBLE_LEAK`, and `CRITICAL` classifications | **PASS (6/6)** |
| `test_detection_engine.py` | Incident Detection | Flow rate discrepancy leak trigger, tank overflow (>90%), critical low level (<10%), quota warning (80%), quota exceeded (100%), alert deduplication | **PASS (5/5)** |
| `test_control_engine.py` | Automated Interlocks | Automatic valve closure on quota breach, automatic pump shutoff on overflow, manual operator dispatches | **PASS (3/3)** |
| `test_api_endpoints.py` | REST Web Service | `/api/dashboard`, `/api/tank`, `/api/zones`, `/api/consumption`, `/api/alerts`, `/api/control/pump`, `/api/control/valve/*`, `/api/settings` | **PASS (8/8)** |
| `test_e2e_pipeline.py` | End-to-End Cyber-Physical Flow | Full scenario transitions: NORMAL → LEAK (raises active alert), OVERFLOW (stops pump), EXCESSIVE_CONSUMPTION (shuts valve) | **PASS (3/3)** |
| `test_multi_user_auth.py` | Role-Based Access & Zone Isolation | Admin login, Zone User login, invalid credentials, token verification, Zone User dashboard access, Zone User forbidden from other zones (`403`), Admin access to all zones, Zone User blocked from Admin routes, Admin valve/pump control, Zone User valve/pump control blocked (`403`), Admin allocation modification, Zone User allocation modification blocked (`403`), received vs consumed calculation, zone difference calculation, history endpoints, user creation & zone assignment lifecycle | **PASS (16/16)** |

**Total Test Coverage: 41 Passed, 0 Failed.**

---

## 3. Running Automated Tests

```bash
# Set PYTHONPATH and execute pytest
PYTHONPATH=. .venv/bin/pytest backend/tests -v
```
