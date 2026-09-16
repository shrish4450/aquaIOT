import React from 'react';
import { Database, ArrowDownRight, Droplets, AlertTriangle, ShieldCheck, Power } from 'lucide-react';

export default function KpiRow({ tank, accountability, activeAlertsCount, criticalAlertsCount, pumpState, zones }) {
  const tankPct = tank?.level_percentage || 0;
  const tankLiters = tank?.current_level_liters || 0;
  const incoming = accountability?.total_incoming_liters || 0;
  const consumed = accountability?.total_consumed_liters || 0;
  const unaccounted = accountability?.unaccounted_liters || 0;
  const unaccountedPct = accountability?.unaccounted_percentage || 0;
  const accStatus = accountability?.status || 'NORMAL';

  const openValvesCount = zones?.filter((z) => z.valve_state === 'OPEN').length || 0;

  // Accountability status badge class
  const getAccBadgeClass = () => {
    if (accStatus === 'CRITICAL' || accStatus === 'POSSIBLE_LEAK') return 'critical';
    if (accStatus === 'WARNING') return 'warning';
    return 'normal';
  };

  return (
    <div className="kpi-grid">
      {/* 1. Tank Level */}
      <div className={`glass-panel kpi-card ${tankPct >= 90 ? 'danger' : tankPct <= 10 ? 'danger' : tankPct <= 20 ? 'warning' : 'success'}`}>
        <div className="kpi-label">
          <span>Reservoir Level</span>
          <Database size={16} color="var(--cyan-primary)" />
        </div>
        <div className="kpi-value">
          {tankPct.toFixed(1)} <span style={{ fontSize: '1.05rem', color: '#94a3b8' }}>%</span>
        </div>
        <div className="kpi-subtext">
          {tankLiters.toFixed(1)} L of {tank?.capacity_liters || 100} L Capacity
        </div>
      </div>

      {/* 2. Total Incoming Water Today */}
      <div className="glass-panel kpi-card">
        <div className="kpi-label">
          <span>Main Incoming Supply</span>
          <ArrowDownRight size={16} color="#38bdf8" />
        </div>
        <div className="kpi-value">
          {incoming.toFixed(1)} <span style={{ fontSize: '1.05rem', color: '#94a3b8' }}>L</span>
        </div>
        <div className="kpi-subtext">Cumulative from Primary Flow Meter</div>
      </div>

      {/* 3. Total Zone Consumed Today */}
      <div className="glass-panel kpi-card">
        <div className="kpi-label">
          <span>Total Consumed</span>
          <Droplets size={16} color="#00f0ff" />
        </div>
        <div className="kpi-value">
          {consumed.toFixed(1)} <span style={{ fontSize: '1.05rem', color: '#94a3b8' }}>L</span>
        </div>
        <div className="kpi-subtext">Sum of Zones 1, 2, and 3 Meters</div>
      </div>

      {/* 4. Water Accountability / Unaccounted Loss */}
      <div className={`glass-panel kpi-card ${getAccBadgeClass()}`}>
        <div className="kpi-label">
          <span>Unaccounted Loss</span>
          <span className={`status-badge ${getAccBadgeClass()}`}>{accStatus}</span>
        </div>
        <div className="kpi-value" style={{ color: accStatus === 'NORMAL' ? '#fff' : accStatus === 'WARNING' ? '#f59e0b' : '#ef4444' }}>
          {unaccounted.toFixed(1)} <span style={{ fontSize: '1.05rem', color: '#94a3b8' }}>L ({unaccountedPct.toFixed(1)}%)</span>
        </div>
        <div className="kpi-subtext">Formula: Total Inflow - Sum(Zone Usage)</div>
      </div>

      {/* 5. Active System Alerts */}
      <div className={`glass-panel kpi-card ${activeAlertsCount > 0 ? (criticalAlertsCount > 0 ? 'danger' : 'warning') : 'success'}`}>
        <div className="kpi-label">
          <span>Active Alerts</span>
          {activeAlertsCount > 0 ? <AlertTriangle size={16} color="#ef4444" /> : <ShieldCheck size={16} color="#10b981" />}
        </div>
        <div className="kpi-value" style={{ color: activeAlertsCount > 0 ? (criticalAlertsCount > 0 ? '#ef4444' : '#f59e0b') : '#10b981' }}>
          {activeAlertsCount}
          {criticalAlertsCount > 0 && (
            <span style={{ fontSize: '0.85rem', color: '#ef4444', marginLeft: '6px' }}>({criticalAlertsCount} CRITICAL)</span>
          )}
        </div>
        <div className="kpi-subtext">{activeAlertsCount === 0 ? 'All parameters within safety thresholds' : 'Immediate attention required'}</div>
      </div>

      {/* 6. Actuators Status */}
      <div className="glass-panel kpi-card">
        <div className="kpi-label">
          <span>Actuators Status</span>
          <Power size={16} color={pumpState === 'ON' ? '#10b981' : '#ef4444'} />
        </div>
        <div className="kpi-value" style={{ fontSize: '1.35rem' }}>
          Pump: <span style={{ color: pumpState === 'ON' ? '#10b981' : '#ef4444', marginLeft: '4px' }}>{pumpState}</span>
        </div>
        <div className="kpi-subtext">
          Valves Active: {openValvesCount} / 3 Open
        </div>
      </div>
    </div>
  );
}
