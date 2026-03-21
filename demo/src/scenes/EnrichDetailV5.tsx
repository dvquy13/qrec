import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {
  CLAMP,
  SPRING_SNAPPY,
  remotionCSSAnimVars,
  REMOTION_ANIM_OVERRIDES,
  cursorBlink,
} from '../animUtils';
import {DashboardSection} from '../../../ui-react/src/sections/DashboardSection';
import {RecentSessionsSection} from '../../../ui-react/src/sections/RecentSessionsSection';
import {
  SessionDetailHeader,
  SessionDetailMeta,
  SessionTurns,
  type Turn,
} from '../../../ui-react/src/sections/SessionDetailSection';
import {EnrichBlock} from '../../../ui-react/src/components/EnrichBlock/EnrichBlock';
import {
  HEATMAP_BYPROJECT_BREAKDOWN,
  HEATMAP_BY_PROJECT,
  PROJECTS,
} from '../data/index';

// ── Timeline ──────────────────────────────────────────────────────────────────
//   0–  8f:  fade in
//   8– 35f:  browser cursor moves to session title
//  30– 43f:  session title turns blue (hover)
//  35– 43f:  click pulse on session card
//  43– 65f:  sessions list fades + scales out
//  55– 78f:  detail view fades in (Header + Meta + [empty enrich gap] + Turns)
//  78– 90f:  browser cursor fades out
//  90–112f:  Qwen3 Figma cursor slides in from right → empty enrichment area
// 112–130f:  cursor click animation + ripple
//            zoom-in spring: 1.0 → 2.5×, origin 15% 18% (over enrichment area)
//            Figma cursor fades out; stays gone for the rest of the scene
// 130–200f:  SUMMARY types in blue; labels + tags styled blue (hesitations 150–157, 177–182)
// 200–212f:  brief pause before zoom-out
// 212–232f:  zoom-out spring: 2.5 → 1.0×
// 232–250f:  tags appear (6f stagger)
// 248–263f:  Learning[0] types fast (~5/f)
// 263–270f:  hesitation
// 270–289f:  Learning[1] types fast (~5/f)
// 289–298f:  cursor moves to Questions area (no Figma cursor — just content)
// 298–315f:  Question[0] types fast (~5/f)
// 315–325f:  hold
// 325–345f:  scene fade out

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
    text: 'How can we ensure old sessions stay queryable after Claude Code deletes their source JSONL files?',
    tools: [],
    thinking: [],
    timestamp: '2026-03-13T11:00:00Z',
  },
  {
    role: 'assistant',
    text: 'Added `archiveJsonl()` to `indexer.ts` — copies each JSONL to `~/.qrec/archive/<project>/` before indexing. Self-copy guard: skips if source is already inside `ARCHIVE_DIR` to prevent ENOENT.',
    tools: ['Read: src/indexer.ts', 'Edit: src/indexer.ts'],
    thinking: [],
    timestamp: '2026-03-13T11:05:00Z',
  },
];

// ── Typing schedule ───────────────────────────────────────────────────────────
// Summary: full text — slow, readable at zoomed scale
// Burst 1: 130–150 (20f, 80 chars = 4/f)
// Pause:   150–157 (7f)
// Burst 2: 157–177 (20f, 80 chars = 4/f)
// Pause:   177–182 (5f)
// Burst 3: 182–200 (18f, remaining chars)
const SUMMARY_LEN = SESSION_SUMMARY.length;
const S_FRAMES = [130, 150, 157, 177, 182, 200];
const S_CHARS  = [0,    80,  80,  160, 160, SUMMARY_LEN];

// Fast phase — ~5 chars/frame after zoom-out
const L0_LEN = SESSION_LEARNINGS[0].length; // ~71
const L1_LEN = SESSION_LEARNINGS[1].length; // ~92
const Q0_LEN = SESSION_QUESTIONS[0].length; // ~81

const L0_START = 248, L0_END = 263;  // 15f
const L1_START = 270, L1_END = 289;  // 19f
const Q0_START = 298, Q0_END = 315;  // 17f

