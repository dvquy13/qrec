import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../theme';
import {SceneFade} from '../components/SceneFade';
import {SlideUp} from '../components/SlideUp';
import {TerminalWindow} from '../components/TerminalWindow';
import {SessionCard} from '../../../ui-react/src/components/SessionCard';

export const ClaudeRecall: React.FC = () => {
  const frame = useCurrentFrame();

  const query = 'race condition indexer';
  const typedChars = Math.floor(
    interpolate(frame, [10, 35], [0, query.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );

  return (
    <SceneFade durationInFrames={510} fadeIn={20} fadeOut={30}>
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          padding: '0 50px',
          gap: 40,
        }}
      >
        {/* Left: Web UI Search (browser chrome frame) */}
        <div
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${theme.border}`,
            borderRadius: 12,
            padding: 20,
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
          }}
        >
          {/* App label */}
          <div
            style={{
              color: theme.textMuted,
              fontSize: 12,
              fontFamily: theme.mono,
              letterSpacing: 1,
              textTransform: 'uppercase',
              marginBottom: 12,
              opacity: interpolate(frame, [5, 18], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            qrec search
          </div>

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
              marginBottom: 16,
              opacity: interpolate(frame, [0, 12], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            <span style={{color: theme.textMuted, fontSize: 16}}>⌕</span>
            <span style={{color: theme.text, fontSize: 15, fontFamily: theme.mono}}>
              {query.slice(0, typedChars)}
              {frame < 36 && (
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
            {frame >= 36 && (
              <span
                style={{
                  marginLeft: 'auto',
                  color: theme.blue,
                  fontSize: 13,
                  fontFamily: theme.mono,
                }}
              >
                3 results [52ms]
              </span>
            )}
          </div>

          <SlideUp start={45}>
            <SessionCard
              id="session-race"
              title="Fixed race condition in mtime pre-filter"
              project="qrec"
              date="Mar 10"
              summary="Discovered mtime check used indexed_at instead of file mtime — concurrent writes caused missed updates."
              tags={['bug', 'indexer', 'concurrency']}
              score={0.842}
              showScore
              showSummary
              showTags
            />
          </SlideUp>
          <SlideUp start={63}>
            <SessionCard
              id="session-mtime"
              title="Indexer mtime filter + cron scan optimization"
              project="qrec"
              date="Mar 11"
              summary="Added mtime pre-filter to skip unchanged JSONL files; cron scan drops from O(n) reads to stat-only."
              tags={['performance', 'indexer']}
              score={0.761}
              showScore
              showSummary
              showTags
            />
          </SlideUp>
        </div>

        {/* Right: Terminal (Claude querying qrec) */}
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
          <TerminalWindow
            title="Claude Code"
            lines={[
              {
                text: '$ qrec search "race condition indexer" --k 3',
                color: '#e2e8f0',
                startFrame: 10,
                typewriter: true,
                typeFrames: 25,
              },
              {
                text: '',
                color: '#e2e8f0',
                startFrame: 37,
              },
              {
                text: '↳ 3 sessions found  [52ms]',
                color: '#60a5fa',
                startFrame: 38,
              },
              {
                text: 'Fixed race condition in mtime pre-filter   0.842',
                color: '#94a3b8',
                startFrame: 45,
                indent: 1,
              },
              {
                text: 'Indexer mtime filter + cron scan           0.761',
                color: '#94a3b8',
                startFrame: 63,
                indent: 1,
              },
              {
                text: 'Archive JSONL on index for durability      0.614',
                color: '#94a3b8',
                startFrame: 75,
                indent: 1,
              },
            ]}
          />
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};
