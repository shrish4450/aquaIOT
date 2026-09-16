import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, ShieldAlert, Clock, Check } from 'lucide-react';

export default function AlertCenter({ alerts, onAcknowledge, onResolve }) {
  const [filterActive, setFilterActive] = useState(true);

  const displayedAlerts = alerts?.filter((a) => (filterActive ? a.is_active : true)) || [];

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 className="font-display" style={{ fontSize: '1.2rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} color="var(--cyan-primary)" />
            Incident Response & Alert Center
          </h3>
          <p className="kpi-subtext">Real-time safety watchdog audit log with operator acknowledgement</p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`scenario-btn ${filterActive ? 'active' : ''}`}
            onClick={() => setFilterActive(true)}
          >
            Active Incidents ({alerts?.filter((a) => a.is_active).length || 0})
          </button>
          <button
            className={`scenario-btn ${!filterActive ? 'active' : ''}`}
            onClick={() => setFilterActive(false)}
          >
            All Historical Alerts
          </button>
        </div>
      </div>

      <div className="alert-table-wrapper">
        {displayedAlerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 12px', color: '#64748b' }}>
            <CheckCircle size={32} color="#10b981" style={{ marginBottom: '8px' }} />
            <p>No active incidents detected. All physical parameters within nominal thresholds.</p>
          </div>
        ) : (
          <table className="alert-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Type</th>
                <th>Description</th>
                <th>Target</th>
                <th>Timestamp</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedAlerts.map((alert) => {
                const isCrit = alert.severity === 'CRITICAL';
                const isWarn = alert.severity === 'WARNING';
                const timeStr = new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                return (
                  <tr key={alert.id}>
                    <td>
                      <span className={`status-badge ${isCrit ? 'critical' : isWarn ? 'warning' : 'info'}`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono" style={{ fontWeight: 600, fontSize: '0.82rem', color: '#e2e8f0' }}>
                        {alert.alert_type}
                      </span>
                    </td>
                    <td style={{ color: '#cbd5e1', maxWidth: '340px' }}>{alert.message}</td>
                    <td className="font-mono" style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                      {alert.zone_id ? `Zone #${alert.zone_id}` : alert.device_id || 'System-wide'}
                    </td>
                    <td className="font-mono" style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      {timeStr}
                    </td>
                    <td>
                      <span className={`status-badge ${alert.is_active ? (isCrit ? 'critical' : 'warning') : 'normal'}`} style={{ fontSize: '0.7rem' }}>
                        {alert.is_active ? 'ACTIVE' : 'RESOLVED'}
                      </span>
                    </td>
                    <td>
                      {alert.is_active && (
                        <div style={{ display: 'flex' }}>
                          {!alert.acknowledged_at && (
                            <button className="btn-ack" onClick={() => onAcknowledge(alert.id)}>
                              ACK
                            </button>
                          )}
                          <button className="btn-resolve" onClick={() => onResolve(alert.id)}>
                            Resolve
                          </button>
                        </div>
                      )}
                      {!alert.is_active && (
                        <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Check size={12} /> Closed
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