// ── Cursor positions (browser content div coords, 1200×598px) ────────────────
// NOTE: calibrate with DevTools getBoundingClientRect() if needed.
// content left ≈ 28(pad) + 142(centering) = 170px
// enrich area starts at ≈ 16(pad) + 53(header) + 46(meta) = 115px from top
const POS_ENTER = {x: 1370, y: 250} as const;
const POS_CLICK = {x: 172,  y: 118} as const; // empty area between meta and turns

// ── CSS overrides injected onto .enrich-animated wrapper ─────────────────────
// EnrichBlock defaults to var(--text-muted); override everything to accent blue.
const ENRICH_ANIMATED_CSS = `
  .enrich-animated .summary-block-label {
    color: rgb(0, 98, 168) !important;
    opacity: 1 !important;
  }
  .enrich-animated .summary-block p,
  .enrich-animated .summary-block-list li {
    color: rgb(0, 98, 168) !important;
  }
  .enrich-animated .enrich-tag {
    background: rgba(0, 98, 168, 0.08) !important;
    color: rgb(0, 98, 168) !important;
    border-color: rgba(0, 98, 168, 0.25) !important;
  }
`;

// ── Heatmap data ──────────────────────────────────────────────────────────────
const QREC_15W = HEATMAP_BY_PROJECT['qrec'].slice(-105);
const QREC_30_OFFSET = QREC_15W.length - 30;
const QREC_FILTERED_DAYS = QREC_15W.map((d, i) =>
  i >= QREC_30_OFFSET ? d : {...d, count: 0},
);
const QREC_SESSION_COUNT = QREC_FILTERED_DAYS.reduce((s, d) => s + d.count, 0);
const QREC_ACTIVE_DAYS = QREC_FILTERED_DAYS.filter((d) => d.count > 0).length;
const SESSIONS_TOTAL = 50;
const SUMMARIES_TOTAL = 50;

const DISPLAY_SESSIONS = [{
  id: SESSION_ID,
  title: SESSION_TITLE,
  project: SESSION_PROJECT,
  last_message_at: new Date('2026-03-13T11:00:00Z').getTime(),
  summary: SESSION_SUMMARY,
}];

const SESSION_HOVER_CSS = `
  [data-session-hovered="true"] .dashboard-session-title {
    color: var(--accent) !important;
    transition: none !important;
  }
`;

// ── Sub-components ────────────────────────────────────────────────────────────
const TrafficDots: React.FC = () => (
  <div style={{display: 'flex', gap: 6, alignItems: 'center', width: 56}}>
    {[1, 0.55, 0.28].map((alpha, i) => (
      <div key={i} style={{
        width: 12, height: 12, borderRadius: '50%',
        background: `rgba(0,98,168,${alpha})`,
      }} />
    ))}
  </div>
);

const MouseCursor: React.FC<{x: number; y: number; scale: number; opacity: number}> = ({
  x, y, scale, opacity,
}) => (
  <div style={{
    position: 'absolute', left: x, top: y, pointerEvents: 'none',
    transform: `scale(${scale})`, transformOrigin: '0 0',
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))', opacity,
  }}>
    <svg width="22" height="28" viewBox="0 0 22 28" fill="none">
      <path d="M2 2L20 13L12 14.5L8 26L2 2Z" fill="white" stroke="#1a1a1a"
        strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  </div>
);

// Figma-style collaborator cursor: blue arrow + "Qwen3-1.7B (local)" pill
const FigmaCursor: React.FC<{x: number; y: number; opacity: number; clickScale?: number}> = ({
  x, y, opacity, clickScale = 1,
}) => (
  <div style={{
    position: 'absolute', left: x, top: y, opacity, pointerEvents: 'none',
    filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.3))',
    transform: `scale(${clickScale})`, transformOrigin: '4px 4px',
  }}>
    <svg width="28" height="34" viewBox="0 0 20 24" fill="none" style={{display: 'block'}}>
      <path d="M2 2L18 11.5L11 13L8 22L2 2Z"
        fill="#0062a8" stroke="white" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
    <div style={{
      position: 'absolute', top: 26, left: 20,
      background: '#0062a8', color: 'white',
      fontSize: 14, fontWeight: 700, letterSpacing: '0.01em',
      padding: '5px 13px', borderRadius: '0 10px 10px 10px',
      whiteSpace: 'nowrap',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      lineHeight: 1.3,
    }}>
      Qwen3-1.7B (local)
    </div>
  </div>
);

