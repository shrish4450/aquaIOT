import React from 'react';
import { BarChart2, TrendingUp, Droplet } from 'lucide-react';

export default function Charts({ consumptionData }) {
  const hourly = consumptionData?.hourly_data || [];
  const tankTrend = consumptionData?.tank_trend || [];
  const zoneBreakdown = consumptionData?.zone_breakdown || [];

  // Geometry for Hourly Flow Comparison Chart
  const svgW = 600;
  const svgH = 200;
  const padL = 40;
  const padB = 30;
  const padT = 15;
  const padR = 20;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;

  const maxFlow = Math.max(
    6.0,
    ...hourly.map((d) => Math.max(d.main_flow || 0, d.sum_zones || 0))
  );

  const getX = (idx) => padL + (idx / Math.max(1, hourly.length - 1)) * chartW;
  const getY = (val) => padT + chartH - (val / maxFlow) * chartH;

  const mainPathD = hourly.length > 0
    ? hourly.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.main_flow)}`).join(' ')
    : '';

  const zonePathD = hourly.length > 0
    ? hourly.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.sum_zones)}`).join(' ')
    : '';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
      {/* 1. Main vs Zone Sum Flow Comparison Chart */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h4 className="font-display" style={{ fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} color="var(--cyan-primary)" />
              Main vs Zone Flow Comparison (24h)
            </h4>
            <span className="kpi-subtext">Discrepancies indicate active leakage</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--cyan-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '3px', background: 'var(--cyan-primary)', display: 'inline-block' }} /> Main
            </span>
            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '3px', background: '#10b981', display: 'inline-block' }} /> Sum Zones
            </span>
          </div>
        </div>

        <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" height={svgH} style={{ overflow: 'visible' }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((frac, i) => {
            const y = padT + chartH * (1 - frac);
            const val = (frac * maxFlow).toFixed(1);
            return (
              <g key={i}>
                <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="rgba(255, 255, 255, 0.06)" strokeDasharray="3 3" />
                <text x={padL - 8} y={y + 3} textAnchor="end" fill="#64748b" fontSize="9" fontFamily="var(--font-mono)">
                  {val}
                </text>
              </g>
            );
          })}

          {/* Lines */}
          {mainPathD && <path d={mainPathD} fill="none" stroke="var(--cyan-primary)" strokeWidth="2.5" />}
          {zonePathD && <path d={zonePathD} fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="5 3" />}

          {/* Time ticks */}
          {hourly.filter((_, idx) => idx % 4 === 0).map((d, i) => {
            const originalIndex = i * 4;
            return (
              <text key={i} x={getX(originalIndex)} y={svgH - 8} textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="var(--font-mono)">
                {d.time}
              </text>
            );
          })}
        </svg>
      </div>

      {/* 2. Tank Storage Level Trend (24h) */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h4 className="font-display" style={{ fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Droplet size={18} color="#38bdf8" />
              Storage Reservoir Level Trend
            </h4>
            <span className="kpi-subtext">Level percentage relative to safety bounds</span>
          </div>
          <span className="status-badge info">100L TANK</span>
        </div>

        <div style={{ height: '170px', display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '10px 0 20px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          {tankTrend.map((pt, idx) => {
            const heightPct = Math.min(100, Math.max(4, pt.pct));
            const isHigh = pt.pct >= 90;
            const isLow = pt.pct <= 20;
            return (
              <div
                key={idx}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}
                title={`${pt.time}: ${pt.level}L (${pt.pct}%)`}
              >
                <div
                  style={{
                    width: '100%',
                    height: `${heightPct}%`,
                    background: isHigh
                      ? 'linear-gradient(to top, #ef4444, #f87171)'
                      : isLow
                      ? 'linear-gradient(to top, #f59e0b, #fbbf24)'
                      : 'linear-gradient(to top, #0284c7, #00f0ff)',
                    borderRadius: '3px 3px 0 0',
                    transition: 'height 0.3s ease',
                  }}
                />
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#64748b' }}>
          <span>24 Hours Ago</span>
          <span>Present</span>
        </div>
      </div>
    </div>
  );
}
