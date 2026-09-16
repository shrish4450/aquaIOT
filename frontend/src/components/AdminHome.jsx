import React from 'react';
import {
  ArrowRight,
  Droplets,
  Database,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Activity
} from 'lucide-react';

export default function AdminHome({
  dashboardData,
  alerts = [],
  onSelectZone,
  onViewAlerts,
  onNavigateTab
}) {
  const tank = dashboardData?.tank;
  const accountability = dashboardData?.accountability;
  const zones = dashboardData?.zones || [];

  const incomingTotal = accountability?.total_incoming_liters || 0;
  const consumedTotal = accountability?.total_consumed_liters || 0;
  const tankPercent = tank?.level_percentage || 0;

  // Determine overall tank status
  let tankStatus = 'GOOD';
  let tankBadgeClass = 'badge-success';
  let tankProgressColor = 'var(--success-green)';
  if (tankPercent >= 90 || tankPercent <= 10) {
    tankStatus = 'ACTION NEEDED';
    tankBadgeClass = 'badge-destructive';
    tankProgressColor = 'var(--destructive-red)';
  } else if (tankPercent <= 25) {
    tankStatus = 'CHECK';
    tankBadgeClass = 'badge-warning';
    tankProgressColor = 'var(--warning-amber)';
  }

  // Find active critical/warning alerts
  const activeAlerts = alerts.filter((a) => !a.is_resolved);
  const criticalAlert = activeAlerts.find((a) => a.severity === 'CRITICAL');
  const warningAlert = activeAlerts.find((a) => a.severity === 'WARNING');
  const mostUrgentAlert = criticalAlert || warningAlert;

  // Determine overall system status
  let systemHeadline = 'Everything is working normally';
  let systemStatusBadge = 'GOOD';
  let systemBadgeClass = 'badge-success';
  let systemBorderClass = 'status-good-border';
  let SystemIcon = ShieldCheck;

  if (criticalAlert) {
    systemHeadline = criticalAlert.message;
    systemStatusBadge = 'ACTION NEEDED';
    systemBadgeClass = 'badge-destructive';
    systemBorderClass = 'status-action-border';
    SystemIcon = AlertCircle;
  } else if (warningAlert) {
    systemHeadline = warningAlert.message;
    systemStatusBadge = 'CHECK';
    systemBadgeClass = 'badge-warning';
    systemBorderClass = 'status-check-border';
    SystemIcon = AlertTriangle;
  }

  // Helper for zone status wording
  const getZoneStatusInfo = (zone) => {
    const pct = zone.percentage_used || 0;
    const isClosed = zone.valve_state === 'CLOSED';
    if (isClosed) {
      return {
        label: 'STOPPED (Valve Closed)',
        badge: 'CHECK',
        color: 'var(--warning-amber)',
        badgeClass: 'badge-warning'
      };
    }
    if (pct >= 100) {
      return {
        label: 'Limit Reached',
        badge: 'ACTION NEEDED',
        color: 'var(--destructive-red)',
        badgeClass: 'badge-destructive'
      };
    }
    if (pct >= 85) {
      return {
        label: 'Almost at limit',
        badge: 'CHECK',
        color: 'var(--warning-amber)',
        badgeClass: 'badge-warning'
      };
    }
    return {
      label: 'Normal',
      badge: 'GOOD',
      color: 'var(--success-green)',
      badgeClass: 'badge-success'
    };
  };

  return (
    <div className="shadcn-container">
      {/* 1. Page Title & Human Intro */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 className="accessible-heading-1">
          Water Management Overview
        </h1>
        <p className="accessible-subheading">
          Current status of your facility's water supply, storage, and zones.
        </p>
      </div>

      {/* 2. THE 4 SHADCN INFORMATION CARDS */}
      <div className="simple-cards-grid">
        {/* CARD 1: WATER SUPPLY */}
        <div className="shadcn-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span className="simple-card-label">WATER SUPPLY</span>
            <Droplets size={16} color="hsl(var(--muted-foreground))" />
          </div>
          <div className="simple-metric-value" style={{ color: 'hsl(var(--foreground))' }}>
            {Math.round(incomingTotal).toLocaleString()} <span className="simple-metric-unit">L</span>
          </div>
          <p className="simple-metric-sub">
            Water coming in today
          </p>
        </div>

        {/* CARD 2: TANK */}
        <div className="shadcn-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span className="simple-card-label">STORAGE TANK</span>
            <Database size={16} color="hsl(var(--muted-foreground))" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
            <span className="simple-metric-value">
              {Math.round(tankPercent)}%
            </span>
            <span className={`shadcn-badge ${tankBadgeClass}`}>
              {tankStatus}
            </span>
          </div>
          <p className="simple-metric-sub">
            {Math.round(tank?.current_level_liters || 0)} L available in reservoir
          </p>
        </div>

        {/* CARD 3: WATER USED */}
        <div className="shadcn-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span className="simple-card-label">WATER USED</span>
            <TrendingDown size={16} color="hsl(var(--muted-foreground))" />
          </div>
          <div className="simple-metric-value">
            {Math.round(consumedTotal).toLocaleString()} <span className="simple-metric-unit">L</span>
          </div>
          <p className="simple-metric-sub">
            Total used across all {zones.length} zones
          </p>
        </div>

        {/* CARD 4: SYSTEM STATUS */}
        <div className={`shadcn-card ${systemBorderClass}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span className="simple-card-label">SYSTEM HEALTH</span>
            <SystemIcon size={16} color="hsl(var(--muted-foreground))" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.375rem 0' }}>
            <span className={`shadcn-badge ${systemBadgeClass}`}>
              {systemStatusBadge}
            </span>
          </div>
          <p style={{ margin: '0.25rem 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600, color: 'hsl(var(--foreground))', lineHeight: 1.3 }}>
            {mostUrgentAlert ? systemHeadline : '✓ Everything is working normally'}
          </p>
          {mostUrgentAlert && (
            <button
              onClick={onViewAlerts}
              className="shadcn-btn btn-outline"
              style={{ width: '100%', fontSize: '0.75rem', height: '1.875rem', marginTop: '0.25rem' }}
            >
              View Problem Details →
            </button>
          )}
        </div>
      </div>

      {/* 3. YOUR ZONES SECTION */}
      <div style={{ marginTop: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
          <div>
            <h2 className="accessible-heading-2" style={{ margin: 0 }}>
              Your Zones
            </h2>
            <p className="accessible-subheading" style={{ margin: '0.25rem 0 0 0' }}>
              Click any zone to view its water details or change limits.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('zones')}
            className="shadcn-btn btn-ghost"
            style={{ fontSize: '0.8125rem' }}
          >
            <span>View All Zones</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="simple-zones-grid">
          {zones.map((zone) => {
            const statusInfo = getZoneStatusInfo(zone);
            const usedL = Math.round(zone.consumed_today_l || zone.consumed_l || 0);
            const limitL = Math.round(zone.allocated_today_l || zone.allocated_l || 0);
            const pct = Math.min(100, Math.round(zone.usage_percentage || (usedL / Math.max(1, limitL)) * 100));

            return (
              <div
                key={zone.zone_id}
                className="shadcn-card clickable-card"
                onClick={() => onSelectZone(zone.zone_id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelectZone(zone.zone_id);
                }}
                aria-label={`View details for ${zone.name}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                      {zone.name}
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                      Sector {zone.zone_id}
                    </span>
                  </div>
                  <span className={`shadcn-badge ${statusInfo.badgeClass}`}>
                    {statusInfo.badge}
                  </span>
                </div>

                {/* Numbers */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <span className="simple-card-label" style={{ display: 'block', marginBottom: '0.25rem' }}>
                      Water used
                    </span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                      {usedL} <span style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>L</span>
                    </span>
                  </div>
                  <div>
                    <span className="simple-card-label" style={{ display: 'block', marginBottom: '0.25rem' }}>
                      Daily Limit
                    </span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))' }}>
                      {limitL} <span style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>L</span>
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.375rem' }}>
                    <span>{pct}% of limit used</span>
                    <span>{statusInfo.label}</span>
                  </div>
                  <div className="shadcn-progress-track">
                    <div
                      className="shadcn-progress-indicator"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: statusInfo.color
                      }}
                    />
                  </div>
                </div>

                {/* Click affordance */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.375rem', color: 'hsl(var(--primary))', fontWeight: 500, fontSize: '0.8125rem' }}>
                  <span>View Details</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
