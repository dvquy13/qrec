import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../theme';
import {BrowserFrame} from '../components/BrowserFrame';
import {TerminalWindow} from '../components/TerminalWindow';
import {SlideUp} from '../components/SlideUp';
import {SessionCard} from '../../../ui-react/src/components/SessionCard';
import {SEARCH_RESULTS} from '../data/index';

const DARK_BG = '#0f172a';
const QUERY = 'embedding performance';

export const SideBySideSearch: React.FC = () => {
  const frame = useCurrentFrame();

  const sceneOpacity = interpolate(frame, [0, 15, 275, 300], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Typewriter for search bar (frames 10-40)
  const typedChars = Math.floor(
    interpolate(frame, [10, 40], [0, QUERY.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );

  const results = SEARCH_RESULTS['embedding performance'];

  const subtitleOpacity = interpolate(frame, [220, 240], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const terminalLines: Parameters<typeof TerminalWindow>[0]['lines'] = [
    {
      text: '$ qrec search "embedding performance" --k 4',
      color: '#e2e8f0',
      startFrame: 10,
      typewriter: true,
      typeFrames: 30,
    },
    {
      text: '↳ 4 sessions found  [31ms]',
      color: '#60a5fa',
      startFrame: 44,
    },
    ...results.slice(0, 4).map((r, i) => ({
      text: `  ${r.title.slice(0, 36).padEnd(36)}  ${r.score.toFixed(3)}`,
      color: '#94a3b8',
      startFrame: 45 + i * 15,
    })),
  ];

  return (
    <AbsoluteFill
      style={{
        background: DARK_BG,
        opacity: sceneOpacity,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        padding: '50px',
        gap: 40,
        fontFamily: theme.sans,
      }}
    >
      {/* Left: BrowserFrame with search UI */}
      <div style={{flex: 1, height: 440}}>
        <BrowserFrame
          url="localhost:25927/search"
          style={{height: '100%'}}
        >
          <div style={{padding: 20, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'hidden'}}>
            {/* Search bar */}
            <div
              style={{
                background: theme.bg2,
                border: `1px solid ${theme.blue}`,
                borderRadius: 8,
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{color: theme.textMuted, fontSize: 16}}>⌕</span>
              <span style={{color: theme.text, fontSize: 15, fontFamily: theme.mono}}>
                {QUERY.slice(0, typedChars)}
                {frame < 41 && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 2,
                      height: 13,
                      background: theme.blue,
                      marginLeft: 1,
                      verticalAlign: 'middle',
                    }}
                  />
                )}
              </span>
              {frame >= 41 && (
                <span
                  style={{
                    marginLeft: 'auto',
                    color: theme.blue,
                    fontSize: 13,
                    fontFamily: theme.mono,
                  }}
                >
                  4 results [31ms]
                </span>
              )}
            </div>

            {/* Result cards */}
            <div style={{display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflow: 'hidden'}}>
              {results.slice(0, 3).map((r, i) => (
                <SlideUp key={r.id} start={45 + i * 15}>
                  <SessionCard
                    id={r.id}
                    title={r.title}
                    project={r.project}
                    date={r.date}
                    summary={r.summary}
                    tags={r.tags}
                    score={r.score}
                    showScore
                    showSummary
                    showTags
                  />
                </SlideUp>
              ))}
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
      {frame >= 220 && (
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
          Search from the UI or straight from the terminal.
        </div>
      )}
    </AbsoluteFill>
  );
};
