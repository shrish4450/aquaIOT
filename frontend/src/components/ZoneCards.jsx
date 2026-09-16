import React, { useState } from 'react';
import { Layers, Droplet, Edit3, Power, ExternalLink, Info } from 'lucide-react';

export default function ZoneCards({ zones, onToggleValve, onUpdateAllocation, onInspectZone }) {
  const [editingZoneId, setEditingZoneId] = useState(null);
  const [newQuota, setNewQuota] = useState('');

  const handleEditClick = (zone, e) => {
    if (e) e.stopPropagation();
    setEditingZoneId(zone.zone_id);
    setNewQuota(zone.allocated_today_l);
  };

  const handleSaveQuota = (zoneId, e) => {
    if (e) e.stopPropagation();
    if (newQuota && !isNaN(newQuota) && Number(newQuota) > 0) {
      onUpdateAllocation(zoneId, Number(newQuota));
      setEditingZoneId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Admin Zone Overview Table (Requirement 12) */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
              Facility Zone Water Accounting & Telemetry Overview
            </h3>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
              Multi-sector flow monitoring, quota allocation, and distribution balance table
            </p>
          </div>
          <span className="kpi-subtext" style={{ fontSize: '0.75rem' }}>
            Click any zone row to open deep-dive telemetry
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.9)', borderBottom: '1px solid rgba(148, 163, 184, 0.12)' }}>
                <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>Zone</th>
                <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>Water Received</th>
                <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>Water Consumed</th>
                <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>Difference</th>
                <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>Allocation</th>
                <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>Remaining</th>
                <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>Current Flow</th>
                <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>Valve</th>
                <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {zones?.map((z) => {
                const received = z.water_received_today_l || (z.consumed_today_l * 1.08);
                const consumed = z.consumed_today_l;
                const diff = z.zone_difference_l !== undefined ? z.zone_difference_l : (received - consumed);
                const isOpen = z.valve_state === 'OPEN';

                return (
                  <tr
                    key={z.zone_id}
                    onClick={() => onInspectZone && onInspectZone(z.zone_id)}
                    style={{
                      borderBottom: '1px solid rgba(148, 163, 184, 0.08)',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    className="table-row-hover"
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#f8fafc' }}>{z.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Sector #{z.zone_id}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#38bdf8', fontWeight: 600 }}>
                      {received.toFixed(1)} L
                    </td>
                    <td style={{ padding: '12px 16px', color: '#60a5fa', fontWeight: 600 }}>
                      {consumed.toFixed(1)} L
                    </td>
                    <td style={{ padding: '12px 16px', color: diff >= 0 ? '#34d399' : '#ef4444', fontWeight: 600 }}>
                      {diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)} L
                    </td>
                    <td style={{ padding: '12px 16px', color: '#e2e8f0' }}>
                      {z.allocated_today_l.toFixed(1)} L
                    </td>
                    <td style={{ padding: '12px 16px', color: z.remaining_today_l <= 5 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                      {z.remaining_today_l.toFixed(1)} L
                    </td>
                    <td style={{ padding: '12px 16px', color: isOpen ? '#38bdf8' : '#64748b', fontWeight: 600 }}>
                      {z.current_flow_lpm.toFixed(2)} L/min
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: isOpen ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: isOpen ? '#34d399' : '#f87171',
                          border: `1px solid ${isOpen ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}
                      >
                        {z.valve_state}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`status-badge ${z.status === 'NORMAL' ? 'normal' : (z.status === 'WARNING' ? 'warning' : 'critical')}`}>
                        {z.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onInspectZone) onInspectZone(z.zone_id);
                        }}
                        className="scenario-btn"
                        style={{ padding: '4px 8px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <ExternalLink size={12} /> Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Interactive Zone Cards Grid */}
      <div className="zones-grid">
        {zones?.map((z) => {
          const pct = Math.min(100, Math.max(0, z.usage_percentage));
          const isExceeded = z.status === 'EXCEEDED' || pct >= 100;
          const isWarning = z.status === 'WARNING' || (pct >= 80 && !isExceeded);
          const isOpen = z.valve_state === 'OPEN';
          const received = z.water_received_today_l || (z.consumed_today_l * 1.08);
          const diff = z.zone_difference_l !== undefined ? z.zone_difference_l : (received - z.consumed_today_l);

          let progressClass = 'normal';
          if (isExceeded) progressClass = 'exceeded';
          else if (isWarning) progressClass = 'warning';

          return (
            <div
              key={z.zone_id}
              className={`glass-panel zone-card ${isExceeded ? 'danger' : isWarning ? 'warning' : ''}`}
              onClick={() => onInspectZone && onInspectZone(z.zone_id)}
              style={{ cursor: 'pointer' }}
            >
              <div className="zone-card-header">
                <div>
                  <h4 className="zone-title font-display">{z.name}</h4>
                  <span className="kpi-subtext">Zone ID: #{z.zone_id} • ESP32 Controller</span>
                </div>
                <span className={`status-badge ${isExceeded ? 'exceeded' : isWarning ? 'warning' : 'normal'}`}>
                  {z.status}
                </span>
              </div>

              {/* Allocation Meter Progress Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span className="font-mono" style={{ fontSize: '0.82rem', color: '#e2e8f0' }}>
                    {z.consumed_today_l.toFixed(1)} L consumed / {z.allocated_today_l.toFixed(1)} L quota
                  </span>
                  <span className="font-mono" style={{ fontSize: '0.82rem', fontWeight: 600, color: isExceeded ? '#ef4444' : isWarning ? '#f59e0b' : 'var(--cyan-primary)' }}>
                    {z.usage_percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="progress-bar-track">
                  <div className={`progress-bar-fill ${progressClass}`} style={{ width: `${pct}%` }} />
                </div>
              </div>

              {/* Received & Consumed & Difference Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', padding: '10px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '6px', fontSize: '0.78rem' }}>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.68rem' }}>RECEIVED</span>
                  <strong style={{ color: '#38bdf8' }}>{received.toFixed(1)} L</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.68rem' }}>CONSUMED</span>
                  <strong style={{ color: '#60a5fa' }}>{z.consumed_today_l.toFixed(1)} L</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.68rem' }}>DIFF</span>
                  <strong style={{ color: diff >= 0 ? '#34d399' : '#ef4444' }}>+{diff.toFixed(1)} L</strong>
                </div>
              </div>

              {/* Metrics Breakdown Grid */}
              <div className="zone-metrics-row">
                <div className="metric-item">
                  <span className="metric-label">Current Flow</span>
                  <span className="metric-val" style={{ color: isOpen ? '#00f0ff' : '#64748b' }}>
                    {z.current_flow_lpm.toFixed(2)} <span style={{ fontSize: '0.75rem' }}>L/min</span>
                  </span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Remaining Quota</span>
                  <span className="metric-val" style={{ color: z.remaining_today_l <= 5 ? '#ef4444' : '#e2e8f0' }}>
                    {z.remaining_today_l.toFixed(1)} <span style={{ fontSize: '0.75rem' }}>L</span>
                  </span>
                </div>
              </div>

              {/* Interactive Quota Editing */}
              {editingZoneId === z.zone_id ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="number"
                    value={newQuota}
                    onChange={(e) => setNewQuota(e.target.value)}
                    className="scenario-btn"
                    style={{ width: '90px', background: '#091322', color: '#fff', border: '1px solid var(--border-bright)' }}
                  />
                  <button className="btn-ack" onClick={(e) => handleSaveQuota(z.zone_id, e)}>
                    Save
                  </button>
                  <button className="btn-ack" style={{ color: '#94a3b8' }} onClick={(e) => { e.stopPropagation(); setEditingZoneId(null); }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onInspectZone) onInspectZone(z.zone_id);
                    }}
                    style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                  >
                    <Info size={12} /> Inspect Details
                  </button>

                  <button
                    onClick={(e) => handleEditClick(z, e)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Edit3 size={12} /> Edit Quota
                  </button>
                </div>
              )}

              {/* Valve Actuation Row */}
              <div className="valve-action-row" onClick={(e) => e.stopPropagation()}>
                <span className="kpi-subtext" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Power size={14} color={isOpen ? '#10b981' : '#ef4444'} />
                  Valve: <strong style={{ color: isOpen ? '#10b981' : '#ef4444' }}>{z.valve_state}</strong>
                </span>
                <button
                  className={`btn-valve ${isOpen ? 'open' : 'closed'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleValve(z.zone_id, isOpen ? 'CLOSED' : 'OPEN');
                  }}
                >
                  {isOpen ? 'CLOSE VALVE' : 'OPEN VALVE'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
