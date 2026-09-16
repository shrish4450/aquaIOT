import React from 'react';
import { Droplet, Activity, AlertTriangle, Power } from 'lucide-react';

export default function HydroTopology({ tank, zones, pumpState, accountability, activeScenario, onTogglePump, onToggleValve }) {
  const tankPct = tank?.level_percentage || 75;
  const tankLiters = tank?.current_level_liters || 75;
  const isPumpOn = pumpState === 'ON';
  const isLeak = activeScenario === 'LEAK' || accountability?.status === 'POSSIBLE_LEAK' || accountability?.status === 'CRITICAL';

  // Tank SVG geometry
  const tankX = 220;
  const tankY = 50;
  const tankW = 140;
  const tankH = 180;
  const waterHeight = (tankPct / 100) * (tankH - 20);
  const waterY = tankY + tankH - waterHeight - 10;

  const getZone = (id) => zones?.find((z) => z.zone_id === id) || { current_flow_lpm: 0, valve_state: 'OPEN', status: 'NORMAL' };
  const z1 = getZone(1);
  const z2 = getZone(2);
  const z3 = getZone(3);

  return (
    <div className="glass-panel topology-container">
      <div className="topology-header">
        <div>
          <h3 className="font-display" style={{ fontSize: '1.15rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} color="var(--cyan-primary)" />
            Interactive Hydraulic Topology System
          </h3>
          <p className="kpi-subtext">Real-time vector schematic with hydrodynamic flow dynamics & actuator overrides</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className={`status-badge ${isPumpOn ? 'normal' : 'warning'}`}>
            <Power size={12} /> Pump {pumpState}
          </span>
          {isLeak && (
            <span className="status-badge critical">
              <AlertTriangle size={12} /> Pipe Rupture Detected
            </span>
          )}
        </div>
      </div>

      <div className="svg-diagram-wrapper">
        <svg viewBox="0 0 920 320" width="100%" height="320" style={{ overflow: 'visible' }}>
          <defs>
            {/* Water gradient */}
            <linearGradient id="tankWaterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.95" />
            </linearGradient>

            {/* Glowing filter */}
            <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 1. Main Supply Inflow Pipe */}
          <path d="M 20 120 L 170 120 L 170 80 L 220 80" className="fluid-pipe" />
          <path
            d="M 20 120 L 170 120 L 170 80 L 220 80"
            className={`fluid-flow ${isPumpOn ? 'fast' : 'stopped'}`}
            style={{ stroke: isLeak ? '#ef4444' : '#00f0ff' }}
          />

          {/* Inflow Sensor Node & Tag */}
          <circle cx="90" cy="120" r="14" fill="#0f172a" stroke={isLeak ? '#ef4444' : '#00f0ff'} strokeWidth="2" />
          <text x="90" y="124" textAnchor="middle" fill="#00f0ff" fontSize="9" fontFamily="var(--font-mono)" fontWeight="bold">
            M1
          </text>
          <text x="90" y="150" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="var(--font-mono)">
            Inlet: {accountability?.total_incoming_liters ? `${accountability.total_incoming_liters.toFixed(1)} L` : '3.0 L/min'}
          </text>
          <text x="90" y="95" textAnchor="middle" fill="#38bdf8" fontSize="11" fontFamily="var(--font-display)" fontWeight="600">
            MUNICIPAL INLET
          </text>

          {/* Leak alert graphic if active */}
          {isLeak && (
            <g transform="translate(130, 60)">
              <circle cx="0" cy="0" r="18" fill="#ef4444" opacity="0.3" className="pulse-danger" />
              <circle cx="0" cy="0" r="10" fill="#ef4444" />
              <text x="0" y="4" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">!</text>
              <text x="0" y="-14" textAnchor="middle" fill="#ef4444" fontSize="10" fontFamily="var(--font-mono)" fontWeight="bold">
                LEAK LOSS
              </text>
            </g>
          )}

          {/* 2. Primary Storage Tank Reservoir */}
          {/* Tank Outer Shell */}
          <rect
            x={tankX}
            y={tankY}
            width={tankW}
            height={tankH}
            rx="12"
            fill="rgba(10, 18, 30, 0.9)"
            stroke={tankPct >= 90 ? '#ef4444' : tankPct <= 10 ? '#ef4444' : 'rgba(0, 240, 255, 0.5)'}
            strokeWidth="3"
          />

          {/* Water Fill */}
          <rect
            x={tankX + 4}
            y={waterY}
            width={tankW - 8}
            height={waterHeight}
            rx="6"
            fill="url(#tankWaterGrad)"
            opacity="0.8"
          />

          {/* Threshold Lines */}
          {/* High (90%) */}
          <line
            x1={tankX + 4}
            y1={tankY + tankH - (0.9 * (tankH - 20)) - 10}
            x2={tankX + tankW - 4}
            y2={tankY + tankH - (0.9 * (tankH - 20)) - 10}
            stroke="#ef4444"
            strokeDasharray="4 3"
            strokeWidth="1.5"
          />
          <text x={tankX + tankW + 6} y={tankY + tankH - (0.9 * (tankH - 20)) - 7} fill="#ef4444" fontSize="9" fontFamily="var(--font-mono)">
            HIGH 90%
          </text>

          {/* Low (20%) */}
          <line
            x1={tankX + 4}
            y1={tankY + tankH - (0.2 * (tankH - 20)) - 10}
            x2={tankX + tankW - 4}
            y2={tankY + tankH - (0.2 * (tankH - 20)) - 10}
            stroke="#f59e0b"
            strokeDasharray="4 3"
            strokeWidth="1.5"
          />
          <text x={tankX + tankW + 6} y={tankY + tankH - (0.2 * (tankH - 20)) - 7} fill="#f59e0b" fontSize="9" fontFamily="var(--font-mono)">
            LOW 20%
          </text>

          {/* Tank Level Display Inside */}
          <text x={tankX + tankW / 2} y={tankY + 50} textAnchor="middle" fill="#ffffff" fontSize="22" fontFamily="var(--font-mono)" fontWeight="700">
            {tankPct.toFixed(1)}%
          </text>
          <text x={tankX + tankW / 2} y={tankY + 70} textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="var(--font-mono)">
            {tankLiters.toFixed(1)} L / 100 L
          </text>
          <text x={tankX + tankW / 2} y={tankY + tankH + 20} textAnchor="middle" fill="#38bdf8" fontSize="12" fontFamily="var(--font-display)" fontWeight="600">
            MAIN RESERVOIR (ESP32-01)
          </text>

          {/* 3. Outflow Pipe to Main Pump */}
          <path d={`M ${tankX + tankW} 180 L 430 180`} className="fluid-pipe" />
          <path d={`M ${tankX + tankW} 180 L 430 180`} className={`fluid-flow ${isPumpOn ? 'fast' : 'stopped'}`} />

          {/* 4. Booster Pump Node (Clickable) */}
          <g
            transform="translate(455, 180)"
            style={{ cursor: 'pointer' }}
            onClick={() => onTogglePump && onTogglePump(isPumpOn ? 'OFF' : 'ON')}
          >
            <circle cx="0" cy="0" r="26" fill="#0f1e36" stroke={isPumpOn ? '#10b981' : '#ef4444'} strokeWidth="3" />
            <polygon
              points="-8,-12 14,0 -8,12"
              fill={isPumpOn ? '#10b981' : '#ef4444'}
              transform={isPumpOn ? 'rotate(0)' : 'rotate(0)'}
            />
            <text x="0" y="42" textAnchor="middle" fill="#fff" fontSize="11" fontFamily="var(--font-display)" fontWeight="600">
              PUMP (P-01)
            </text>
            <text x="0" y="55" textAnchor="middle" fill={isPumpOn ? '#10b981' : '#ef4444'} fontSize="10" fontFamily="var(--font-mono)" fontWeight="bold">
              [{isPumpOn ? 'ON' : 'OFF'}]
            </text>
          </g>

          {/* 5. Distribution Manifold */}
          <path d="M 485 180 L 540 180" className="fluid-pipe" />
          <path d="M 485 180 L 540 180" className={`fluid-flow ${isPumpOn ? 'fast' : 'stopped'}`} />

          {/* Vertical Manifold Header */}
          <path d="M 540 80 L 540 260" className="fluid-pipe" style={{ strokeWidth: 10 }} />
          <path d="M 540 80 L 540 260" className={`fluid-flow ${isPumpOn ? 'fast' : 'stopped'}`} />

          {/* --- Branch 1: Zone 1 (Residential) --- */}
          <path d="M 540 80 L 630 80" className="fluid-pipe" />
          <path d="M 540 80 L 630 80" className={`fluid-flow ${isPumpOn && z1.valve_state === 'OPEN' ? 'fast' : 'stopped'}`} />
          {/* Valve 1 */}
          <g
            transform="translate(645, 80)"
            style={{ cursor: 'pointer' }}
            onClick={() => onToggleValve && onToggleValve(1, z1.valve_state === 'OPEN' ? 'CLOSED' : 'OPEN')}
          >
            <polygon points="-12,-10 0,0 -12,10" fill={z1.valve_state === 'OPEN' ? '#10b981' : '#ef4444'} />
            <polygon points="12,-10 0,0 12,10" fill={z1.valve_state === 'OPEN' ? '#10b981' : '#ef4444'} />
            <circle cx="0" cy="0" r="4" fill="#fff" />
          </g>
          <path d="M 660 80 L 760 80" className="fluid-pipe" />
          <path d="M 660 80 L 760 80" className={`fluid-flow ${isPumpOn && z1.valve_state === 'OPEN' ? 'fast' : 'stopped'}`} />
          {/* A Wing Destination Card */}
          <rect x="760" y="58" width="140" height="44" rx="6" fill="#0c172a" stroke="rgba(0, 240, 255, 0.25)" strokeWidth="1" />
          <text x="770" y="76" fill="#ffffff" fontSize="11" fontFamily="var(--font-display)" fontWeight="600">A WING</text>
          <text x="770" y="93" fill="#00f0ff" fontSize="10" fontFamily="var(--font-mono)">{z1.current_flow_lpm} L/min • {z1.valve_state}</text>

          {/* --- Branch 2: Zone 2 --- */}
          <path d="M 540 180 L 630 180" className="fluid-pipe" />
          <path d="M 540 180 L 630 180" className={`fluid-flow ${isPumpOn && z2.valve_state === 'OPEN' ? 'fast' : 'stopped'}`} />
          {/* Valve 2 */}
          <g
            transform="translate(645, 180)"
            style={{ cursor: 'pointer' }}
            onClick={() => onToggleValve && onToggleValve(2, z2.valve_state === 'OPEN' ? 'CLOSED' : 'OPEN')}
          >
            <polygon points="-12,-10 0,0 -12,10" fill={z2.valve_state === 'OPEN' ? '#10b981' : '#ef4444'} />
            <polygon points="12,-10 0,0 12,10" fill={z2.valve_state === 'OPEN' ? '#10b981' : '#ef4444'} />
            <circle cx="0" cy="0" r="4" fill="#fff" />
          </g>
          <path d="M 660 180 L 760 180" className="fluid-pipe" />
          <path d="M 660 180 L 760 180" className={`fluid-flow ${isPumpOn && z2.valve_state === 'OPEN' ? 'fast' : 'stopped'}`} />
          {/* B Wing Destination Card */}
          <rect x="760" y="158" width="140" height="44" rx="6" fill="#0c172a" stroke="rgba(0, 240, 255, 0.25)" strokeWidth="1" />
          <text x="770" y="176" fill="#ffffff" fontSize="11" fontFamily="var(--font-display)" fontWeight="600">B WING</text>
          <text x="770" y="193" fill="#00f0ff" fontSize="10" fontFamily="var(--font-mono)">{z2.current_flow_lpm} L/min • {z2.valve_state}</text>

          {/* --- Branch 3: Zone 3 --- */}
          <path d="M 540 260 L 630 260" className="fluid-pipe" />
          <path d="M 540 260 L 630 260" className={`fluid-flow ${isPumpOn && z3.valve_state === 'OPEN' ? 'fast' : 'stopped'}`} />
          {/* Valve 3 */}
          <g
            transform="translate(645, 260)"
            style={{ cursor: 'pointer' }}
            onClick={() => onToggleValve && onToggleValve(3, z3.valve_state === 'OPEN' ? 'CLOSED' : 'OPEN')}
          >
            <polygon points="-12,-10 0,0 -12,10" fill={z3.valve_state === 'OPEN' ? '#10b981' : '#ef4444'} />
            <polygon points="12,-10 0,0 12,10" fill={z3.valve_state === 'OPEN' ? '#10b981' : '#ef4444'} />
            <circle cx="0" cy="0" r="4" fill="#fff" />
          </g>
          <path d="M 660 260 L 760 260" className="fluid-pipe" />
          <path d="M 660 260 L 760 260" className={`fluid-flow ${isPumpOn && z3.valve_state === 'OPEN' ? 'fast' : 'stopped'}`} />
          {/* C Wing Destination Card */}
          <rect x="760" y="238" width="140" height="44" rx="6" fill="#0c172a" stroke="rgba(0, 240, 255, 0.25)" strokeWidth="1" />
          <text x="770" y="256" fill="#ffffff" fontSize="11" fontFamily="var(--font-display)" fontWeight="600">C WING</text>
          <text x="770" y="273" fill="#00f0ff" fontSize="10" fontFamily="var(--font-mono)">{z3.current_flow_lpm} L/min • {z3.valve_state}</text>
        </svg>
      </div>
    </div>
  );
}
