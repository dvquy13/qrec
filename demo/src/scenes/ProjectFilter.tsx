import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {CLAMP, SPRING_BOUNCY, SPRING_SNAPPY, remotionCSSAnimVars, REMOTION_ANIM_OVERRIDES} from '../animUtils';
import {DashboardSection} from '../../../ui-react/src/sections/DashboardSection';
import {RecentActivitySection} from '../../../ui-react/src/sections/RecentActivitySection';
import {RecentSessionsSection} from '../../../ui-react/src/sections/RecentSessionsSection';
import {RunGroup} from '../../../ui-react/src/components/ActivityFeed/ActivityFeed';
import {
  HEATMAP_DAYS,
  HEATMAP_BYPROJECT_BREAKDOWN,
  HEATMAP_BY_PROJECT,
  PROJECTS,
} from '../data/index';

// ── Timeline ──────────────────────────────────────────────────────────────────
//   0–  0f:  hard cut in (no fade in — continues directly from Onboard)
//   0– 12f:  hold
//  12– 40f:  activity slides DOWN, sessions slide UP (1 api session)
//  40– 75f:  hold on sessions
//  75–115f:  cursor fades in at (650,500), springs to qrec pill (~961,153)
// 115–122f:  click scale pulse
// 122–140f:  filter applied: heatmap → qrec 30d, session → qrec, pill highlighted
// 140–168f:  hold on filtered state
// 168–180f:  (no fade out — hard cut to EnrichDetail)

const SESSIONS_TOTAL = 50;
const SUMMARIES_TOTAL = 50;

// ── Static "Onboard final frame" heatmap data ─────────────────────────────────
// Mirrors the exact computation in Onboard.tsx with sessionsCount = 50
const HEATMAP_15W = HEATMAP_DAYS.slice(-105);
const LAST30_OFFSET = HEATMAP_15W.length - 30;
const heatmap30 = HEATMAP_15W.slice(LAST30_OFFSET);
const weightTotal = heatmap30.reduce((s, d) => s + d.count, 0);
const exact = heatmap30.map((d) => (d.count / weightTotal) * SESSIONS_TOTAL);
const floors = exact.map(Math.floor);
const remaining = SESSIONS_TOTAL - floors.reduce((s, v) => s + v, 0);
exact
  .map((v, i) => ({i, frac: v % 1}))
  .sort((a, b) => b.frac - a.frac)
  .slice(0, remaining)
  .forEach(({i}) => floors[i]++);
const ONBOARD_DAYS = HEATMAP_15W.map((d, i) =>
  i >= LAST30_OFFSET ? {...d, count: floors[i - LAST30_OFFSET]} : {...d, count: 0},
);
const ONBOARD_ACTIVE_DAYS = ONBOARD_DAYS.filter((d) => d.count > 0).length;

// ── qrec-filtered heatmap (same 15-week window, only last 30 days) ────────────
const QREC_15W = HEATMAP_BY_PROJECT['qrec'].slice(-105);
const QREC_30_OFFSET = QREC_15W.length - 30;
const QREC_FILTERED_DAYS = QREC_15W.map((d, i) =>
  i >= QREC_30_OFFSET ? d : {...d, count: 0},
);
const QREC_SESSION_COUNT = QREC_FILTERED_DAYS.reduce((s, d) => s + d.count, 0);
const QREC_ACTIVE_DAYS = QREC_FILTERED_DAYS.filter((d) => d.count > 0).length;

// ── Completed activity groups (Onboard frame 197 state) ───────────────────────
const NOW = Date.now();
const COMPLETED_GROUPS: RunGroup[] = [
  {type: 'enrich', running: false, ts: NOW, events: []},
  {type: 'index', running: false, ts: NOW, events: []},
  {type: 'model_loading', running: false, ts: NOW, events: []},
  {type: 'model_download', running: false, ts: NOW, events: []},
];

// ── Traffic dots (same as Onboard) ──────────────────────────────────────────
const TrafficDots: React.FC<{dark?: boolean}> = ({dark}) => (
  <div style={{display: 'flex', gap: 6, alignItems: 'center', width: 56}}>
    {[1, 0.55, 0.28].map((alpha, i) => (
      <div
        key={i}
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: dark
            ? `rgba(255,255,255,${alpha})`
            : `rgba(0,98,168,${alpha})`,
        }}
      />
    ))}
  </div>
);

// ── Mouse cursor SVG ──────────────────────────────────────────────────────────
const MouseCursor: React.FC<{x: number; y: number; scale: number}> = ({x, y, scale}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      pointerEvents: 'none',
      transform: `scale(${scale})`,
      transformOrigin: '0 0',
      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))',
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

