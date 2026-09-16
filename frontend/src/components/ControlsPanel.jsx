import React from 'react';
import { Sliders, Power, Shield, CheckCircle2 } from 'lucide-react';

export default function ControlsPanel({ pumpState, zones, onTogglePump, onToggleValve }) {
  const isPumpOn = pumpState === 'ON';

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3 className="font-display" style={{ fontSize: '1.2rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders size={20} color="var(--cyan-primary)" />
          Actuator Manual Control & Safety Interlocks
        </h3>
        <p className="kpi-subtext">Direct MQTT manual dispatches with safety interlock indicators</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {/* Pump Override Console */}
        <div style={{ background: 'rgba(6, 12, 22, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span className="font-display" style={{ fontWeight: 600, color: '#fff' }}>Primary Booster Pump</span>
            <span className={`status-badge ${isPumpOn ? 'normal' : 'warning'}`}>{pumpState}</span>
          </div>
          <p className="kpi-subtext" style={{ marginBottom: '16px' }}>
            Supplies pressurized water from municipal mains to the primary reservoir.
          </p>
          <button
            className={`btn-valve ${isPumpOn ? 'closed' : 'open'}`}
            style={{ width: '100%', padding: '10px', fontSize: '0.85rem' }}
            onClick={() => onTogglePump(isPumpOn ? 'OFF' : 'ON')}
          >
            {isPumpOn ? 'STOP PUMP (OFF)' : 'START PUMP (ON)'}
          </button>
        </div>

        {/* Zone Valves Override */}
        <div style={{ background: 'rgba(6, 12, 22, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '18px' }}>
          <div style={{ marginBottom: '12px' }}>
            <span className="font-display" style={{ fontWeight: 600, color: '#fff' }}>Solenoid Valves Console</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {zones?.map((z) => {
              const isOpen = z.valve_state === 'OPEN';
              return (
                <div key={z.zone_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '6px' }}>
                  <span className="font-mono" style={{ fontSize: '0.82rem', color: '#e2e8f0' }}>Zone #{z.zone_id}</span>
                  <button
                    className={`btn-valve ${isOpen ? 'open' : 'closed'}`}
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    onClick={() => onToggleValve(z.zone_id, isOpen ? 'CLOSED' : 'OPEN')}
                  >
                    {isOpen ? 'OPEN' : 'CLOSED'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Automated Safety Interlocks */}
        <div style={{ background: 'rgba(6, 12, 22, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Shield size={16} color="#10b981" />
            <span className="font-display" style={{ fontWeight: 600, color: '#fff' }}>Automated Interlocks</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.82rem', color: '#cbd5e1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={14} color="#10b981" />
              <span>Auto-Cutoff Valve on Quota Exceeded (Enforced)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={14} color="#10b981" />
              <span>Auto-Stop Pump on Tank Overflow Level (&gt;90%)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={14} color="#10b981" />
              <span>Dry-Run Safeguard on Critical Low Level (&lt;10%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
