import React, { useState } from 'react';
import { Power, ShieldAlert, CheckCircle2, Sliders } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

export default function AdminControl({
  pumpState = 'ON',
  zones = [],
  onTogglePump,
  onToggleValve
}) {
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    actionType: null, // 'PUMP' | 'VALVE'
    targetId: null,
    targetState: null,
    isDanger: true
  });

  const [operating, setOperating] = useState(false);

  // Request action with confirmation
  const requestPumpToggle = () => {
    if (pumpState === 'ON') {
      setConfirmModal({
        isOpen: true,
        title: 'Turn Off Main Pump?',
        message: 'The main pump will stop pumping water into the central tank. Are you sure you want to stop it?',
        confirmText: 'Turn Off Pump',
        actionType: 'PUMP',
        targetState: 'OFF',
        isDanger: true
      });
    } else {
      setConfirmModal({
        isOpen: true,
        title: 'Start Main Pump?',
        message: 'The pump will start running and filling the reservoir tank with incoming water.',
        confirmText: 'Start Pump',
        actionType: 'PUMP',
        targetState: 'ON',
        isDanger: false
      });
    }
  };

  const requestValveToggle = (zone) => {
    const isCurrentlyOpen = zone.valve_state === 'OPEN';
    if (isCurrentlyOpen) {
      setConfirmModal({
        isOpen: true,
        title: `Close ${zone.name} Valve?`,
        message: `Water will stop flowing to residents in ${zone.name}. Use this in case of a leak, maintenance, or limit enforcement.`,
        confirmText: 'Close Valve',
        actionType: 'VALVE',
        targetId: zone.zone_id,
        targetState: 'CLOSED',
        isDanger: true
      });
    } else {
      setConfirmModal({
        isOpen: true,
        title: `Open ${zone.name} Valve?`,
        message: `Water supply will resume flowing to ${zone.name}.`,
        confirmText: 'Open Valve',
        actionType: 'VALVE',
        targetId: zone.zone_id,
        targetState: 'OPEN',
        isDanger: false
      });
    }
  };

  const handleConfirmAction = async () => {
    const { actionType, targetId, targetState } = confirmModal;
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    setOperating(true);

    try {
      if (actionType === 'PUMP') {
        await onTogglePump(targetState);
      } else if (actionType === 'VALVE') {
        await onToggleValve(targetId, targetState);
      }
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setOperating(false);
    }
  };

  const isPumpRunning = pumpState === 'ON';

  return (
    <div className="shadcn-container">
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 className="accessible-heading-1">
          Water System Control
        </h1>
        <p className="accessible-subheading">
          Turn the main water pump on or off, and open or close zone water valves when needed.
        </p>
      </div>

      {/* Confirmation Modal */}
      <ConfirmDialog
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        isDanger={confirmModal.isDanger}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* 1. MAIN WATER PUMP CONTROL */}
        <div className="shadcn-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <span className="simple-card-label">CENTRAL SYSTEM</span>
            <span className={`shadcn-badge ${isPumpRunning ? 'badge-success' : 'badge-destructive'}`}>
              {isPumpRunning ? 'RUNNING' : 'STOPPED'}
            </span>
          </div>
          <h2 className="accessible-heading-2" style={{ margin: '0.25rem 0 0.5rem 0' }}>
            Main Water Pump
          </h2>
          <p className="accessible-subheading" style={{ marginBottom: '1.25rem' }}>
            The main pump fills your central storage tank with incoming municipal water.
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem 1.25rem',
              borderRadius: '0.5rem',
              background: 'hsl(var(--muted))',
              border: '1px solid hsl(var(--border))',
              flexWrap: 'wrap',
              gap: '1rem'
            }}
          >
            <div>
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>
                Pump Status
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: isPumpRunning ? 'var(--success-green)' : 'var(--destructive-red)'
                  }}
                />
                <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                  {isPumpRunning ? 'Running' : 'Stopped'}
                </span>
              </div>
            </div>

            <button
              onClick={requestPumpToggle}
              disabled={operating}
              className={`shadcn-btn ${isPumpRunning ? 'btn-destructive' : 'btn-default'}`}
              style={{ minWidth: '150px' }}
            >
              <Power size={14} />
              <span>{operating ? 'Updating...' : (isPumpRunning ? 'Turn Off Pump' : 'Start Pump')}</span>
            </button>
          </div>
        </div>

        {/* 2. ZONE VALVE CONTROLS */}
        <div className="shadcn-card">
          <div style={{ marginBottom: '0.25rem' }}>
            <span className="simple-card-label">DISTRIBUTION NETWORK</span>
          </div>
          <h2 className="accessible-heading-2" style={{ margin: '0.25rem 0 0.5rem 0' }}>
            Zone Water Valves
          </h2>
          <p className="accessible-subheading" style={{ marginBottom: '1.25rem' }}>
            Open or close the water supply to each individual sector. Closing a valve immediately stops water flow to that zone.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {zones.map((zone) => {
              const isOpen = zone.valve_state === 'OPEN';

              return (
                <div
                  key={zone.zone_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.875rem 1.25rem',
                    borderRadius: '0.5rem',
                    background: 'hsl(var(--muted))',
                    border: '1px solid hsl(var(--border))',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                      {zone.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.25rem' }}>
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: isOpen ? 'var(--success-green)' : 'var(--destructive-red)'
                        }}
                      />
                      <span style={{ fontSize: '0.75rem', fontWeight: 500, color: isOpen ? 'var(--success-green)' : '#f87171' }}>
                        {isOpen ? 'Water Flowing (Open)' : 'Water Stopped (Closed)'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => requestValveToggle(zone)}
                    disabled={operating}
                    className={`shadcn-btn ${isOpen ? 'btn-destructive' : 'btn-default'}`}
                    style={{ minWidth: '130px' }}
                  >
                    <span>{operating ? 'Updating...' : (isOpen ? 'Close Valve' : 'Open Valve')}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
