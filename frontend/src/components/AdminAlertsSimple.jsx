import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, ShieldCheck } from 'lucide-react';

export default function AdminAlertsSimple({ alerts = [], onAcknowledge, onResolve }) {
  const activeAlerts = alerts.filter((a) => !a.is_resolved);
  const resolvedAlerts = alerts.filter((a) => a.is_resolved).slice(0, 5);

  const priorityOrder = { CRITICAL: 1, WARNING: 2, INFO: 3 };
  const sortedActive = [...activeAlerts].sort((a, b) => {
    const pA = priorityOrder[a.severity] || 4;
    const pB = priorityOrder[b.severity] || 4;
    return pA - pB;
  });

  const getAlertBadge = (severity) => {
    if (severity === 'CRITICAL') {
      return {
        text: 'ACTION NEEDED',
        badgeClass: 'badge-destructive',
        borderClass: 'status-action-border',
        icon: AlertCircle,
        iconColor: 'var(--destructive-red)'
      };
    }
    if (severity === 'WARNING') {
      return {
        text: 'CHECK',
        badgeClass: 'badge-warning',
        borderClass: 'status-check-border',
        icon: AlertTriangle,
        iconColor: 'var(--warning-amber)'
      };
    }
    return {
      text: 'INFO',
      badgeClass: 'badge-info',
      borderClass: '',
      icon: CheckCircle2,
      iconColor: 'var(--water-blue)'
    };
  };

  return (
    <div className="shadcn-container">
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 className="accessible-heading-1">
          System Alerts & Issues
        </h1>
        <p className="accessible-subheading">
          Review issues detected by the system and mark them when checked or resolved.
        </p>
      </div>

      {sortedActive.length === 0 ? (
        <div
          className="shadcn-card"
          style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            borderColor: 'rgba(34, 197, 94, 0.3)'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '9999px',
              background: 'var(--success-green-muted)',
              color: 'var(--success-green)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}
          >
            <ShieldCheck size={24} />
          </div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'hsl(var(--foreground))', margin: '0 0 0.375rem 0' }}>
            ✓ No Problems Found
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
            Everything is operating normally. All water lines and tank levels are within safe limits.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sortedActive.map((a) => {
            const badge = getAlertBadge(a.severity);
            const Icon = badge.icon;

            return (
              <div
                key={a.id}
                className={`shadcn-card ${badge.borderClass}`}
                style={{
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}
              >
                <div style={{ flex: 1, minWidth: '260px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                    <Icon size={15} color={badge.iconColor} />
                    <span className={`shadcn-badge ${badge.badgeClass}`}>
                      {badge.text}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                      {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {a.zone_id ? `Zone ${a.zone_id}` : 'Central Facility'}
                    </span>
                  </div>

                  <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9375rem', fontWeight: 600, color: 'hsl(var(--foreground))', lineHeight: 1.4 }}>
                    {a.message}
                  </h3>

                  {a.is_acknowledged && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--water-blue)', fontWeight: 500 }}>
                      ✓ Marked as checked
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {!a.is_acknowledged && (
                    <button
                      onClick={() => onAcknowledge(a.id)}
                      className="shadcn-btn btn-secondary"
                      style={{ height: '34px', fontSize: '0.8125rem' }}
                    >
                      I Checked This
                    </button>
                  )}
                  <button
                    onClick={() => onResolve(a.id)}
                    className="shadcn-btn btn-default"
                    style={{ height: '34px', fontSize: '0.8125rem' }}
                  >
                    Problem Fixed
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resolved past history */}
      {resolvedAlerts.length > 0 && (
        <div style={{ marginTop: '2.5rem' }}>
          <h2 className="accessible-heading-2" style={{ fontSize: '0.9375rem', marginBottom: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
            Recently Fixed Issues
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {resolvedAlerts.map((ra) => (
              <div
                key={ra.id}
                className="shadcn-card"
                style={{
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'hsl(var(--muted))'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={15} color="var(--success-green)" />
                  <span style={{ fontSize: '0.8125rem', color: 'hsl(var(--foreground))' }}>
                    {ra.message}
                  </span>
                </div>
                <span style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))' }}>
                  Fixed {new Date(ra.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
