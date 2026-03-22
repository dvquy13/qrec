import React from 'react';

export const MouseCursor: React.FC<{x: number; y: number; scale: number; opacity: number}> = ({
  x, y, scale, opacity,
}) => (
  <div style={{
    position: 'absolute', left: x, top: y, pointerEvents: 'none',
    transform: `scale(${scale})`, transformOrigin: '0 0',
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))', opacity,
  }}>
    <svg width="22" height="28" viewBox="0 0 22 28" fill="none">
      <path d="M2 2L20 13L12 14.5L8 26L2 2Z" fill="white" stroke="#1a1a1a"
        strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  </div>
);
