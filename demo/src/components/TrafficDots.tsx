import React from 'react';

export const TrafficDots: React.FC<{dark?: boolean}> = ({dark}) => (
  <div style={{display: 'flex', gap: 6, alignItems: 'center', width: 56}}>
    {[1, 0.55, 0.28].map((alpha, i) => (
      <div
        key={i}
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: dark
            ? `rgba(255,255,255,${alpha})`
            : `rgba(0,98,168,${alpha})`,
        }}
      />
    ))}
  </div>
);
