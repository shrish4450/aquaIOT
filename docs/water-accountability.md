# AQUA-NEXUS Two-Tier Water Accountability Framework

## 1. Executive Summary

Water accountability is the mathematical verification of conservation and loss across fluid distribution networks. Traditional systems conflate distribution transmission loss with customer consumption variance. 

AQUA-NEXUS introduces a **Two-Tier Water Accountability Framework**:
1. **Tier 1: Facility-Level Transmission Accountability** (Central Reservoir $\to$ Zone Sub-Meters).
2. **Tier 2: Zone-Level Consumption Accountability** (Zone Sub-Meter $\to$ Fixture Ingress).

---

## 2. Mathematical Formulations

### 2.1 Tier 1: Facility-Level Transmission Accountability

Measures water pumped or gravity-fed from the central storage tank versus water recorded as delivered into zone boundary sub-meters:

$$V_{\text{facility\_unaccounted}} = V_{\text{total\_incoming}} - \sum_{i=1}^{N} V_{\text{zone\_received}, i}$$

Where:
- $V_{\text{total\_incoming}}$: Total bulk volume discharged through the central delivery meter at the reservoir outlet.
- $V_{\text{zone\_received}, i}$: Bulk volume recorded by the boundary flow sensor for Zone $i$.
- $V_{\text{facility\_unaccounted}}$: Physical loss occurring along main transmission pipes (pipe ruptures, joint leakages, unauthorized taps).

#### Status Classification:
- **NORMAL**: $\text{Loss} \le 5\%$
- **WARNING (Minor Leakage)**: $5\% < \text{Loss} \le 15\%$
- **CRITICAL (Major Rupture / Bypass)**: $\text{Loss} > 15\%$

---

### 2.2 Tier 2: Zone-Level Consumption Accountability

Measures water handed over at the zone boundary meter versus water metered at consumer usage points:

$$V_{\text{zone\_difference}, i} = V_{\text{zone\_received}, i} - V_{\text{zone\_consumed}, i}$$

Where:
- $V_{\text{zone\_received}, i}$: Bulk water delivered to the sector entrance.
- $V_{\text{zone\_consumed}, i}$: Sum of end-user taps, showers, toilets, and irrigation emitters metered in that sector.
- $V_{\text{zone\_difference}, i}$: Variance representing internal sub-line leakage, meter drift, or unmetered utility use.

---

## 3. Comparison of Accountability Tiers

| Dimension | Tier 1: Facility Transmission | Tier 2: Zone Distribution |
| :--- | :--- | :--- |
| **Physical Scope** | Main delivery spine & manifolds | Sector sub-mains, risers, and fixtures |
| **Input Measurement** | Main Delivery Flow Meter | Zone Ingress Sub-Meter |
| **Output Measurement** | Sum of Zone Ingress Meters | Sum of Fixture Outlets / Consumer Usage |
| **Primary Failure Detected** | Trunk line rupture, underground joint bursts | Internal plumbing leaks, running cisterns, tap drips |
| **Primary Stakeholder** | Facility Manager / Engineering Lead | Zone Resident / Floor Warden |
| **Corrective Action** | Isolate delivery pump, inspect trunk valves | Isolate zone branch valve, inspect local risers |

---

## 4. End-to-End Conservation Ledger Example

```
                    [ Central Reservoir ]
                              │
                    Meter: 1,000.0 Liters
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
    Zone Meters Received: 940.0 L          Facility Unaccounted: 60.0 L (6.0%)
          │                                      [Status: WARNING]
  ┌───────┼───────┐
  ▼       ▼       ▼
Zone 1  Zone 2  Zone 3
120 L   100 L   140 L
  │       │       │
  ▼       ▼       ▼
Consumed:
 95 L    82 L   139 L
  │       │       │
  ▼       ▼       ▼
Difference:
+25 L   +18 L    +1 L
(Normal)(Normal)(Strict)
```

---

## 5. MQTT & Database Integration

1. **MQTT Telemetry Channels**:
   - `aqua-nexus/telemetry/flow/main`: Instantaneous trunk line flow rate.
   - `aqua-nexus/zone/{id}/flow`: Instantaneous zone consumption flow rate.
   - `aqua-nexus/zone/{id}/received`: Ingress volume pulse packet delivered to zone boundary meter.
2. **Database Storage**:
   - `allocations.water_received_liters`: Running cumulative received volume.
   - `allocations.consumed_liters`: Running cumulative consumed volume.
   - `allocations.zone_difference_liters`: Dynamically updated differential ($V_{\text{received}} - V_{\text{consumed}}$).
   - `daily_consumption`: Aggregated sector records with transmission discrepancy metrics.
