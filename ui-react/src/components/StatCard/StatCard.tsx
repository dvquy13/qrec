import React from 'react';

export interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  pulsing?: boolean;
  style?: React.CSSProperties;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, sub, pulsing, style }) => {
  return (
    <div className="stat-card" style={style}>
      <div style={{ fontSize: 32, fontWeight: 400, letterSpacing: '-0.04em', color: 'var(--text)' }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
        {label}
        {pulsing && (
          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginLeft: 6, verticalAlign: 'middle', animation: 'pulse 1.5s ease-in-out infinite' }} />
        )}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
};
