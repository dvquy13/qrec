import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {CLAMP, SPRING_SNAPPY, remotionCSSAnimVars, REMOTION_ANIM_OVERRIDES} from '../animUtils';
import {DashboardSection} from '../../../ui-react/src/sections/DashboardSection';
import {RecentSessionsSection} from '../../../ui-react/src/sections/RecentSessionsSection';
import {SessionDetailSection} from '../../../ui-react/src/sections/SessionDetailSection';
import type {Turn} from '../../../ui-react/src/sections/SessionDetailSection';
import {
  HEATMAP_BYPROJECT_BREAKDOWN,
  HEATMAP_BY_PROJECT,
  PROJECTS,
} from '../data/index';

// ── Timeline ──────────────────────────────────────────────────────────────────
//   0–  8f:  fade in on ProjectFilter end state (qrec filtered, sessions visible)
//   8– 35f:  cursor moves from qrec pill (961,153) → session title (220,545)
//  30– 43f:  session title turns blue (hover effect)
//  35– 43f:  click pulse (scale 1 → 0.82 → 1)
//  43– 65f:  sessions content fades + scales out
//  55– 78f:  detail content scales + fades in (cross-fade overlap)
//  78– 90f:  cursor fades out
//  90–108f:  title field highlight springs in + Qwen3-1.7B badge
// 108–126f:  summary field highlight springs in
// 126–144f:  learnings field highlight springs in
// 144–162f:  questions field highlight springs in
// 162–200f:  "Generated locally · Qwen3-1.7B" toast springs up
// 200–215f:  hold
// 215–230f:  fade out

// ── Session data ──────────────────────────────────────────────────────────────
const SESSION_ID = 'c0ffee04';
const SESSION_TITLE = 'Archive JSONL on index for session durability';
const SESSION_PROJECT = 'qrec';
const SESSION_DATE = '2026-03-13';
const SESSION_SUMMARY =
  'Claude Code deletes old JSONL files after ~30 days. Added archiveJsonl() in indexer.ts to copy each ingested file to ~/.qrec/archive/<project>/ before indexing, ensuring sessions remain queryable after source deletion.';
const SESSION_TAGS = ['indexer', 'durability', 'archive'];
const SESSION_LEARNINGS = [
  'JSONL files disappear silently — never assume source files are durable.',
  'Self-copy guard is essential: if source is already inside ARCHIVE_DIR, skip to avoid ENOENT.',
];
const SESSION_QUESTIONS = [
  'What happens when archiveJsonl() is called on a path already inside ARCHIVE_DIR?',
];

const MOCK_TURNS: Turn[] = [
  {
    role: 'user',
    text: 'Claude Code appears to be deleting old JSONL session files after ~30 days. We lose access to sessions we worked on weeks ago. Can we preserve them during indexing?',
    tools: [],
    thinking: [],
    timestamp: '2026-03-13T10:45:00.000Z',
  },
  {
    role: 'assistant',
    text: 'Added `archiveJsonl()` to `indexer.ts`. Before embedding each session, we now copy its JSONL file to `~/.qrec/archive/<project>/`. A self-copy guard prevents ENOENT crashes if the source is already inside the archive directory.',
    tools: ['Read indexer.ts', 'Edit indexer.ts'],
    thinking: [],
    timestamp: '2026-03-13T11:00:00.000Z',
  },
];

// ── Heatmap data (mirrors ProjectFilter qrec-filtered end state) ──────────────
const QREC_15W = HEATMAP_BY_PROJECT['qrec'].slice(-105);
const QREC_30_OFFSET = QREC_15W.length - 30;
const QREC_FILTERED_DAYS = QREC_15W.map((d, i) =>
  i >= QREC_30_OFFSET ? d : {...d, count: 0},
);
const QREC_SESSION_COUNT = QREC_FILTERED_DAYS.reduce((s, d) => s + d.count, 0);
const QREC_ACTIVE_DAYS = QREC_FILTERED_DAYS.filter((d) => d.count > 0).length;
const SESSIONS_TOTAL = 50;
const SUMMARIES_TOTAL = 50;