const ClickRipple: React.FC<{x: number; y: number; scale: number; opacity: number}> = ({
  x, y, scale, opacity,
}) => (
  <div style={{
    position: 'absolute',
    left: x - 14, top: y - 14,
    width: 28, height: 28, borderRadius: '50%',
    border: '1.5px solid rgba(0,98,168,0.9)',
    transform: `scale(${scale})`,
    opacity, pointerEvents: 'none',
  }} />
);

// ── Main scene ────────────────────────────────────────────────────────────────
export const EnrichDetailV5: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const sceneOpacity = interpolate(frame, [0, 8, 315, 345], [0, 1, 1, 0], CLAMP);

  // ── Browser cursor ─────────────────────────────────────────────────────────
  const cursorMoveSp = spring({
    frame: frame - 8, fps,
    config: {damping: 22, stiffness: 130, mass: 1, overshootClamping: true},
  });
  const cursorX = interpolate(cursorMoveSp, [0, 1], [961, 220]);
  const cursorY = interpolate(cursorMoveSp, [0, 1], [153, 545]);
  const clickProgress = interpolate(frame, [35, 43], [0, 1], CLAMP);
  const cursorScale = interpolate(clickProgress, [0, 0.35, 1], [1, 0.82, 1]);
  const cursorOpacity = interpolate(frame, [0, 8, 75, 90], [0, 1, 1, 0], CLAMP);

  // ── Sessions phase ─────────────────────────────────────────────────────────
  const sessionsOpacity = interpolate(frame, [43, 63], [1, 0], CLAMP);
  const sessionsScale = interpolate(frame, [43, 65], [1, 1.04], CLAMP);
  const titleHovered = frame >= 30 && frame < 55;

  // ── Detail phase ───────────────────────────────────────────────────────────
  const detailOpacity = interpolate(frame, [55, 76], [0, 1], CLAMP);
  const detailScaleSp = spring({frame: frame - 55, fps, config: SPRING_SNAPPY});
  const detailScale = interpolate(detailScaleSp, [0, 1], [0.97, 1]);

  // ── Zoom in/out ────────────────────────────────────────────────────────────
  // zoom-in starts at click (112), zoom-out starts after summary done (212)
  const zoomInSp  = Math.min(1, spring({frame: frame - 112, fps, config: {damping: 26, stiffness: 80, overshootClamping: true}}));
  const zoomOutSp = Math.min(1, spring({frame: frame - 212, fps, config: {damping: 26, stiffness: 80, overshootClamping: true}}));
  const zoomLevel = Math.max(0, zoomInSp - zoomOutSp); // 0=normal, 1=zoomed
  const zoomScale = 1.0 + (2.5 - 1.0) * zoomLevel;
  const totalScale = detailScale * zoomScale;

  // ── Figma cursor movement ──────────────────────────────────────────────────
  // Enters from right → click position, then fades out permanently as zoom starts
  const spEnter = spring({frame: frame - 90, fps,
    config: {damping: 18, stiffness: 100, overshootClamping: true}});
  const figmaX = interpolate(spEnter, [0, 1], [POS_ENTER.x, POS_CLICK.x]);
  const figmaY = interpolate(spEnter, [0, 1], [POS_ENTER.y, POS_CLICK.y]);
  // Fades out as zoom-in begins; stays gone for the rest of the scene
  const figmaOpacity = interpolate(frame, [90, 103, 120, 128], [0, 1, 1, 0], CLAMP);

  // Click animation (frames 112–122)
  const figmaClickScale = interpolate(frame, [112, 115, 122], [1, 0.72, 1], CLAMP);
  const rippleProgress  = interpolate(frame, [112, 134], [0, 1], CLAMP);
  const rippleScale     = interpolate(rippleProgress, [0, 1], [0.3, 2.4]);
  const rippleOpacity   = interpolate(rippleProgress, [0, 0.2, 1], [0, 0.65, 0]);
  const clickLabelOpacity = interpolate(frame, [112, 115, 124, 129], [0, 1, 1, 0], CLAMP);

  // ── Summary typing ─────────────────────────────────────────────────────────
  const summaryChars = interpolate(frame, [...S_FRAMES], [...S_CHARS], CLAMP);
  const typedSummary = SESSION_SUMMARY.substring(0, Math.round(summaryChars));
  const isSummaryTyping = frame >= S_FRAMES[0] && frame < S_FRAMES[S_FRAMES.length - 1] + 3;

  // ── Learnings typing ───────────────────────────────────────────────────────
  const learn0Chars = interpolate(frame, [L0_START, L0_END], [0, L0_LEN], CLAMP);
  const typedLearn0 = SESSION_LEARNINGS[0].substring(0, Math.round(learn0Chars));
  const isLearn0Typing = frame >= L0_START && frame < L0_END + 3;

  const learn1Chars = interpolate(frame, [L1_START, L1_END], [0, L1_LEN], CLAMP);
  const typedLearn1 = SESSION_LEARNINGS[1].substring(0, Math.round(learn1Chars));
  const isLearn1Typing = frame >= L1_START && frame < L1_END + 3;

  // ── Questions typing ───────────────────────────────────────────────────────
  const q0Chars = interpolate(frame, [Q0_START, Q0_END], [0, Q0_LEN], CLAMP);
  const typedQ0 = SESSION_QUESTIONS[0].substring(0, Math.round(q0Chars));
  const isQ0Typing = frame >= Q0_START && frame < Q0_END + 3;

  // ── Cursor blink — append '|' to currently-typing string ──────────────────
  const anyTyping = isSummaryTyping || isLearn0Typing || isLearn1Typing || isQ0Typing;
  const blinkChar = anyTyping && cursorBlink(frame, 10) ? '|' : '';

  const displaySummary = isSummaryTyping ? typedSummary + blinkChar : typedSummary;

  const displayLearnings: string[] = [];
  if (learn0Chars > 0) displayLearnings.push(typedLearn0 + (isLearn0Typing ? blinkChar : ''));
  if (learn1Chars > 0) displayLearnings.push(typedLearn1 + (isLearn1Typing ? blinkChar : ''));

  const displayQuestions: string[] = [];
  if (q0Chars > 0) displayQuestions.push(typedQ0 + (isQ0Typing ? blinkChar : ''));

  // ── Tags — sequential reveal (6f stagger) ─────────────────────────────────
  const TAGS_START = 232;
  const tagCount = frame >= TAGS_START
    ? Math.min(SESSION_TAGS.length, Math.ceil((frame - TAGS_START) / 6))
    : 0;
  const displayTags = SESSION_TAGS.slice(0, tagCount);

  const cssAnimVars = remotionCSSAnimVars(frame, fps);

  return (
    <AbsoluteFill style={{
      background: theme.blue, fontFamily: theme.sans,
      overflow: 'hidden', opacity: sceneOpacity,
    }}>
      {/* ── Browser shell ── */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 1200, height: 640, borderRadius: 10, overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Title bar */}
          <div style={{
            background: '#ffffff', height: 42, padding: '0 18px',
            display: 'flex', alignItems: 'center',
            borderBottom: `1px solid ${theme.border}`, flexShrink: 0,
          }}>
            <TrafficDots />
            <div style={{flex: 1, display: 'flex', justifyContent: 'center'}}>
              <div style={{
                background: theme.bg2, border: `1px solid ${theme.border}`,
                borderRadius: 5, padding: '4px 16px', fontFamily: theme.mono,
                fontSize: 12, color: theme.textMuted,
                minWidth: 160, maxWidth: 360, textAlign: 'center',
              }}>
                {detailOpacity > 0.5
                  ? `localhost:25927/#session/${SESSION_ID}`
                  : 'localhost:25927'}
              </div>
            </div>
            <div style={{width: 56}} />
          </div>

          {/* Browser content */}
          <div style={{flex: 1, position: 'relative', overflow: 'hidden', background: '#ffffff'}}>

            {/* ── Phase 1: Sessions list ── */}
            <div style={{
              position: 'absolute', inset: 0,
              opacity: sessionsOpacity,
              transform: `scale(${sessionsScale})`, transformOrigin: 'center center',
              padding: '20px 28px 24px',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              ...cssAnimVars,
            }}
              data-session-hovered={titleHovered ? 'true' : 'false'}
            >
              <style>{REMOTION_ANIM_OVERRIDES}</style>
              <style>{SESSION_HOVER_CSS}</style>
              <div style={{
                maxWidth: 900, margin: '0 auto', width: '100%',
                display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden',
              }}>
                <DashboardSection
                  sessionsCount={SESSIONS_TOTAL} sessionsIndexing={false}
                  summariesCount={SUMMARIES_TOTAL} summariesSub="enriched"
                  summariesEnriching={false} searchesCount={0}
                  heatmapDays={QREC_FILTERED_DAYS}
                  heatmapByProject={HEATMAP_BYPROJECT_BREAKDOWN}
                  projects={[...PROJECTS]} selectedProject="qrec"
                  heatmapMetric="sessions"
                  footerText={`${QREC_SESSION_COUNT} sessions · ${QREC_ACTIVE_DAYS} active days`}
                />
                <div style={{marginTop: 24, flex: 1, overflow: 'hidden'}}>
                  <RecentSessionsSection
                    sessions={DISPLAY_SESSIONS} total={4}
                    onSessionClick={() => {}} onViewAll={() => {}}
                  />
                </div>
              </div>
            </div>

            {/* ── Phase 2: Session detail ── */}
            <div style={{
              position: 'absolute', inset: 0,
              opacity: detailOpacity,
              transform: `scale(${totalScale})`,
              // zoom origin: left-biased (15%) keeps text left edge visible at 2.5×;
              // 18% vertically centers on the EnrichBlock area
              transformOrigin: '15% 18%',
              background: '#ffffff', overflowY: 'hidden',
              padding: '16px 28px 20px',
            }}>
              <div style={{maxWidth: 860, margin: '0 auto', width: '100%'}}>

                {/* Real UI components — same HTML/CSS as the live qrec web app */}
                <SessionDetailHeader title={SESSION_TITLE} />
                <SessionDetailMeta
                  id={SESSION_ID}
                  project={SESSION_PROJECT}
                  date={SESSION_DATE}
                  turnCount={MOCK_TURNS.length}
                />

                {/* EnrichBlock — starts empty (returns null), fills as text is typed */}
                <div className="enrich-animated">
                  <style>{ENRICH_ANIMATED_CSS}</style>
                  <EnrichBlock
                    summary={displaySummary || undefined}
                    tags={displayTags.length ? displayTags : undefined}
                    learnings={displayLearnings.length ? displayLearnings : undefined}
                    questions={displayQuestions.length ? displayQuestions : undefined}
                    showSummary={!!displaySummary}
                    showTags={displayTags.length > 0}
                    showLearnings={displayLearnings.length > 0}
                    showQuestions={displayQuestions.length > 0}
                  />
                </div>

                <SessionTurns turns={MOCK_TURNS} />

              </div>

              {/* Click ripple at the empty enrichment area */}
              <ClickRipple
                x={POS_CLICK.x} y={POS_CLICK.y}
                scale={rippleScale} opacity={rippleOpacity}
              />

              {/* "Click" floating label */}
              {clickLabelOpacity > 0 && (
                <div style={{
                  position: 'absolute',
                  left: POS_CLICK.x + 26, top: POS_CLICK.y - 22,
                  opacity: clickLabelOpacity,
                  background: 'rgba(0,98,168,0.92)', color: 'white',
                  fontSize: 10, fontWeight: 700,
                  padding: '3px 9px', borderRadius: 10,
                  pointerEvents: 'none', letterSpacing: '0.05em',
                  boxShadow: '0 2px 8px rgba(0,98,168,0.35)',
                }}>
                  Click
                </div>
              )}

              <FigmaCursor
                x={figmaX} y={figmaY}
                opacity={figmaOpacity}
                clickScale={figmaClickScale}
              />

            </div>

          </div>
        </div>
      </div>

      {/* Browser mouse cursor */}
      <MouseCursor x={cursorX} y={cursorY} scale={cursorScale} opacity={cursorOpacity} />
    </AbsoluteFill>
  );
};
