import React from 'react';
import { Play, ShieldAlert, Waves, AlertTriangle, Zap, ServerOff, CheckCircle } from 'lucide-react';

const SCENARIOS = [
  {
    id: 'NORMAL',
    label: 'NORMAL OPERATION',
    icon: CheckCircle,
    color: '#10b981',
    description: 'Balanced hydraulic steady-state. Main inlet flow (~3.0 L/min) matches the sum of zone consumption. Unaccounted water is <5%. All actuators and virtual ESP32 nodes online.',
  },
  {
    id: 'LEAK',
    label: 'SIMULATE LEAK',
    icon: AlertTriangle,
    color: '#ef4444',
    description: 'Simulates underground main line rupture. Main inlet reads 5.2 L/min, but zones only register 3.0 L/min (~42% unaccounted water loss). Detection engine raises immediate LEAKAGE critical alert.',
  },
  {
    id: 'OVERFLOW',
    label: 'SIMULATE OVERFLOW',
    icon: Waves,
    color: '#38bdf8',
    description: 'Inlet pump pumps water rapidly into tank. Storage level climbs past 90% threshold. Automated control engine evaluates rule and dispatches MQTT pump OFF command.',
  },
  {
    id: 'LOW_LEVEL',
    label: 'SIMULATE LOW LEVEL',
    icon: ShieldAlert,
    color: '#f59e0b',
    description: 'Municipal inlet dry-out. Tank level drains below 20% warning and 10% emergency dry-run threshold. System triggers CRITICAL_LEVEL alarm.',
  },
  {
    id: 'EXCESSIVE_CONSUMPTION',
    label: 'EXCESSIVE CONSUMPTION',
    icon: Zap,
    color: '#ec4899',
    description: 'B Wing consumption surges to 8.5 L/min (burst pipe / commercial runaway). Daily quota (40L) is exhausted. Automatic rule shuts B Wing solenoid valve.',
  },
  {
    id: 'SENSOR_FAILURE',
    label: 'SENSOR FAILURE',
    icon: ServerOff,
    color: '#94a3b8',
    description: 'Virtual ESP32 Node 2 telemetry drops offline. Watchdog timer flags missing heartbeats and triggers SENSOR_OFFLINE / DEVICE_OFFLINE incident.',
  },
];

export default function DemoController({ activeScenario, onSelectScenario }) {
  const current = SCENARIOS.find((s) => s.id === activeScenario) || SCENARIOS[0];

  return (
    <div className="scenario-banner">
      <div className="scenario-header">
        <div className="scenario-title">
          <Play size={18} />
          DEMO CONTROL DECK — VIRTUAL IOT SCENARIO ENGINE
        </div>
        <div className="kpi-subtext">Zero-hardware demonstration mode for evaluation</div>
      </div>

      <div className="scenario-buttons-grid">
        {SCENARIOS.map((sc) => {
          const Icon = sc.icon;
          const isActive = activeScenario === sc.id;
          return (
            <button
              key={sc.id}
              className={`scenario-btn ${isActive ? 'active' : ''} ${sc.id === 'LEAK' && isActive ? 'leak' : ''}`}
              onClick={() => onSelectScenario(sc.id)}
            >
              <Icon size={14} style={{ color: isActive ? '#fff' : sc.color }} />
              {sc.label}
            </button>
          );
        })}
      </div>

      <div className="scenario-physics-text">
        <strong style={{ color: current.color }}>[{current.id} ACTIVE]: </strong>
        {current.description}
      </div>
    </div>
  );
}
