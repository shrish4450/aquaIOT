import React from 'react';
import { Cpu, Wifi, WifiOff, Clock, ShieldCheck } from 'lucide-react';

export default function DeviceFleet({ devices }) {
  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ marginBottom: '18px' }}>
        <h3 className="font-display" style={{ fontSize: '1.2rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={20} color="var(--cyan-primary)" />
          Hardware Node Status (Virtual / Physical ESP32 Fleet)
        </h3>
        <p className="kpi-subtext">Heartbeat watchdog monitoring edge microcontrollers over MQTT</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        {devices?.map((dev) => {
          const isOnline = dev.status === 'ONLINE';
          const lastSeenTime = dev.last_seen
            ? new Date(dev.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : 'Unknown';

          return (
            <div
              key={dev.id}
              style={{
                background: 'rgba(6, 12, 22, 0.65)',
                border: `1px solid ${isOnline ? 'rgba(0, 240, 255, 0.2)' : 'rgba(239, 68, 68, 0.35)'}`,
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="font-mono" style={{ fontWeight: 700, color: '#fff' }}>
                  {dev.id.toUpperCase()}
                </span>
                <span className={`status-badge ${isOnline ? 'normal' : 'critical'}`}>
                  <span className={`pulse-dot ${isOnline ? 'online' : 'offline'}`} />
                  {dev.status}
                </span>
              </div>

              <div style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 500 }}>
                {dev.name}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.76rem', color: '#94a3b8', background: 'rgba(0, 0, 0, 0.3)', padding: '8px', borderRadius: '4px' }}>
                <div>
                  IP: <span className="font-mono" style={{ color: '#e2e8f0' }}>{dev.ip_address || '192.168.1.10X'}</span>
                </div>
                <div>
                  FW: <span className="font-mono" style={{ color: '#e2e8f0' }}>{dev.firmware_version || 'v1.2.0'}</span>
                </div>
                <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} /> Last Ping: <span className="font-mono" style={{ color: '#e2e8f0' }}>{lastSeenTime}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
