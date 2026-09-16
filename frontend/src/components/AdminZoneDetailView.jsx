import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Droplets, TrendingDown, Clock, Shield } from 'lucide-react';
import { fetchAdminZoneDetail, updateAllocation } from '../services/api';

export default function AdminZoneDetailView({ zoneId, onBack, onAllocationUpdated }) {
  const [zoneDetail, setZoneDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newQuota, setNewQuota] = useState('');
  const [savingQuota, setSavingQuota] = useState(false);
  const [quotaMessage, setQuotaMessage] = useState(null);

  useEffect(() => {
    if (!zoneId) return;
    let isMounted = true;
    setLoading(true);

    fetchAdminZoneDetail(zoneId)
      .then((data) => {
        if (isMounted) {
          setZoneDetail(data);
          setNewQuota(data.allocated_today_l?.toString() || '');
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
  }, [zoneId]);

  if (!zoneId) return null;

  const handleSaveQuota = async (e) => {
    e.preventDefault();
    const val = parseFloat(newQuota);
    if (isNaN(val) || val <= 0) {
      alert('Please enter a valid positive number for the water limit in Liters.');
      return;
    }
    setSavingQuota(true);
    setQuotaMessage(null);
    try {
      await updateAllocation(zoneId, val);
      const updated = await fetchAdminZoneDetail(zoneId);
      setZoneDetail(updated);
      setQuotaMessage('✓ Water limit updated successfully.');
      if (onAllocationUpdated) onAllocationUpdated();
      setTimeout(() => setQuotaMessage(null), 4000);
    } catch (err) {
      alert(`Could not update water limit: ${err.message}`);
    } finally {
      setSavingQuota(false);
    }
  };

  const received = zoneDetail?.water_received_today_l || 0;
  const consumed = zoneDetail?.water_consumed_today_l || 0;
  const limit = zoneDetail?.allocated_today_l || 0;
  const remaining = zoneDetail?.remaining_today_l || 0;
  const flow = zoneDetail?.current_flow_lpm || 0;
  const valveState = zoneDetail?.valve_state || 'OPEN';

  // Determine friendly status
  let statusBadge = 'GOOD';
  let statusBadgeClass = 'badge-success';
  let statusDetail = 'Everything is working normally';

  if (valveState === 'CLOSED') {
    statusBadge = 'CHECK';
    statusBadgeClass = 'badge-warning';
    statusDetail = 'Water supply is stopped (Valve Closed)';
  } else if (remaining <= 0) {
    statusBadge = 'ACTION NEEDED';
    statusBadgeClass = 'badge-destructive';
    statusDetail = 'Daily water limit has been reached';
  } else if (remaining <= 10) {
    statusBadge = 'CHECK';
    statusBadgeClass = 'badge-warning';
    statusDetail = 'Close to reaching daily water limit';
  }

  // ONE simple comparison bar chart values
  const maxBar = Math.max(received, consumed, limit, 10);
  const receivedPct = Math.min(100, Math.round((received / maxBar) * 100));
  const consumedPct = Math.min(100, Math.round((consumed / maxBar) * 100));

  return (
    <div className="shadcn-container">
      {/* Back navigation button */}
      <button
        onClick={onBack}
        className="shadcn-btn btn-ghost"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', marginBottom: '1.25rem', padding: '0 0.5rem' }}
      >
        <ArrowLeft size={16} />
        <span>Back to All Zones</span>
      </button>

      {/* Zone Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="accessible-heading-1" style={{ margin: 0 }}>
            {zoneDetail?.name || `Zone ${zoneId}`}
          </h1>
          <p className="accessible-subheading" style={{ margin: '0.25rem 0 0 0' }}>
            {zoneDetail?.description || 'Water distribution sector'}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className={`shadcn-badge ${statusBadgeClass}`}>
            {statusBadge}
          </span>
          <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.25rem' }}>
            {statusDetail}
          </span>
        </div>
      </div>

      {loading && !zoneDetail ? (
        <div style={{ padding: '2.5rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>
          Loading zone details...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* THE CORE NUMBERS (Clear, Large, Unmistakable) */}
          <div className="simple-cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {/* 1. Water Received */}
            <div className="shadcn-card">
              <span className="simple-card-label">WATER RECEIVED</span>
              <p className="simple-metric-sub">Delivered into zone</p>
              <div className="simple-metric-value" style={{ color: 'var(--water-blue)' }}>
                {Math.round(received)} <span className="simple-metric-unit">L</span>
              </div>
            </div>

            {/* 2. Water Used */}
            <div className="shadcn-card">
              <span className="simple-card-label">WATER USED</span>
              <p className="simple-metric-sub">Consumed today</p>
              <div className="simple-metric-value">
                {Math.round(consumed)} <span className="simple-metric-unit">L</span>
              </div>
            </div>

            {/* 3. Limit */}
            <div className="shadcn-card">
              <span className="simple-card-label">DAILY LIMIT</span>
              <p className="simple-metric-sub">Allowed quota</p>
              <div className="simple-metric-value">
                {Math.round(limit)} <span className="simple-metric-unit">L</span>
              </div>
            </div>

            {/* 4. Remaining */}
            <div className="shadcn-card">
              <span className="simple-card-label">WATER LEFT</span>
              <p className="simple-metric-sub">Remaining budget</p>
              <div className="simple-metric-value" style={{ color: remaining <= 10 ? 'var(--destructive-red)' : 'var(--success-green)' }}>
                {Math.round(remaining)} <span className="simple-metric-unit">L</span>
              </div>
            </div>

            {/* 5. Current Flow */}
            <div className="shadcn-card">
              <span className="simple-card-label">CURRENT FLOW</span>
              <p className="simple-metric-sub">Flowing right now</p>
              <div className="simple-metric-value" style={{ color: 'var(--water-blue)' }}>
                {flow.toFixed(1)} <span className="simple-metric-unit">L/min</span>
              </div>
            </div>
          </div>

          {/* ONE SIMPLE COMPARISON CHART */}
          <div className="shadcn-card">
            <h2 className="accessible-heading-2" style={{ marginBottom: '0.25rem' }}>
              Water Received vs Water Used Today
            </h2>
            <p className="accessible-subheading" style={{ marginBottom: '1.25rem' }}>
              A simple visual comparison of water entering this zone and water used by residents.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Bar 1: Received */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  <span style={{ color: 'var(--water-blue)' }}>Water Received at Zone Entry</span>
                  <span style={{ color: 'hsl(var(--foreground))' }}>{Math.round(received)} Liters</span>
                </div>
                <div className="shadcn-progress-track" style={{ height: '8px' }}>
                  <div
                    className="shadcn-progress-indicator"
                    style={{ width: `${receivedPct}%`, backgroundColor: 'var(--water-blue)' }}
                  />
                </div>
              </div>

              {/* Bar 2: Consumed */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  <span style={{ color: 'hsl(var(--muted-foreground))' }}>Water Used Inside Zone</span>
                  <span style={{ color: 'hsl(var(--foreground))' }}>{Math.round(consumed)} Liters</span>
                </div>
                <div className="shadcn-progress-track" style={{ height: '8px' }}>
                  <div
                    className="shadcn-progress-indicator"
                    style={{ width: `${consumedPct}%`, backgroundColor: 'hsl(var(--primary))' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* CHANGE DAILY LIMIT (Simple Admin Setting) */}
          <div className="shadcn-card">
            <h2 className="accessible-heading-2" style={{ marginBottom: '0.25rem' }}>
              Change Daily Water Limit
            </h2>
            <p className="accessible-subheading" style={{ marginBottom: '1rem' }}>
              Set how much water this zone is allowed to use per day.
            </p>

            <form onSubmit={handleSaveQuota} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  step="1"
                  value={newQuota}
                  onChange={(e) => setNewQuota(e.target.value)}
                  className="shadcn-input"
                  style={{ width: '130px', fontWeight: 600 }}
                  aria-label="Daily water limit in liters"
                />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>Liters</span>
              </div>

              <button
                type="submit"
                disabled={savingQuota}
                className="shadcn-btn btn-default"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
              >
                <Save size={14} />
                <span>{savingQuota ? 'Saving...' : 'Save Limit'}</span>
              </button>
            </form>

            {quotaMessage && (
              <p style={{ marginTop: '0.75rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--success-green)' }}>
                {quotaMessage}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
