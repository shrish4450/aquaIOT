import React, { useState, useEffect, useCallback } from 'react';
import {
  Droplets,
  Calendar,
  AlertTriangle,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  TrendingDown
} from 'lucide-react';
import {
  fetchZoneUserDashboard,
  fetchZoneUserHistory,
  fetchZoneUserAlerts
} from '../services/api';

export default function ZoneUserDashboard({ user, onLogout, onSwitchUser }) {
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'usage' | 'alerts' | 'profile'
  const [dashboard, setDashboard] = useState(null);
  const [historyPeriod, setHistoryPeriod] = useState('today');
  const [historyData, setHistoryData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load Zone Dashboard telemetry
  const loadZoneData = useCallback(async () => {
    try {
      const [dash, alts] = await Promise.all([
        fetchZoneUserDashboard(),
        fetchZoneUserAlerts()
      ]);
      setDashboard(dash);
      setAlerts(alts);
    } catch (e) {
      console.warn('Zone data fetch error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load History data on tab or period switch
  const loadHistory = useCallback(async (period) => {
    try {
      const data = await fetchZoneUserHistory(period.toUpperCase());
      setHistoryData(data);
    } catch (e) {
      console.warn('History fetch error:', e.message);
    }
  }, []);

  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash.replace('#', '');
      if (['home', 'usage', 'alerts', 'profile'].includes(h)) {
        setActiveTab(h);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    loadZoneData();
    const timer = setInterval(() => {
      loadZoneData();
    }, 2000);
    return () => clearInterval(timer);
  }, [loadZoneData]);

  useEffect(() => {
    if (activeTab === 'usage') {
      loadHistory(historyPeriod);
    }
  }, [activeTab, historyPeriod, loadHistory]);

  const usedL = Math.round(dashboard?.water_consumed_today_l || 0);
  const limitL = Math.round(dashboard?.allocated_today_l || 80);
  const leftL = Math.max(0, Math.round(dashboard?.remaining_allocation_l || 0));
  const currentFlow = dashboard?.current_flow_lpm || 0;
  const isValveOpen = dashboard?.valve_state === 'OPEN';

  // Percentage calculations for water left
  const pctUsed = Math.min(100, Math.round((usedL / Math.max(1, limitL)) * 100));
  const pctLeft = Math.max(0, 100 - pctUsed);

  // Clear human status
  let statusHeadline = 'Water Supply Available';
  let statusDetail = 'Water is flowing normally to your home';
  let statusBadge = 'GOOD';
  let statusBadgeClass = 'badge-success';
  let statusBorderClass = 'status-good-border';

  if (!isValveOpen) {
    statusHeadline = 'Water Supply Stopped';
    statusDetail = 'The water supply to your zone has been closed';
    statusBadge = 'ACTION NEEDED';
    statusBadgeClass = 'badge-destructive';
    statusBorderClass = 'status-action-border';
  } else if (leftL <= 0) {
    statusHeadline = 'Water Limit Reached';
    statusDetail = "You have reached today's allocated water limit";
    statusBadge = 'ACTION NEEDED';
    statusBadgeClass = 'badge-destructive';
    statusBorderClass = 'status-action-border';
  } else if (leftL <= 15) {
    statusHeadline = 'Water Supply Is Low';
    statusDetail = "You are close to today's water limit";
    statusBadge = 'CHECK';
    statusBadgeClass = 'badge-warning';
    statusBorderClass = 'status-check-border';
  }

  return (
    <div className="shadcn-container" style={{ maxWidth: '1000px' }}>
      {/* 1. Zone User Sub-navigation */}
      <div style={{ display: 'flex', marginBottom: '2rem' }}>
        <nav
          className="shadcn-tabs-list"
          aria-label="Zone User Navigation"
        >
          <button
            onClick={() => setActiveTab('home')}
            className={`shadcn-tabs-trigger ${activeTab === 'home' ? 'active' : ''}`}
          >
            <Droplets size={14} />
            <span>Home</span>
          </button>

          <button
            onClick={() => setActiveTab('usage')}
            className={`shadcn-tabs-trigger ${activeTab === 'usage' ? 'active' : ''}`}
          >
            <Calendar size={14} />
            <span>My Usage</span>
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`shadcn-tabs-trigger ${activeTab === 'alerts' ? 'active' : ''}`}
          >
            <AlertTriangle size={14} />
            <span>Alerts {alerts.filter((a) => !a.is_resolved).length > 0 ? `(${alerts.filter((a) => !a.is_resolved).length})` : ''}</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`shadcn-tabs-trigger ${activeTab === 'profile' ? 'active' : ''}`}
          >
            <UserIcon size={14} />
            <span>Profile</span>
          </button>
        </nav>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: HOME (THE GOLDEN 4-QUESTION INTERFACE)                 */}
      {/* ============================================================ */}
      {activeTab === 'home' && (
        <div>
          {/* Header Title */}
          <div style={{ marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span className="shadcn-badge badge-outline" style={{ fontSize: '0.7rem' }}>
                Your Water
              </span>
            </div>
            <h1 className="accessible-heading-1" style={{ margin: '0 0 0.25rem 0' }}>
              {dashboard?.zone_name || user?.zone_name || (user?.zone_id === 1 ? 'A Wing' : user?.zone_id === 2 ? 'B Wing' : 'C Wing')}
            </h1>
            <p className="accessible-subheading">
              Welcome back, {user?.full_name || 'Resident'}. Here is your water summary today.
            </p>
          </div>

          {/* Large Status Area */}
          <div
            className={`shadcn-card ${statusBorderClass}`}
            style={{
              padding: '1.25rem 1.5rem',
              marginBottom: '1.75rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}
          >
            <div>
              <span className={`shadcn-badge ${statusBadgeClass}`}>
                {statusBadge}
              </span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'hsl(var(--foreground))', margin: '0.5rem 0 0.25rem 0' }}>
                {statusHeadline}
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
                {statusDetail}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="simple-card-label" style={{ display: 'block' }}>
                Water Valve
              </span>
              <span style={{ fontSize: '1.125rem', fontWeight: 700, color: isValveOpen ? 'var(--success-green)' : 'var(--destructive-red)' }}>
                {isValveOpen ? 'OPEN' : 'CLOSED'}
              </span>
            </div>
          </div>

          {/* THE 4 CORE METRIC CARDS */}
          <div className="simple-cards-grid" style={{ marginBottom: '1.75rem' }}>
            {/* 1. WATER COMING IN */}
            <div className="shadcn-card">
              <span className="simple-card-label">WATER COMING IN</span>
              <p className="simple-metric-sub">Flowing right now</p>
              <div className="simple-metric-value" style={{ color: 'var(--water-blue)' }}>
                {currentFlow.toFixed(1)} <span className="simple-metric-unit">L/min</span>
              </div>
              <p className="simple-metric-sub" style={{ marginTop: '0.25rem' }}>
                {isValveOpen && currentFlow > 0 ? 'Flowing actively' : 'No flow detected'}
              </p>
            </div>

            {/* 2. WATER USED TODAY */}
            <div className="shadcn-card">
              <span className="simple-card-label">WATER USED TODAY</span>
              <p className="simple-metric-sub">Total consumed</p>
              <div className="simple-metric-value">
                {usedL} <span className="simple-metric-unit">L</span>
              </div>
              <p className="simple-metric-sub" style={{ marginTop: '0.25rem' }}>
                of {limitL} L Daily Limit
              </p>
            </div>

            {/* 3. WATER LIMIT */}
            <div className="shadcn-card">
              <span className="simple-card-label">DAILY WATER LIMIT</span>
              <p className="simple-metric-sub">Allowed for today</p>
              <div className="simple-metric-value">
                {limitL} <span className="simple-metric-unit">L</span>
              </div>
              <p className="simple-metric-sub" style={{ marginTop: '0.25rem' }}>
                Resets every midnight
              </p>
            </div>

            {/* 4. WATER LEFT */}
            <div className="shadcn-card">
              <span className="simple-card-label">WATER LEFT</span>
              <p className="simple-metric-sub">Remaining budget</p>
              <div className="simple-metric-value" style={{ color: leftL <= 15 ? 'var(--warning-amber)' : 'var(--success-green)' }}>
                {leftL} <span className="simple-metric-unit">L</span>
              </div>
              <p className="simple-metric-sub" style={{ marginTop: '0.25rem' }}>
                {pctLeft}% remaining
              </p>
            </div>
          </div>

          {/* LARGE SIMPLE WATER PROGRESS BAR */}
          <div className="shadcn-card" style={{ marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                  Today's Water Budget
                </h3>
                <span style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
                  {usedL} Liters used out of {limitL} Liters limit
                </span>
              </div>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: leftL <= 15 ? 'var(--warning-amber)' : 'var(--success-green)' }}>
                {leftL} L left ({pctLeft}%)
              </span>
            </div>

            <div className="shadcn-progress-track" style={{ height: '10px' }}>
              <div
                className="shadcn-progress-indicator"
                style={{
                  width: `${pctUsed}%`,
                  backgroundColor: pctUsed >= 100 ? 'var(--destructive-red)' : pctUsed >= 85 ? 'var(--warning-amber)' : 'var(--water-blue)'
                }}
              />
            </div>
          </div>

          {/* Quick Action Navigation */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('usage')}
              className="shadcn-btn btn-secondary"
              style={{ flex: 1, minWidth: '180px' }}
            >
              <span>View Usage History</span>
              <ArrowRight size={14} />
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className="shadcn-btn btn-secondary"
              style={{ flex: 1, minWidth: '180px' }}
            >
              <span>View Alerts</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: MY USAGE (1 SIMPLE CHART AT A TIME)                   */}
      {/* ============================================================ */}
      {activeTab === 'usage' && (
        <div>
          <div style={{ marginBottom: '1.75rem' }}>
            <h1 className="accessible-heading-1">
              My Water Usage History
            </h1>
            <p className="accessible-subheading">
              Track how much water your zone uses over time.
            </p>
          </div>

          {/* Time Filter Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7days', label: 'Last 7 Days' },
              { id: '30days', label: 'Last 30 Days' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setHistoryPeriod(p.id)}
                className={`shadcn-btn ${historyPeriod === p.id ? 'btn-default' : 'btn-outline'}`}
                style={{ fontSize: '0.8125rem', height: '32px' }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* ONE SIMPLE READABLE CHART */}
          <div className="shadcn-card" style={{ marginBottom: '1.5rem' }}>
            <h2 className="accessible-heading-2" style={{ marginBottom: '0.25rem' }}>
              Water Used ({historyPeriod === 'today' ? 'Today' : historyPeriod === 'yesterday' ? 'Yesterday' : historyPeriod === '7days' ? 'Last 7 Days' : 'Last 30 Days'})
            </h2>
            <p className="accessible-subheading" style={{ marginBottom: '1.25rem' }}>
              Total consumed: <strong style={{ color: 'hsl(var(--foreground))' }}>{Math.round(historyData?.total_consumed_l || usedL)} Liters</strong>
            </p>

            {/* Simple Bar Visualization */}
            {(() => {
              const points = (historyData?.data_points && historyData.data_points.length > 0)
                ? historyData.data_points.slice(-6).map((pt, idx) => {
                    let label = `Time ${idx + 1}`;
                    if (pt.timestamp) {
                      try {
                        const d = new Date(pt.timestamp);
                        if (historyPeriod === '7days' || historyPeriod === '30days') {
                          label = d.toLocaleDateString([], { weekday: 'short', month: 'numeric', day: 'numeric' });
                        } else {
                          label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        }
                      } catch (e) {}
                    }
                    return {
                      label,
                      consumed_l: pt.estimated_consumed_l || (pt.flow_lpm ? Number((pt.flow_lpm * 10).toFixed(1)) : 5.0)
                    };
                  })
                : [
                    { label: 'Morning (6 AM - 10 AM)', consumed_l: Math.round(usedL * 0.4) },
                    { label: 'Midday (10 AM - 2 PM)', consumed_l: Math.round(usedL * 0.3) },
                    { label: 'Afternoon (2 PM - 6 PM)', consumed_l: Math.round(usedL * 0.2) },
                    { label: 'Evening (6 PM - 10 PM)', consumed_l: Math.round(usedL * 0.1) },
                  ];

              const maxVal = Math.max(...points.map((d) => d.consumed_l), 10);

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {points.map((item, idx) => {
                    const barPct = Math.min(100, Math.max(5, Math.round((item.consumed_l / maxVal) * 100)));
                    return (
                      <div key={idx}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                          <span style={{ color: 'hsl(var(--muted-foreground))' }}>{item.label}</span>
                          <span style={{ color: 'hsl(var(--foreground))' }}>{item.consumed_l} Liters</span>
                        </div>
                        <div className="shadcn-progress-track" style={{ height: '8px' }}>
                          <div
                            className="shadcn-progress-indicator"
                            style={{
                              width: `${barPct}%`,
                              backgroundColor: 'var(--water-blue)'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Plain Summary */}
          <div className="simple-cards-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="shadcn-card">
              <span className="simple-card-label">AVERAGE DAILY USE</span>
              <div className="simple-metric-value" style={{ marginTop: '0.5rem' }}>
                {Math.round(historyData?.average_daily_l || usedL)} <span className="simple-metric-unit">L/day</span>
              </div>
            </div>
            <div className="shadcn-card">
              <span className="simple-card-label">PEAK WATER FLOW</span>
              <div className="simple-metric-value" style={{ color: 'var(--water-blue)', marginTop: '0.5rem' }}>
                {(historyData?.peak_flow_lpm || currentFlow).toFixed(1)} <span className="simple-metric-unit">L/min</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: ALERTS (RELEVANT TO ZONE USER ONLY)                   */}
      {/* ============================================================ */}
      {activeTab === 'alerts' && (
        <div>
          <div style={{ marginBottom: '1.75rem' }}>
            <h1 className="accessible-heading-1">
              Water Alerts for Your Zone
            </h1>
            <p className="accessible-subheading">
              Notifications about your water supply, leaks, or limit warnings.
            </p>
          </div>

          {alerts.length === 0 ? (
            <div
              className="shadcn-card"
              style={{
                padding: '3rem 2rem',
                textAlign: 'center',
                borderColor: 'rgba(34, 197, 94, 0.3)'
              }}
            >
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'hsl(var(--foreground))', margin: '0 0 0.25rem 0' }}>
                ✓ No Problems with Your Water Supply
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
                Everything is working normally in your zone. Water is flowing as expected.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {alerts.map((a) => {
                const isCritical = a.severity === 'CRITICAL';
                return (
                  <div
                    key={a.id}
                    className={`shadcn-card ${isCritical ? 'status-action-border' : 'status-check-border'}`}
                    style={{ padding: '1.25rem 1.5rem' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                      <span className={`shadcn-badge ${isCritical ? 'badge-destructive' : 'badge-warning'}`}>
                        {isCritical ? 'ACTION NEEDED' : 'CHECK'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                        {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                      {a.message}
                    </h3>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: PROFILE (RESIDENT ACCOUNT DETAILS)                     */}
      {/* ============================================================ */}
      {activeTab === 'profile' && (
        <div>
          <div style={{ marginBottom: '1.75rem' }}>
            <h1 className="accessible-heading-1">
              Your Account Profile
            </h1>
            <p className="accessible-subheading">
              Your registered resident account and assigned water zone.
            </p>
          </div>

          <div className="shadcn-card" style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <span className="simple-card-label" style={{ display: 'block', marginBottom: '0.25rem' }}>
                  Full Name
                </span>
                <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                  {user?.full_name || 'Resident'}
                </span>
              </div>

              <div className="shadcn-separator" />

              <div>
                <span className="simple-card-label" style={{ display: 'block', marginBottom: '0.25rem' }}>
                  Email Address
                </span>
                <span style={{ fontSize: '0.9375rem', color: 'hsl(var(--muted-foreground))' }}>
                  {user?.email}
                </span>
              </div>

              <div className="shadcn-separator" />

              <div>
                <span className="simple-card-label" style={{ display: 'block', marginBottom: '0.25rem' }}>
                  Assigned Water Zone
                </span>
                <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--water-blue)' }}>
                  {dashboard?.zone_name || user?.zone_name || (user?.zone_id === 1 ? 'A Wing' : user?.zone_id === 2 ? 'B Wing' : 'C Wing')}
                </span>
              </div>

              <div className="shadcn-separator" />

              <div>
                <span className="simple-card-label" style={{ display: 'block', marginBottom: '0.25rem' }}>
                  Supply Status
                </span>
                <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: isValveOpen ? 'var(--success-green)' : 'var(--destructive-red)' }}>
                  {isValveOpen ? '✓ Active & Available' : '● Supply Stopped (Valve Closed)'}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={onSwitchUser}
                className="shadcn-btn btn-outline"
              >
                Switch Account
              </button>
              <button
                onClick={onLogout}
                className="shadcn-btn btn-destructive"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
