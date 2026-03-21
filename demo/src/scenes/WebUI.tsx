import React from 'react';
import {AbsoluteFill, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../theme';
import {SceneFade} from '../components/SceneFade';
import {SlideUp} from '../components/SlideUp';
import {HeatmapGrid} from '../../../ui-react/src/components/HeatmapGrid';
import {SessionCard} from '../../../ui-react/src/components/SessionCard';

// Three sub-panels shown sequentially
// Panel 1 — Dashboard + heatmap: 0–180
// Panel 2 — Session search:     150–360
// Panel 3 — Enriched learnings: 330–570

const Panel: React.FC<{
  label: string;
  heading: string;
  children: React.ReactNode;
  durationInFrames: number;
}> = ({label, heading, children, durationInFrames}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, 20, durationInFrames - 30, durationInFrames],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  return (
    <AbsoluteFill style={{opacity}}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          height: '100%',
          alignItems: 'center',
          padding: '0 60px',
          gap: 60,
        }}
      >
        {/* Left label column */}
        <div style={{width: 240, flexShrink: 0}}>
          <SlideUp start={5}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: theme.blueDim,
                border: `1px solid ${theme.blueBorder}`,
                borderRadius: 6,
                padding: '5px 12px',
                marginBottom: 16,
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
                For You
              </span>
            </div>
          </SlideUp>
          <SlideUp start={10}>
            <h2
              style={{
                color: theme.text,
                fontSize: 33,
                fontWeight: 700,
                margin: 0,
                lineHeight: 1.2,
                letterSpacing: -1,
              }}
            >
              {heading}
            </h2>
          </SlideUp>
          <SlideUp start={20}>
            <p
              style={{
                color: theme.textMuted,
                fontSize: 15,
                lineHeight: 1.6,
                marginTop: 14,
              }}
            >
              {label}
            </p>
          </SlideUp>
        </div>

        {/* Right: content */}
        <div style={{flex: 1}}>{children}</div>
      </div>
    </AbsoluteFill>
  );
};

// Module-level synthetic data for demo animation
const DEMO_SEED = [0,0,0,1,0,2,1,0,0,1,3,2,1,0,0,2,1,0,1,2,0,0,1,0,3,2,
                   1,0,2,1,0,0,1,2,0,1,0,2,3,1,0,0,2,1,0,1,2,0,0,1,0,2,1,
                   3,0,1,2,0,1,0,2,1,0,3,2,1,0,2,1,3,2,0,1,0,2,1,0,3,2,1,
                   0,0,1,2,0,1,2,3,0,1,0,2,1,0,2,1,0,1,2,0,3,1,0,2,1,3,0,
                   2,1,0,2,3,1,0,1,2,0,1,3,2,0,1,2,0,3,1,2,0,1,3,2,1,0,2,
                   1,0,2,3,1,0,2,1,0,1,2,3,0,1,2,0,1,0,2,1,3,0,1,2,0,1,3,
                   2,0,1,2,3,0,1,2,0,3,1,2,0,1,3,2,0,1,2,3,0,1,0,2,3,1,0];
const DEMO_DAYS = (() => {
  const start = new Date();
  start.setDate(start.getDate() - DEMO_SEED.length + 1);
  return DEMO_SEED.map((count, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return { date: d.toISOString().slice(0, 10), count };
  });
})();

export const WebUI: React.FC = () => {
  return (
    <SceneFade durationInFrames={570} fadeIn={20} fadeOut={30}>
      <AbsoluteFill style={{background: theme.bg}}>
        {/* Panel 1 — Heatmap */}
        <Sequence from={0} durationInFrames={210}>
          <Panel
            heading="See everything you've built."
            label="GitHub-style activity heatmap. Every session, every project."
            durationInFrames={210}
          >
            <HeatmapGridPanel />
          </Panel>
        </Sequence>

        {/* Panel 2 — Search */}
        <Sequence from={180} durationInFrames={210}>
          <Panel
            heading="Search your entire work history."
            label="Full-text + semantic search across all sessions, enriched with AI summaries and tags."
            durationInFrames={210}
          >
            <SearchPanel />
          </Panel>
        </Sequence>

        {/* Panel 3 — Learnings */}
        <Sequence from={360} durationInFrames={210}>
          <Panel
            heading="Extract what matters."
            label="AI-extracted key learnings, tags, and summaries from every session. Automatically."
            durationInFrames={210}
          >
            <LearningsPanel />
          </Panel>
        </Sequence>
      </AbsoluteFill>
    </SceneFade>
  );
};

const HeatmapGridPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const revealedCount = Math.floor(
    interpolate(frame - 20, [0, 40], [0, DEMO_DAYS.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  return (
    <div
      style={{
        background: theme.bg2,
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        padding: 28,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 32,
          marginBottom: 20,
        }}
      >
        {[
          {label: 'Sessions', value: '847'},
          {label: 'Projects', value: '24'},
          {label: 'Enriched', value: '100%'},
        ].map(({label, value}, i) => {
          const opacity = interpolate(frame, [i * 8 + 10, i * 8 + 25], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div key={label} style={{opacity}}>
              <div
                style={{
                  color: theme.blue,
                  fontSize: 30,
                  fontWeight: 700,
                  fontFamily: theme.mono,
                }}
              >
                {value}
              </div>
              <div style={{color: theme.textMuted, fontSize: 14}}>{label}</div>
            </div>
          );
        })}
      </div>
      <HeatmapGrid days={DEMO_DAYS} revealedCount={revealedCount} showWeeklyBars={false} showDayLabels={false} />
    </div>
  );
};

const SearchPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const query = 'auth middleware';
  const typedChars = Math.floor(
    interpolate(frame, [10, 35], [0, query.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );

  return (
    <div>
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
            4 results [48ms]
          </span>
        )}
      </div>

      <SlideUp start={45}>
        <SessionCard
          id="session-auth-1"
          title="Rewrote auth middleware for compliance"
          project="api"
          date="Feb 28"
          summary="Legal flagged session token storage. Rewrote middleware to use httpOnly cookies."
          tags={['auth', 'security', 'compliance']}
          score={0.891}
          showScore
          showSummary
          showTags
        />
      </SlideUp>
      <SlideUp start={63}>
        <SessionCard
          id="session-auth-2"
          title="Auth middleware JWT validation edge cases"
          project="api"
          date="Feb 14"
          tags={['auth', 'jwt']}
          score={0.743}
          showScore
          showTags
        />
      </SlideUp>
    </div>
  );
};

const LearningsPanel: React.FC = () => {
  const frame = useCurrentFrame();

  const enrichProgress = interpolate(frame, [40, 90], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const showEnriched = enrichProgress > 0.5;

  return (
    <div>
      <SessionCard
        id="auth-session"
        title="Rewrote auth middleware for compliance"
        project="api"
        date="Feb 28"
        summary={showEnriched ? 'Rewrote session token storage to httpOnly cookies after legal compliance review. Removed JWT from localStorage, added CSRF protection.' : undefined}
        learnings={showEnriched ? [
          'httpOnly cookies prevent XSS token theft',
          'CSRF token must be rotated on auth state change',
        ] : undefined}
        tags={showEnriched ? ['auth', 'security', 'compliance', 'cookies'] : undefined}
        showSummary
        showLearnings
        showTags
        style={{
          opacity: interpolate(frame, [0, 15], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      />
      <SlideUp start={100}>
        <SessionCard
          id="session-race-2"
          title="Fixed race condition in indexer mtime filter"
          project="qrec"
          date="Mar 10"
          learnings={['Always compare file mtime against indexed_at, not wall-clock time — concurrent writes shift the baseline.']}
          tags={['bug', 'indexer', 'concurrency']}
          showLearnings
          showTags
        />
      </SlideUp>
    </div>
  );
};
