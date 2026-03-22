import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../theme';
import {BrowserFrame} from '../components/BrowserFrame';
import {TerminalWindow} from '../components/TerminalWindow';
import {SESSIONS} from '../data/index';

const DARK_BG = '#0f172a';

export const SessionDetail: React.FC = () => {
  const frame = useCurrentFrame();

  const sceneOpacity = interpolate(frame, [0, 15, 245, 270], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const session = SESSIONS.find((s) => s.id === 'a1b2c3d4')!;

  const subtitleOpacity = interpolate(frame, [190, 210], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const terminalLines: Parameters<typeof TerminalWindow>[0]['lines'] = [
    {
      text: '$ qrec get a1b2c3d4',
      color: '#e2e8f0',
      startFrame: 10,
      typewriter: true,
      typeFrames: 22,
    },
    {
      text: '# Memory leak in long-running Node.js service',
      color: '#e2e8f0',
      startFrame: 32,
    },
    {
      text: 'project: api  |  date: Feb 20',
      color: '#94a3b8',
      startFrame: 34,
    },
    {
      text: 'tags: debugging, memory, nodejs, performance',
      color: '#94a3b8',
      startFrame: 36,
    },
    {
      text: '',
      color: '#94a3b8',
      startFrame: 40,
    },
    {
      text: '## Summary',
      color: '#60a5fa',
      startFrame: 42,
    },
    {
      text: 'Identified a memory leak caused by unbounded event',
      color: '#94a3b8',
      startFrame: 44,
    },
    {
      text: 'listener accumulation on the request pool.',
      color: '#94a3b8',
      startFrame: 46,
    },
    {
      text: '',
      color: '#94a3b8',
      startFrame: 53,
    },
    {
      text: '## Learnings',
      color: '#60a5fa',
      startFrame: 55,
    },
    {
      text: '• Heap snapshots reveal retained closures',
      color: '#94a3b8',
      startFrame: 57,
    },
    {
      text: '• EventEmitter listeners must be explicitly removed',
      color: '#94a3b8',
      startFrame: 59,
    },
  ];

  return (
    <AbsoluteFill
      style={{
        background: DARK_BG,
        opacity: sceneOpacity,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        padding: '40px 50px',
        gap: 40,
        fontFamily: theme.sans,
      }}
    >
      {/* Left: BrowserFrame session detail */}
      <div style={{flex: 1, height: 460}}>
        <BrowserFrame
          url="localhost:25927/session/a1b2c3d4"
          style={{height: '100%'}}
        >
          <div
            style={{
              padding: 20,
              height: '100%',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* Title */}
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: theme.text,
                lineHeight: 1.3,
                letterSpacing: -0.3,
              }}
            >
              {session.title}
            </div>

            {/* Meta row */}
            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center'}}>
              <span
                style={{
                  background: theme.blueDim,
                  color: theme.blue,
                  border: `1px solid ${theme.blueBorder}`,
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontSize: 12,
                  fontFamily: theme.mono,
                }}
              >
                {session.project}
              </span>
              <span
                style={{
                  background: theme.bg3,
                  color: theme.textMuted,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontSize: 12,
                }}
              >
                {session.date}
              </span>
              {session.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    background: theme.bg3,
                    color: theme.textMuted,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: 11,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Summary */}
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: theme.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                  marginBottom: 6,
                }}
              >
                Summary
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: theme.text,
                  lineHeight: 1.6,
                }}
              >
                {session.summary.slice(0, 160)}…
              </div>
            </div>

            {/* Learnings */}
            {session.learnings && session.learnings.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: theme.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    marginBottom: 6,
                  }}
                >
                  Learnings
                </div>
                <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                  {session.learnings.slice(0, 2).map((l, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 12,
                        color: theme.text,
                        lineHeight: 1.5,
                        paddingLeft: 12,
                        borderLeft: `2px solid ${theme.border}`,
                      }}
                    >
                      {l.slice(0, 72)}…
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Thinking block */}
            <div
              style={{
                background: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                borderRadius: 6,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{color: '#a78bfa', fontSize: 13}}>◈</span>
              <span style={{color: '#a78bfa', fontSize: 12, fontFamily: theme.mono}}>
                Reasoning
              </span>
              <span style={{color: 'rgba(167, 139, 250, 0.6)', fontSize: 11, marginLeft: 4}}>
                [click to expand]
              </span>
            </div>

            {/* Tool call block */}
            <div
              style={{
                background: 'rgba(5, 150, 105, 0.06)',
                border: '1px solid rgba(5, 150, 105, 0.2)',
                borderRadius: 6,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{color: theme.green, fontSize: 12}}>▶</span>
              <span style={{color: theme.green, fontSize: 12, fontFamily: theme.mono}}>
                Read
              </span>
              <span style={{color: theme.textMuted, fontSize: 12, fontFamily: theme.mono}}>
                api-gateway.ts
              </span>
            </div>
          </div>
        </BrowserFrame>
      </div>

      {/* Right: Terminal */}
      <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <TerminalWindow
          lines={terminalLines}
          title="zsh"
          width={540}
        />
      </div>

      {/* Subtitle */}
      {frame >= 190 && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
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
          Dive into any session — full detail, side by side.
        </div>
      )}
    </AbsoluteFill>
  );
};
