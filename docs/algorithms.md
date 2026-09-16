# AQUA-NEXUS Mathematical Algorithms & Detection Logic

This document details the mathematical formulations and state machines governing telemetry ingestion, mass balance accountability, leak classification, and automated control interlocks in AQUA-NEXUS.

---

## 1. Flow Rate & Volume Numerical Integration

Physical turbine flow sensors (such as the Hall-effect YF-S201) generate a train of digital voltage pulses proportional to fluid velocity:
$$f = K \cdot Q$$
where $f$ is pulse frequency in Hertz, $Q$ is volumetric flow rate in Liters per minute (L/min), and $K$ is the sensor calibration factor (nominally $7.5 \text{ Hz}/(\text{L/min})$ for YF-S201).

The instantaneous volumetric flow rate $Q_k$ is measured over sample window $\Delta t_k$ seconds:
$$Q_k = \frac{\text{Pulses}_k}{K \cdot \Delta t_k} \times 60 \quad [\text{L/min}]$$

Total cumulative volume $V(t)$ delivered up to time $t$ is computed via Riemann sum numerical integration:
$$V(t) = \int_0^t Q(\tau) d\tau \approx \sum_{k=1}^N Q_k \cdot \left(\frac{\Delta t_k}{60}\right) \quad [\text{Liters}]$$

---

## 2. Water Accountability & Hydraulic Mass Balance

According to the law of conservation of mass in an incompressible fluid network without internal storage:
$$Q_{\text{in}}(t) = \sum_{i=1}^M Q_{\text{zone}, i}(t) + Q_{\text{loss}}(t)$$

### 2.1 Total Unaccounted Water Loss
$$V_{\text{unaccounted}} = V_{\text{incoming}} - \sum_{i=1}^M V_{\text{zone}, i}$$

To prevent sensor precision jitter or calibration drift from producing negative values, the raw difference is lower-bounded:
$$V_{\text{unaccounted}} = \max\left(0, V_{\text{incoming}} - \sum_{i=1}^M V_{\text{zone}, i}\right)$$

### 2.2 Unaccounted Water Loss Percentage
$$\%_{\text{unaccounted}} = 
\begin{cases} 
0.0\% & \text{if } V_{\text{incoming}} \le \epsilon \\
\min\left(100.0, \frac{V_{\text{unaccounted}}}{V_{\text{incoming}}} \times 100\right) & \text{if } V_{\text{incoming}} > \epsilon
\end{cases}$$
where $\epsilon = 0.001\text{ L}$ protects against division-by-zero during startup.

### 2.3 Discrepancy Classification Engine
| Unaccounted Percentage | Classification | Action Taken |
|---|---|---|
| $0.0\% \le \%_{\text{unaccounted}} < 5.0\%$ | `NORMAL` | Nominal operation. Minor meter precision tolerance. |
| $5.0\% \le \%_{\text{unaccounted}} < 10.0\%$ | `WARNING` | System flags warning. Slow leak or meter drift logged. |
| $10.0\% \le \%_{\text{unaccounted}} < 25.0\%$ | `POSSIBLE_LEAK` | Active leak alert created. Maintenance inspects pipeline. |
| $\%_{\text{unaccounted}} \ge 25.0\%$ | `CRITICAL` | Major line rupture alarm. Emergency procedures initiated. |

---

## 3. Storage Reservoir Level Estimation

Ultrasonic distance sensors (HC-SR04) measure the round-trip flight time $\Delta t_{\text{echo}}$ of a $40\text{ kHz}$ acoustic pulse from the tank lid to the fluid surface:
$$d_{\text{air}} = \frac{v_{\text{sound}} \cdot \Delta t_{\text{echo}}}{2} \quad [\text{cm}]$$
where $v_{\text{sound}} \approx 343\text{ m/s}$ at $20^\circ\text{C}$.

For a tank with height $H_{\text{tank}}$:
$$h_{\text{water}} = H_{\text{tank}} - d_{\text{air}} \quad [\text{cm}]$$

For uniform cross-sectional geometry:
$$\%_{\text{level}} = \left(\frac{h_{\text{water}}}{H_{\text{tank}}}\right) \times 100$$
$$V_{\text{current}} = V_{\text{capacity}} \times \left(\frac{\%_{\text{level}}}{100}\right)$$

### Threshold State Machine
- High Level Limit ($\ge 90\%$): Triggers `OVERFLOW` warning.
- Low Level Limit ($\le 20\%$): Triggers `LOW_LEVEL` advisory.
- Critical Level Limit ($\le 10\%$): Triggers `CRITICAL_LEVEL` dry-run emergency alarm.

---

## 4. Daily Allocation & Quota Enforcement

For each zone $i$ on date $d$:
$$R_i = \max\left(0, A_i - C_i\right)$$
$$U_i = \left(\frac{C_i}{A_i}\right) \times 100$$
where $A_i$ is daily quota budget, $C_i$ is cumulative consumption today, and $R_i$ is remaining allowance.

### Automated Cutoff Interlock Rule
$$\text{If } U_i \ge 100.0\% \text{ and } \text{auto\_cutoff\_enabled} \implies \text{Publish } \text{valve}_i \to \text{CLOSED}$$
