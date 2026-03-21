import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../theme';
import {SceneFade} from '../components/SceneFade';
import {SlideUp} from '../components/SlideUp';

export const CTA: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <SceneFade durationInFrames={150} fadeIn={20} fadeOut={15}>
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
        }}
      >
        <SlideUp start={0}>
          <div
            style={{
              fontFamily: theme.mono,
              fontSize: 16,
              color: theme.blue,
              letterSpacing: 3,
              textTransform: 'uppercase',
              textAlign: 'center',
            }}
          >
            qrec
          </div>
        </SlideUp>

        <SlideUp start={8}>
          <h1
            style={{
              color: theme.text,
              fontSize: 48,
              fontWeight: 700,
              margin: 0,
              textAlign: 'center',
              letterSpacing: -1.5,
              lineHeight: 1.15,
            }}
          >
            Session recall
            <br />
            for Claude Code.
          </h1>
        </SlideUp>

        {/* Install command */}
        <div
          style={{
            opacity: interpolate(frame, [25, 45], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            background: theme.bg3,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: '12px 28px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{color: theme.textMuted, fontFamily: theme.mono, fontSize: 15}}>
            $
          </span>
          <span
            style={{
              color: theme.text,
              fontFamily: theme.mono,
              fontSize: 18,
              fontWeight: 500,
            }}
          >
            npm install -g @dvquys/qrec
          </span>
        </div>

        {/* GitHub link */}
        <div
          style={{
            opacity: interpolate(frame, [45, 65], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            color: theme.textMuted,
            fontSize: 15,
            fontFamily: theme.mono,
          }}
        >
          github.com/dvquys/qrec
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};