export const ProjectFilter: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // ── Scene opacity ─────────────────────────────────────────────────────────
  const sceneOpacity = interpolate(frame, [0, 168], [1, 1], CLAMP);

  // ── Activity → Sessions transition ────────────────────────────────────────
  const transitionSp = spring({frame: frame - 12, fps, config: SPRING_BOUNCY});
  // Activity slides DOWN and fades
  const activityY = interpolate(transitionSp, [0, 1], [0, 280]);
  const activityOpacity = interpolate(frame, [12, 32], [1, 0], CLAMP);
  // Sessions slides UP and fades in
  const sessionsY = interpolate(transitionSp, [0, 1], [80, 0]);
  const sessionsOpacity = interpolate(transitionSp, [0, 1], [0, 1]);

  // ── Cursor animation ──────────────────────────────────────────────────────
  // Start: (650, 500) — lower-center of browser content
  // End:   (~961, ~153) — center of "qrec" pill in HeatmapProjectFilter
  // NOTE: these pixel values are estimates; tune after first test render
  const CURSOR_START_X = 650;
  const CURSOR_START_Y = 500;
  const CURSOR_END_X = 961; // qrec pill center x in frame coords
  const CURSOR_END_Y = 153; // qrec pill center y in frame coords

  const cursorVisible = frame >= 75;
  const cursorOpacity = interpolate(frame, [75, 85], [0, 1], CLAMP);
  const cursorSp = spring({
    frame: frame - 82,
    fps,
    config: {damping: 22, stiffness: 130, mass: 1, overshootClamping: true},
  });
  const cursorX = interpolate(cursorSp, [0, 1], [CURSOR_START_X, CURSOR_END_X]);
  const cursorY = interpolate(cursorSp, [0, 1], [CURSOR_START_Y, CURSOR_END_Y]);

  // Click pulse: scale 1 → 0.82 → 1 over frames 115–122
  const clickProgress = interpolate(frame, [115, 122], [0, 1], CLAMP);
  const cursorScale = interpolate(clickProgress, [0, 0.35, 1], [1, 0.82, 1]);

  // ── Filter state ──────────────────────────────────────────────────────────
  const filterApplied = frame >= 122;

  const heatmapDays = filterApplied ? QREC_FILTERED_DAYS : ONBOARD_DAYS;
  // Sessions stat card always shows total (real qrec UI doesn't filter it by project)
  const activeDays = filterApplied ? QREC_ACTIVE_DAYS : ONBOARD_ACTIVE_DAYS;
  const footerText = `${filterApplied ? QREC_SESSION_COUNT : SESSIONS_TOTAL} sessions · ${activeDays} active days`;
  const selectedProject = filterApplied ? 'qrec' : null;

  const displaySessions = filterApplied
    ? [
        {
          id: 'c0ffee04',
          title: 'How can we ensure old sessions stay\u2026',
          project: 'qrec',
          last_message_at: new Date('2026-03-13T11:00:00Z').getTime(),
          summary:
            'Added archiveJsonl() in indexer.ts to copy each JSONL to ~/.qrec/archive/ before indexing.',
        },
      ]
    : [
        {
          id: 'a1b2c3d4',
          title: 'Memory leak in long-running Node.js service',
          project: 'api',
          last_message_at: new Date('2026-02-20T22:55:00Z').getTime(),
          summary:
            'Identified a memory leak in the API gateway caused by unbounded event listener accumulation on the request pool. Heap snapshots pinpointed retained closures from uncancelled timeout chains.',
        },
      ];
  const displayTotal = filterApplied ? 4 : SESSIONS_TOTAL;

  // ── Frame-driven CSS animation overrides ──────────────────────────────────
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
      {/* ── Browser ── */}
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
                  maxWidth: 260,
                  textAlign: 'center',
                }}
              >
                localhost:25927
              </div>
            </div>
            <div style={{width: 56}} />
          </div>

          {/* Dashboard content */}
          <div
            style={{
              flex: 1,
              background: '#ffffff',
              overflow: 'hidden',
              padding: '20px 28px 24px',
              fontFamily: theme.sans,
              display: 'flex',
              flexDirection: 'column',
              ...cssAnimVars,
            }}
          >
            <style>{REMOTION_ANIM_OVERRIDES}</style>
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
                heatmapDays={heatmapDays}
                heatmapByProject={HEATMAP_BYPROJECT_BREAKDOWN}
                projects={[...PROJECTS]}
                selectedProject={selectedProject}
                heatmapMetric="sessions"
                footerText={footerText}
              />

              {/* Transition container: clips sliding children */}
              <div style={{flex: 1, overflow: 'hidden', position: 'relative'}}>
                {/* Recent Activity — slides DOWN out */}
                <div
                  style={{
                    position: 'absolute',
                    width: '100%',
                    transform: `translateY(${activityY}px)`,
                    opacity: activityOpacity,
                  }}
                >
                  <RecentActivitySection
                    groups={COMPLETED_GROUPS}
                    modelName="embeddinggemma-300M-Q8_0.gguf"
                    maxVisible={5}
                    isLive={false}
                    marginTop={24}
                  />
                </div>

                {/* Recent Sessions — slides UP in */}
                <div
                  style={{
                    position: 'absolute',
                    width: '100%',
                    transform: `translateY(${sessionsY}px)`,
                    opacity: sessionsOpacity,
                  }}
                >
                  <div style={{marginTop: 24}}>
                    <RecentSessionsSection
                      sessions={displaySessions}
                      total={displayTotal}
                      onSessionClick={() => {}}
                      onViewAll={() => {}}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mouse cursor ── */}
      {cursorVisible && (
        <div style={{opacity: cursorOpacity}}>
          <MouseCursor x={cursorX} y={cursorY} scale={cursorScale} />
        </div>
      )}
    </AbsoluteFill>
  );
};