// Session card shown in the list before click
const DISPLAY_SESSIONS = [
  {
    id: SESSION_ID,
    title: SESSION_TITLE,
    project: SESSION_PROJECT,
    last_message_at: new Date('2026-03-13T11:00:00Z').getTime(),
    summary: SESSION_SUMMARY,
  },
];

// ── CSS injected into the sessions phase ──────────────────────────────────────
// Simulates the CSS :hover color change when cursor lands on the title
const SESSION_HOVER_CSS = `
  [data-session-hovered="true"] .dashboard-session-title {
    color: var(--accent) !important;
    transition: none !important;
  }
`;


// ── TrafficDots ───────────────────────────────────────────────────────────────
const TrafficDots: React.FC = () => (
  <div style={{display: 'flex', gap: 6, alignItems: 'center', width: 56}}>
    {[1, 0.55, 0.28].map((alpha, i) => (
      <div
        key={i}
        style={{width: 12, height: 12, borderRadius: '50%', background: `rgba(0,98,168,${alpha})`}}
      />
    ))}
  </div>
);

// ── Mouse cursor ──────────────────────────────────────────────────────────────
const MouseCursor: React.FC<{x: number; y: number; scale: number; opacity: number}> = ({
  x, y, scale, opacity,
}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      pointerEvents: 'none',
      transform: `scale(${scale})`,
      transformOrigin: '0 0',
      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))',
      opacity,
    }}
  >
    <svg width="22" height="28" viewBox="0 0 22 28" fill="none">
      <path
        d="M2 2L20 13L12 14.5L8 26L2 2Z"
        fill="white"
        stroke="#1a1a1a"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

