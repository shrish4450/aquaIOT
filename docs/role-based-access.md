# AQUA-NEXUS Role-Based Access Control (RBAC) Specification

## 1. Architectural Overview

AQUA-NEXUS implements a defense-in-depth, two-tier role-based access control architecture governing both web interfaces and underlying IoT infrastructure actuators.

```
                     ┌───────────────────────────────┐
                     │          AQUA-NEXUS           │
                     │    Authentication Service     │
                     └───────────────┬───────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
         ┌─────────────────────┐           ┌─────────────────────┐
         │     ADMIN ROLE      │           │   ZONE_USER ROLE    │
         │  (Facility Manager) │           │  (Assigned Resident)│
         └──────────┬──────────┘           └──────────┬──────────┘
                    │                                 │
         ┌──────────▼──────────┐           ┌──────────▼──────────┐
         │ Full Infrastructure │           │ Strict Zone Boundary│
         │ - All Zones (1,2,3) │           │ - Own Zone Only     │
         │ - Central Reservoir │           │ - Received/Consumed │
         │ - Pumps & Valves    │           │ - Remaining Quota   │
         │ - Quota Allocations │           │ - No Actuators      │
         │ - User Management   │           │ - Read-Only Live    │
         └─────────────────────┘           └─────────────────────┘
```

---

## 2. Roles & Authority Hierarchy

### 2.1 ADMIN (`ADMIN`)
- **Scope**: Entire water infrastructure across all physical and logical assets.
- **Capabilities**:
  - Full telemetry visibility (main incoming flow, tank level, all zone flows).
  - Actuator overrides (start/stop central delivery pump, open/close any zone solenoid valve).
  - Allocation administration (set daily water volume budgets per zone, set critical reserve thresholds).
  - User and identity administration (create Zone Users, assign or reassign zones, deactivate or reactivate accounts).
  - Alarm & incident management (acknowledge and clear facility-wide and zone-specific alarms).
  - System-wide accountability audits (track physical bulk losses between main meter and zone sub-meters).

### 2.2 ZONE USER (`ZONE_USER`)
- **Scope**: Strictly constrained to exactly **ONE** assigned sector (`zone_id`).
- **Capabilities**:
  - Telemetry visibility: Water received today ($V_{\text{received}}$), water consumed today ($V_{\text{consumed}}$), zone difference, remaining daily quota, and live flow rate.
  - History analysis: Granular usage breakdown across Today, Yesterday, Last 7 Days, and Last 30 Days.
  - Zone alerts: Operational alarms targeting their assigned zone (e.g. quota 80% warning, quota breach cutoff, supply suspension) plus facility-wide broadcast notices.
  - **Restrictions**:
    - Strictly forbidden from modifying quotas, thresholds, or system configurations (`403 Forbidden`).
    - Strictly forbidden from executing actuator commands (`403 Forbidden`).
    - Strictly forbidden from viewing telemetry, historical logs, or alerts belonging to any other zone (`403 Forbidden`).

---

## 3. Server-Side Enforcement (Defense-in-Depth)

AQUA-NEXUS rejects any security model that relies on hiding frontend buttons or views. All authorization is derived and validated strictly on the backend:

1. **Cryptographic Token Verification**:
   - Authentication tokens are HMAC-SHA256 signed with server-side secret entropy.
   - Payload claims: `{"sub": "<user_id>", "email": "...", "role": "ADMIN|ZONE_USER", "zone_id": <int|null>, "exp": <timestamp>}`.
2. **Zone Boundary Dependency (`require_zone_user`)**:
   - In `backend/app/auth/dependencies.py`, the dependency extracts the authenticated identity from the token.
   - It validates that the user is active in the database.
   - For all zone operations, the handler uses `current_user.zone_id` directly, ignoring any route parameter spoofing:
     ```python
     if zone_id is not None and current_user.zone_id != zone_id:
         raise HTTPException(
             status_code=status.HTTP_403_FORBIDDEN,
             detail=f"Access denied: You are assigned to Zone {current_user.zone_id} and cannot access Zone {zone_id}"
         )
     ```
3. **Actuator Guard (`require_admin`)**:
   - Endpoints `/api/control/valve/{id}` and `/api/control/pump` require `ADMIN` authorization. Any attempt by a `ZONE_USER` immediately aborts with `HTTP 403 Forbidden` and emits an audit event.

---

## 4. Default Demonstration Accounts

The database seed routine automatically provisions standard development and evaluation credentials:

| Identity | Email | Default Password | Role | Sector Binding |
| :--- | :--- | :--- | :--- | :--- |
| **Facility Administrator** | `admin@aquanexus.local` | `Admin@123` | `ADMIN` | All Facility Assets |
| **A Wing User** | `zone1@aquanexus.local` | `Zone1@123` | `ZONE_USER` | A Wing |
| **B Wing User** | `zone2@aquanexus.local` | `Zone2@123` | `ZONE_USER` | B Wing |
| **C Wing User** | `zone3@aquanexus.local` | `Zone3@123` | `ZONE_USER` | C Wing |

---

## 5. Audit Logging Architecture

Every security-sensitive administrative operation is recorded to the persistent `audit_logs` relation with:
- Timestamp (UTC)
- Actor (`admin@aquanexus.local`)
- Action verb (e.g. `USER_CREATED`, `USER_ZONE_ASSIGNED`, `VALVE_CONTROL`, `ALLOCATION_UPDATED`)
- Target entity and payload diff
- IP address / client context
