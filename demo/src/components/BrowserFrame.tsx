import React from 'react';
import {theme} from '../theme';

interface BrowserFrameProps {
  children: React.ReactNode;
  url?: string;
  style?: React.CSSProperties;
}

export const BrowserFrame: React.FC<BrowserFrameProps> = ({
  children,
  url = 'localhost:25927',
  style,
}) => {
  return (
    <div
      style={{
        background: '#1e1e2e',
        borderRadius: 10,
        border: `1px solid ${theme.border}`,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        ...style,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          background: '#2a2a3e',
          height: 36,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}
      >
        {/* Traffic lights */}
        <div style={{display: 'flex', gap: 6, alignItems: 'center', width: 60}}>
          {(['#ff5f57', '#febc2e', '#28c840'] as const).map((color) => (
            <div
              key={color}
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: color,
              }}
            />
          ))}
        </div>

        {/* Address bar */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 4,
              padding: '3px 12px',
              fontFamily: theme.mono,
              fontSize: 12,
              color: 'rgba(255,255,255,0.6)',
              minWidth: 160,
              maxWidth: 320,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {url}
          </div>
        </div>

        {/* Right spacer — mirrors traffic lights for symmetry */}
        <div style={{width: 60, opacity: 0}} />
      </div>

      {/* Content area */}
      <div
        style={{
          flex: 1,
          background: '#ffffff',
          overflow: 'hidden',
          // Light theme CSS variable overrides for qrec UI components
          // @ts-ignore — custom CSS properties
          '--bg': '#ffffff',
          '--bg2': theme.bg2,
          '--bg3': theme.bg3,
          '--border': theme.border,
          '--text': theme.text,
          '--text-muted': theme.textMuted,
          '--text-dim': theme.textDim,
          '--blue': theme.blue,
          '--blue-light': theme.blueLight,
          '--blue-border': theme.blueBorder,
          '--blue-dim': theme.blueDim,
          '--green': theme.green,
          '--red': theme.red,
        }}
      >
        {children}
      </div>
    </div>
  );
};
