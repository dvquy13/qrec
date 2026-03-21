import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../theme';

interface TerminalLine {
  text: string;
  color?: string;
  indent?: number;
  startFrame: number;
  /** If true, types character by character over `typeFrames` frames */
  typewriter?: boolean;
  typeFrames?: number;
}

export const TerminalWindow: React.FC<{
  lines: TerminalLine[];
  title?: string;
  width?: number;
}> = ({lines, title = 'zsh', width = 560}) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        width,
        background: '#1e1e2e',
        borderRadius: 10,
        border: `1px solid ${theme.border}`,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        fontFamily: theme.mono,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          background: '#2a2a3e',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{display: 'flex', gap: 6}}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <div
              key={c}
              style={{width: 12, height: 12, borderRadius: '50%', background: c}}
            />
          ))}
        </div>
        <span
          style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: 12,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {title}
        </span>
      </div>

      {/* Content */}
      <div style={{padding: '16px 20px', minHeight: 120}}>
        {lines.map((line, i) => {
          if (frame < line.startFrame) return null;

          let displayText = line.text;
          if (line.typewriter) {
            const elapsed = frame - line.startFrame;
            const total = line.typeFrames ?? line.text.length * 1.5;
            const chars = Math.floor(
              interpolate(elapsed, [0, total], [0, line.text.length], {
                extrapolateRight: 'clamp',
              }),
            );
            displayText = line.text.slice(0, chars);
          }

          return (
            <div
              key={i}
              style={{
                color: line.color ?? theme.text,
                fontSize: 13,
                lineHeight: 1.7,
                paddingLeft: (line.indent ?? 0) * 16,
                fontFamily: theme.mono,
              }}
            >
              {displayText}
            </div>
          );
        })}
      </div>
    </div>
  );
};
