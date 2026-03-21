import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../theme';
import {SceneFade} from '../components/SceneFade';
import {SlideUp} from '../components/SlideUp';
import {TerminalWindow} from '../components/TerminalWindow';
import {SessionCard} from '../../../ui-react/src/components/SessionCard';

export const ClaudeRecall: React.FC = () => {
  const frame = useCurrentFrame();

  // Label fades in at 0, terminal at 20, results at 100+
  const resultsOpacity = interpolate(frame, [95, 115], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <SceneFade durationInFrames={510} fadeIn={20} fadeOut={30}>
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          padding: '0 60px',
          gap: 48,
        }}
      >
        {/* Left: label + chat bubble + terminal */}
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 20}}>
          <SlideUp start={0}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: theme.blueDim,
                border: `1px solid ${theme.blueBorder}`,
                borderRadius: 6,
                padding: '5px 12px',
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: theme.blue,
                }}
              />
              <span
                style={{
                  color: theme.blue,
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  fontFamily: theme.mono,
                }}
              >
                For Claude
              </span>
            </div>
          </SlideUp>

          <SlideUp start={5}>
            <h2
              style={{
                color: theme.text,
                fontSize: 36,
                fontWeight: 700,
                margin: 0,
                lineHeight: 1.2,
                letterSpacing: -1,
              }}
            >
              Instant recall
              <br />
              across every session
            </h2>
          </SlideUp>

          {/* Claude chat bubble */}
          <SlideUp start={15}>
            <div
              style={{
                background: theme.bg3,
                border: `1px solid ${theme.border}`,
                borderRadius: '12px 12px 12px 4px',
                padding: '12px 16px',
                maxWidth: 340,
              }}
            >
              <p
                style={{
                  color: theme.text,
                  fontSize: 14,
                  margin: 0,
                  lineHeight: 1.5,
                  fontStyle: 'italic',
                }}
              >
                "How did we handle the race condition in the indexer?"
              </p>
            </div>
          </SlideUp>

          {/* Terminal */}
          <SlideUp start={30}>
            <TerminalWindow
              width={440}
              lines={[
                {
                  text: '$ qrec search "race condition indexer" --k 5',
                  color: theme.text,
                  startFrame: 35,
                  typewriter: true,
                  typeFrames: 50,
                },
                {
                  text: '↳ 3 sessions found  [52ms]',
                  color: theme.blue,
                  startFrame: 90,
                },
              ]}
            />
          </SlideUp>
        </div>

        {/* Right: search results */}
        <div
          style={{
            flex: 1,
            opacity: resultsOpacity,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              color: theme.textMuted,
              fontSize: 13,
              fontFamily: theme.mono,
              letterSpacing: 1,
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            Top results
          </div>

          <SlideUp start={100}>
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
          <SlideUp start={118}>
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
          <SlideUp start={136}>
            <SessionCard
              id="session-archive"
              title="Archive JSONL on index for durability"
              project="qrec"
              date="Mar 12"
              tags={['indexer', 'archive']}
              score={0.614}
              showScore
              showTags
            />
          </SlideUp>
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};
