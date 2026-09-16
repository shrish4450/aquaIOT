# AQUA-NEXUS Zone User Subsystem

## 1. System Mission & Philosophy

While facility administrators require high-density, system-wide SCADA views, individual zone residents (e.g., apartment owners, commercial managers, irrigation wardens) need clear answers to five fundamental questions:

1. **How much water reached our zone today?** ($V_{\text{received}}$)
2. **How much water did our zone consume today?** ($V_{\text{consumed}}$)
3. **How much water remains from our allocated quota?** ($V_{\text{remaining}}$)
4. **Is our water supply currently flowing or interrupted?**
5. **Are there any abnormal events, leaks, or quota warnings for our sector?**

The Zone User Subsystem provides a clean, responsive, dedicated portal tailored exclusively to these questions.

---

## 2. Information Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│ AQUA-NEXUS ZONE PORTAL                         [User: Zone 2 User]     │
├────────────────────────────────────────────────────────────────────────┤
│ [Zone Dashboard]   [My Usage History]   [Zone Alerts (0)]   [Profile]  │
├────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌──────────┐ │
│  │ WATER RECEIVED │ │ WATER CONSUMED │ │ ZONE DIFFERENCE│ │ REMAINING│ │
│  │   82.4 L       │ │   67.1 L       │ │   +15.3 L      │ │  12.9 L  │ │
│  └────────────────┘ └────────────────┘ └────────────────┘ └──────────┘ │
│                                                                        │
│  ┌───────────────────────────────────────────────┐ ┌─────────────────┐ │
│  │ TODAY'S ALLOCATION: 80.0 L                    │ │ ZONE STATUS     │ │
│  │ [████████████████████████░░░░░░] 83.9% Used   │ │ Supply: ACTIVE  │ │
│  │ 12.9 L remaining until automated throttle     │ │ Valve: OPEN     │ │
│  └───────────────────────────────────────────────┘ └─────────────────┘ │
│                                                                        │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ LIVE WATER FLOW TELEMETRY (L/min)                                 │ │
│  │  ~~/\~~/\__/\~~~~~/\_________  (2.40 L/min Instantaneous)         │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Dedicated Navigation & Views

### 3.1 Zone Dashboard (`overview`)
- **Key Performance Indicators (KPIs)**:
  - **Water Received Today**: Bulk volume counted at the zone boundary meter.
  - **Water Consumed Today**: Aggregated usage metered at end-fixtures.
  - **Zone Difference**: Physical variance ($V_{\text{received}} - V_{\text{consumed}}$), highlighting internal pipeline storage or micro-leakage.
  - **Remaining Quota**: Active buffer before automated valve interlock.
  - **Current Flow**: Instantaneous flow sensor reading in L/min.
- **Quota Progress Gauge**: Color-coded dynamically (Green $\le 70\%$, Amber $70\%-90\%$, Red $> 90\%$).
- **Supply State Card**: Real-time status indicator showing whether water is `AVAILABLE` or `INTERRUPTED`.
- **Live Flow Waveform Chart**: Zero-dependency, responsive native SVG stream reflecting live sensor telemetry from MQTT.

### 3.2 My Usage History (`history`)
- **Time Periods**:
  - `Today`
  - `Yesterday`
  - `Last 7 Days`
  - `Last 30 Days`
- **Computed Analytics**:
  - Received volume, consumed volume, and net difference for the selected period.
  - Average daily consumption rate.
  - Peak flow demand timestamp and magnitude.
  - Quota compliance rate.

### 3.3 Zone Alerts Feed (`alerts`)
- Filters out facility-internal diagnostics and non-relevant zones.
- Surfaces only actionable messages:
  - High consumption warning.
  - Allocation threshold warning (80% and 90%).
  - Allocation exhausted & automated supply cut-off notification.
  - Supply resumption notification.
  - General facility maintenance announcements.

### 3.4 Resident Account Profile (`profile`)
- Displays account details: Full Name, Registered Email, Role, Sector Node, and Activation Status.
- Re-enforces immutable security: assigned zones cannot be edited by the user.

---

## 4. API Endpoints

All zone endpoints automatically resolve `current_user.zone_id`:

- `GET /api/user/zone/dashboard`: Returns real-time zone telemetry, received/consumed totals, quota status, recent readings, and active zone alerts.
- `GET /api/user/zone/history?period={today|yesterday|7days|30days}`: Returns historical consumption aggregates and trend data for the user's zone.
- `GET /api/user/zone/alerts`: Returns active and recent alerts tagged with the user's `zone_id` or marked as `is_facility_wide = true`.
- `GET /api/user/zone/{zone_id}`: Verifies requested sector against token identity; returns `403 Forbidden` if spoofed.
