import React from 'react';
import { ArrowRight } from 'lucide-react';

export default function AdminZonesList({ zones = [], onSelectZone }) {
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
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 className="accessible-heading-1">
          Zone Water Status
        </h1>
        <p className="accessible-subheading">
          Quickly check which zones are using water normally and which need your attention.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
              aria-label={`Inspect ${zone.name}`}
              style={{ padding: '1.25rem 1.5rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ minWidth: '200px' }}>
                  <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                    {zone.name}
                  </h2>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                    Sector {zone.zone_id} • Valve: <strong style={{ color: 'hsl(var(--foreground))' }}>{zone.valve_state || 'OPEN'}</strong>
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem', flexWrap: 'wrap' }}>
                  <div>
                    <span className="simple-card-label" style={{ display: 'block', marginBottom: '0.2rem' }}>
                      Water Used
                    </span>
                    <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                      {usedL} <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>L</span>
                    </span>
                  </div>

                  <div>
                    <span className="simple-card-label" style={{ display: 'block', marginBottom: '0.2rem' }}>
                      Daily Limit
                    </span>
                    <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))' }}>
                      {limitL} <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>L</span>
                    </span>
                  </div>

                  <div style={{ minWidth: '120px', textAlign: 'center' }}>
                    <span className={`shadcn-badge ${statusInfo.badgeClass}`}>
                      {statusInfo.badge}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.25rem' }}>
                      {statusInfo.label}
                    </span>
                  </div>

                  <button
                    className="shadcn-btn btn-outline"
                    style={{ fontSize: '0.8125rem', height: '34px', padding: '0 12px' }}
                  >
                    <span>Inspect</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ marginTop: '1rem' }}>
                <div className="shadcn-progress-track" style={{ height: '4px' }}>
                  <div
                    className="shadcn-progress-indicator"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: statusInfo.color
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