// ── Main scene ────────────────────────────────────────────────────────────────
export const EnrichDetail: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // Scene opacity
  const sceneOpacity = interpolate(frame, [0, 8, 215, 230], [0, 1, 1, 0], CLAMP);

  // ── Cursor animation ─────────────────────────────────────────────────────
  // Start: qrec pill position from ProjectFilter end state
  // End: measured via DevTools at frame (190, 540) — title top-left in frame coords
  const CURSOR_START_X = 961;
  const CURSOR_START_Y = 153;
  const CURSOR_END_X = 220; // 30px into title text from left edge (x=190)
  const CURSOR_END_Y = 545; // title center y in frame coords (measured: 540+5)

  const cursorMoveSp = spring({
    frame: frame - 8,
    fps,
    config: {damping: 22, stiffness: 130, mass: 1, overshootClamping: true},
  });
  const cursorX = interpolate(cursorMoveSp, [0, 1], [CURSOR_START_X, CURSOR_END_X]);
  const cursorY = interpolate(cursorMoveSp, [0, 1], [CURSOR_START_Y, CURSOR_END_Y]);

  // Click pulse: 35–43f
  const clickProgress = interpolate(frame, [35, 43], [0, 1], CLAMP);
  const cursorScale = interpolate(clickProgress, [0, 0.35, 1], [1, 0.82, 1]);

  // Cursor fades out after the transition
  const cursorOpacity = interpolate(frame, [0, 8, 75, 90], [0, 1, 1, 0], CLAMP);

  // ── Sessions phase ───────────────────────────────────────────────────────
  const sessionsOpacity = interpolate(frame, [43, 63], [1, 0], CLAMP);
  const sessionsScale = interpolate(frame, [43, 65], [1, 1.04], CLAMP);

  // Title hover: active from frame 30 (cursor settled) to 55 (transition complete)
  const titleHovered = frame >= 30 && frame < 55;

  // ── Detail phase ─────────────────────────────────────────────────────────
  const detailOpacity = interpolate(frame, [55, 76], [0, 1], CLAMP);
  const detailScaleSp = spring({frame: frame - 55, fps, config: SPRING_SNAPPY});
  const detailScale = interpolate(detailScaleSp, [0, 1], [0.97, 1]);

  const cssAnimVars = remotionCSSAnimVars(frame, fps);

  return (
    <AbsoluteFill
      style={{
        background: theme.blue,
        fontFamily: theme.sans,
        overflow: 'hidden',
        opacity: sceneOpacity,
      }}
    >
      {/* ── Browser shell ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 1200,
            height: 640,
            borderRadius: 10,
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Browser title bar */}
          <div
            style={{
              background: '#ffffff',
              height: 42,
              padding: '0 18px',
              display: 'flex',
              alignItems: 'center',
              borderBottom: `1px solid ${theme.border}`,
              flexShrink: 0,
            }}
          >
            <TrafficDots />
            <div style={{flex: 1, display: 'flex', justifyContent: 'center'}}>
              <div
                style={{
                  background: theme.bg2,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 5,
                  padding: '4px 16px',
                  fontFamily: theme.mono,
                  fontSize: 12,
                  color: theme.textMuted,
                  minWidth: 160,
                  maxWidth: 360,
                  textAlign: 'center',
                }}
              >
                {detailOpacity > 0.5
                  ? `localhost:25927/#session/${SESSION_ID}`
                  : 'localhost:25927'}
              </div>
            </div>
            <div style={{width: 56}} />
          </div>

          {/* Browser content — sessions and detail stacked via opacity */}
          <div style={{flex: 1, position: 'relative', overflow: 'hidden', background: '#ffffff'}}>

            {/* ── Phase 1: Sessions list (ProjectFilter end state) ── */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                opacity: sessionsOpacity,
                transform: `scale(${sessionsScale})`,
                transformOrigin: 'center center',
                padding: '20px 28px 24px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                ...cssAnimVars,
              }}
              data-session-hovered={titleHovered ? 'true' : 'false'}
            >
              <style>{REMOTION_ANIM_OVERRIDES}</style>
              <style>{SESSION_HOVER_CSS}</style>
              <div
                style={{
                  maxWidth: 900,
                  margin: '0 auto',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  overflow: 'hidden',
                }}
              >
                <DashboardSection
                  sessionsCount={SESSIONS_TOTAL}
                  sessionsIndexing={false}
                  summariesCount={SUMMARIES_TOTAL}
                  summariesSub="enriched"
                  summariesEnriching={false}
                  searchesCount={0}
                  heatmapDays={QREC_FILTERED_DAYS}
                  heatmapByProject={HEATMAP_BYPROJECT_BREAKDOWN}
                  projects={[...PROJECTS]}
                  selectedProject="qrec"
                  heatmapMetric="sessions"
                  footerText={`${QREC_SESSION_COUNT} sessions · ${QREC_ACTIVE_DAYS} active days`}
                />
                <div style={{marginTop: 24, flex: 1, overflow: 'hidden'}}>
                  <RecentSessionsSection
                    sessions={DISPLAY_SESSIONS}
                    total={4}
                    onSessionClick={() => {}}
                    onViewAll={() => {}}
                  />
                </div>
              </div>
            </div>

            {/* ── Phase 2: Session detail view ── */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                opacity: detailOpacity,
                transform: `scale(${detailScale})`,
                transformOrigin: 'center center',
                background: '#ffffff',
                overflowY: 'hidden',
                padding: '16px 28px 20px',
              }}
            >
              <div style={{maxWidth: 860, margin: '0 auto', width: '100%'}}>
                <SessionDetailSection
                  id={SESSION_ID}
                  title={SESSION_TITLE}
                  project={SESSION_PROJECT}
                  date={SESSION_DATE}
                  summary={SESSION_SUMMARY}
                  tags={SESSION_TAGS}
                  learnings={SESSION_LEARNINGS}
                  questions={SESSION_QUESTIONS}
                  turns={MOCK_TURNS}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mouse cursor ── */}
      <MouseCursor
        x={cursorX}
        y={cursorY}
        scale={cursorScale}
        opacity={cursorOpacity}
      />
    </AbsoluteFill>
  );
};
