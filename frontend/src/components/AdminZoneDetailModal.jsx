import React, { useState, useEffect } from 'react';
import {
  X,
  Droplets,
  Activity,
  User as UserIcon,
  Shield,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Info
} from 'lucide-react';
import { fetchAdminZoneDetail, controlValve } from '../services/api';

export default function AdminZoneDetailModal({ zoneId, isOpen, onClose, onActionExecuted }) {
  const [zoneDetail, setZoneDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [togglingValve, setTogglingValve] = useState(false);

  useEffect(() => {
    if (!isOpen || !zoneId) return;

    let isMounted = true;
    setLoading(true);

    fetchAdminZoneDetail(zoneId)
      .then((data) => {
        if (isMounted) {
          setZoneDetail(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error fetching zone detail:', err);
        if (isMounted) setLoading(false);
      });

    const timer = setInterval(() => {
      fetchAdminZoneDetail(zoneId)
        .then((data) => {
          if (isMounted) setZoneDetail(data);
        })
        .catch(() => {});
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [isOpen, zoneId]);

  if (!isOpen || !zoneId) return null;

  const handleToggleValve = async () => {
    if (!zoneDetail) return;
    const targetState = zoneDetail.valve_state === 'OPEN' ? 'CLOSED' : 'OPEN';
    setTogglingValve(true);
    try {
      await controlValve(zoneId, targetState, 'Admin zone detail action');
      const updated = await fetchAdminZoneDetail(zoneId);
      setZoneDetail(updated);
      if (onActionExecuted) onActionExecuted();
    } catch (err) {
      alert(`Failed to switch valve: ${err.message}`);
    } finally {
      setTogglingValve(false);
    }
  };

  const received = zoneDetail?.water_received_today_l || 0;
  const consumed = zoneDetail?.water_consumed_today_l || 0;
  const diff = zoneDetail?.zone_difference_l || 0;
  const allocated = zoneDetail?.allocated_today_l || 0;
  const remaining = zoneDetail?.remaining_today_l || 0;
  const usagePct = zoneDetail?.usage_percentage || 0;
  const currentFlow = zoneDetail?.current_flow_lpm || 0;
  const valveState = zoneDetail?.valve_state || 'OPEN';

  // SVG Bar Chart Dimensions & Scaling
  const barMetrics = [
    { label: 'Water Received', val: received, color: '#38bdf8' },
    { label: 'Water Consumed', val: consumed, color: '#818cf8' },
    { label: 'Zone Difference', val: Math.max(0, diff), color: '#34d399' },
    { label: 'Remaining Budget', val: Math.max(0, remaining), color: remaining <= 5 ? '#f87171' : '#f59e0b' }
  ];
  const maxBarVal = Math.max(...barMetrics.map(m => m.val), allocated, 10);

  // SVG Line Chart Dimensions & Scaling
  const readings = zoneDetail?.recent_readings || [];
  const svgW = 750;
  const svgH = 180;
  const padL = 45;
  const padR = 25;
  const padT = 20;
  const padB = 30;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;

  const maxFlow = Math.max(...readings.map(r => r.value), 4.0);
  const getFlowX = (idx) => padL + (idx / Math.max(1, readings.length - 1)) * chartW;
  const getFlowY = (val) => padT + chartH - (val / maxFlow) * chartH;

  const flowPoints = readings.map((r, i) => `${getFlowX(i)},${getFlowY(r.value)}`);
  const flowPathD = flowPoints.length > 0 ? `M ${flowPoints.join(' L ')}` : '';
  const flowAreaD = flowPoints.length > 0
    ? `M ${flowPoints.join(' L ')} L ${getFlowX(readings.length - 1)},${padT + chartH} L ${padL},${padT + chartH} Z`
    : '';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '850px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="brand-logo-icon" style={{ width: '40px', height: '40px' }}>
              <Droplets size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc' }}>
                  {zoneDetail?.name || `Zone ${zoneId}`}
                </h2>
                <span className={`status-badge ${zoneDetail?.status === 'NORMAL' ? 'normal' : 'warning'}`}>
                  {zoneDetail?.status || 'NORMAL'}
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                {zoneDetail?.description || 'Sub-distribution sector node'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="scenario-btn" style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {loading && !zoneDetail ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            Loading zone telemetry and telemetry history...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Top Info Bar: Assigned User & Valve Action */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 18px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(148, 163, 184, 0.15)',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <UserIcon size={18} color="#38bdf8" />
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>
                    Assigned Resident
                  </span>
                  <span style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: 700 }}>
                    {zoneDetail?.assigned_user ? `${zoneDetail.assigned_user.full_name} (${zoneDetail.assigned_user.email})` : 'No resident assigned'}
                  </span>
                </div>
              </div>

              {/* Valve Control Quick Actuator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>
                    Actuator Valve
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: valveState === 'OPEN' ? '#10b981' : '#ef4444' }}>
                    {valveState}
                  </span>
                </div>
                <button
                  onClick={handleToggleValve}
                  disabled={togglingValve}
                  className="scenario-btn"
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    background: valveState === 'OPEN' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    borderColor: valveState === 'OPEN' ? '#ef4444' : '#10b981',
                    color: valveState === 'OPEN' ? '#f87171' : '#34d399'
                  }}
                >
                  {togglingValve ? 'Switching...' : (valveState === 'OPEN' ? 'Close Valve' : 'Open Valve')}
                </button>
              </div>
            </div>

            {/* Metrics Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
              <div className="glass-panel" style={{ padding: '14px' }}>
                <span className="kpi-label" style={{ fontSize: '0.68rem' }}>WATER RECEIVED</span>
                <div className="kpi-value" style={{ fontSize: '1.35rem', color: '#38bdf8' }}>
                  {received.toFixed(1)} <span style={{ fontSize: '0.8rem' }}>L</span>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '14px' }}>
                <span className="kpi-label" style={{ fontSize: '0.68rem' }}>WATER CONSUMED</span>
                <div className="kpi-value" style={{ fontSize: '1.35rem', color: '#818cf8' }}>
                  {consumed.toFixed(1)} <span style={{ fontSize: '0.8rem' }}>L</span>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '14px' }}>
                <span className="kpi-label" style={{ fontSize: '0.68rem' }}>ZONE DIFFERENCE</span>
                <div className="kpi-value" style={{ fontSize: '1.35rem', color: '#34d399' }}>
                  +{diff.toFixed(1)} <span style={{ fontSize: '0.8rem' }}>L</span>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '14px' }}>
                <span className="kpi-label" style={{ fontSize: '0.68rem' }}>REMAINING BUDGET</span>
                <div className="kpi-value" style={{ fontSize: '1.35rem', color: remaining <= 5 ? '#f87171' : '#10b981' }}>
                  {remaining.toFixed(1)} <span style={{ fontSize: '0.8rem' }}>L</span>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '14px' }}>
                <span className="kpi-label" style={{ fontSize: '0.68rem' }}>CURRENT FLOW</span>
                <div className="kpi-value" style={{ fontSize: '1.35rem', color: currentFlow > 3.0 ? '#f59e0b' : '#38bdf8' }}>
                  {currentFlow.toFixed(2)} <span style={{ fontSize: '0.8rem' }}>L/min</span>
                </div>
              </div>
            </div>

            {/* Received vs Consumed Bar Comparison (Native SVG) */}
            <div className="glass-panel" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#f8fafc' }}>
                  Zone Water Balance Breakdown
                </h4>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  Allocated Quota: <strong style={{ color: '#f8fafc' }}>{allocated.toFixed(1)} L</strong>
                </span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {barMetrics.map((m, idx) => {
                  const pct = Math.min(100, (m.val / maxBarVal) * 100);
                  return (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                        <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{m.label}</span>
                        <span className="font-mono" style={{ color: m.color, fontWeight: 700 }}>
                          {m.val.toFixed(1)} L ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '10px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '5px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: m.color,
                            borderRadius: '5px',
                            transition: 'width 0.4s ease'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Flow Waveform Chart (Native SVG) */}
            <div className="glass-panel" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#f8fafc' }}>
                  Recent Flow Telemetry (L/min)
                </h4>
                <span className="font-mono" style={{ fontSize: '0.75rem', color: '#38bdf8' }}>
                  {currentFlow.toFixed(2)} L/min Instantaneous
                </span>
              </div>
              <div style={{ width: '100%', height: '180px' }}>
                <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="adminZoneFlowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Grid lines */}
                  {[0, 0.33, 0.66, 1.0].map((frac, i) => {
                    const y = padT + chartH * (1 - frac);
                    const val = (frac * maxFlow).toFixed(1);
                    return (
                      <g key={i}>
                        <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="rgba(255, 255, 255, 0.07)" strokeDasharray="3 3" />
                        <text x={padL - 8} y={y + 3} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">
                          {val}
                        </text>
                      </g>
                    );
                  })}

                  {/* Under-curve fill */}
                  {flowAreaD && <path d={flowAreaD} fill="url(#adminZoneFlowGrad)" />}

                  {/* Stroke path */}
                  {flowPathD && <path d={flowPathD} fill="none" stroke="#38bdf8" strokeWidth="2" />}

                  {/* Points */}
                  {readings.map((r, i) => (
                    <circle
                      key={r.id || i}
                      cx={getFlowX(i)}
                      cy={getFlowY(r.value)}
                      r="3"
                      fill="#38bdf8"
                      stroke="#0f172a"
                      strokeWidth="1.5"
                    />
                  ))}

                  {/* Time Axis */}
                  {readings.filter((_, idx) => idx % 6 === 0).map((r, i) => {
                    const originalIdx = i * 6;
                    const time = new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    return (
                      <text key={i} x={getFlowX(originalIdx)} y={svgH - 8} textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="monospace">
                        {time}
                      </text>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Zone Alerts Feed */}
            {zoneDetail?.alerts && zoneDetail.alerts.length > 0 && (
              <div className="glass-panel" style={{ padding: '18px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.92rem', color: '#f8fafc' }}>
                  Active Alerts for Zone {zoneId}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {zoneDetail.alerts.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '6px',
                        background: a.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        border: `1px solid ${a.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                        fontSize: '0.82rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span style={{ color: a.severity === 'CRITICAL' ? '#f87171' : '#fbbf24', fontWeight: 600 }}>
                        {a.message}
                      </span>
                      <span className="font-mono" style={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                        {new Date(a.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
