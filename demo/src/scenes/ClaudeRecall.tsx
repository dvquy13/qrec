import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../theme';
import {TerminalWindow} from '../components/TerminalWindow';
import {SEARCH_RESULTS} from '../data/index';

const DARK_BG = '#0f172a';

export const ClaudeRecall: React.FC = () => {
  const frame = useCurrentFrame();

  const sceneOpacity = interpolate(frame, [0, 15, 245, 270], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const subtitleOpacity = interpolate(frame, [185, 205], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const results = SEARCH_RESULTS['embedding performance'];

  const lines: Parameters<typeof TerminalWindow>[0]['lines'] = [
    {
      text: '$ qrec search --project qrec --k 5',
      color: '#e2e8f0',
      startFrame: 10,
      typewriter: true,
      typeFrames: 30,
    },
    {
      text: '',
      color: '#e2e8f0',
      startFrame: 42,
    },
    {
      text: '↳ 5 sessions found  [27ms]',
      color: '#60a5fa',
      startFrame: 43,
    },
    ...results.slice(0, 5).map((r, i) => ({
      text: `  ${r.title.slice(0, 42).padEnd(42)}  ${r.score.toFixed(3)}`,
      color: '#94a3b8',
      startFrame: 50 + i * 12,
    })),
    {
      text: '',
      color: '#e2e8f0',
      startFrame: 110,
    },
    {
      text: '$ qrec get c0ffee03',
      color: '#e2e8f0',
      startFrame: 112,
      typewriter: true,
      typeFrames: 18,
    },
    {
      text: '# Embedder singleton + dispose lifecycle',
      color: '#e2e8f0',
      startFrame: 132,
    },
    {
      text: 'project: qrec  |  date: Mar 12',
      color: '#94a3b8',
      startFrame: 134,
    },
    {
      text: '## Summary',
      color: '#60a5fa',
      startFrame: 136,
    },
    {
      text: 'Lazy singleton model load; disposeEmbedder() required before exit.',
      color: '#94a3b8',
      startFrame: 138,
    },
  ];

  return (
    <AbsoluteFill
      style={{
        background: DARK_BG,
        opacity: sceneOpacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.sans,
      }}
    >
      <TerminalWindow
        lines={lines}
        title="zsh"
        width={800}
      />

      {/* Subtitle */}
      {frame >= 185 && (
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            left: 0,
            right: 0,
            textAlign: 'center',
            opacity: subtitleOpacity,
            color: 'rgba(255,255,255,0.45)',
            fontSize: 16,
            fontFamily: theme.sans,
            letterSpacing: 0.5,
          }}
        >
          Claude recalls your recent context in milliseconds.
        </div>
      )}
    </AbsoluteFill>
  );
};
