import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {measureText} from '@remotion/layout-utils';
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
import {
  HEATMAP_BYPROJECT_BREAKDOWN,
  HEATMAP_BY_PROJECT,
  PROJECTS,
} from '../data/index';
import {MouseCursor} from '../components/MouseCursor';

// ── Timeline ──────────────────────────────────────────────────────────────────
//   0–  8f:  fade in
//   8– 35f:  browser cursor moves to session title
//  30– 43f:  hover effect + click
//  43– 65f:  sessions fade out
//  55– 78f:  detail fades in (shows RAW_TITLE)
//  78– 90f:  browser cursor fades out
//  90–112f:  Figma cursor slides in → end of RAW_TITLE text; label appears with cursor
// 112–205f:  cursor blinks (thinking, ~5 blinks); zoom-in starts at 112
// 205–233f:  RAW_TITLE deleted char-by-char
// 233–253f:  pause — empty title, cursor blinks
// 253–288f:  SESSION_TITLE typed char-by-char (blue text)
// 288–303f:  hold on finished enriched title
// 303–323f:  zoom-out spring; Figma cursor fades out
// 333–337f:  "Summary" label typed (7 chars, ~2 chars/f)
// 340–365f:  summary content types fast (~3.75 chars/f)
// 379–397f:  tags appear (6f stagger) → "Learnings" label starts
// 397–402f:  "Learnings" label typed (9 chars, ~2 chars/f)
// 405–424f:  Learning[0] types
// 438–461f:  Learning[1] types
// 474–492f:  "Questions answered" label typed (18 chars)
// 495–514f:  Question[0] types
// 525–545f:  scene fade out

// ── Session data ──────────────────────────────────────────────────────────────
const SESSION_ID = 'c0ffee04';
// RAW_TITLE: truncated first user message — what qrec shows before enrichment
const RAW_TITLE = 'How can we ensure old sessions stay\u2026';
const SESSION_TITLE = 'Archive JSONL on index for session durability';
const SESSION_PROJECT = 'qrec';
const SESSION_DATE = '2026-03-13';
const SESSION_SUMMARY =
  'Added archiveJsonl() in indexer.ts to copy each JSONL to ~/.qrec/archive/ before indexing.';
const SESSION_TAGS = ['indexer', 'durability', 'archive'];
const SESSION_LEARNINGS = [
  'JSONL files disappear silently — never assume source files are durable.',
  'Self-copy guard is essential: if source is already inside ARCHIVE_DIR, skip to avoid ENOENT.',
];
const SESSION_QUESTIONS = [
  'What happens when archiveJsonl() is called on a path already inside ARCHIVE_DIR?',
];
const SUMMARY_LEN = SESSION_SUMMARY.length;
const RAW_TITLE_LEN = RAW_TITLE.length;
const SESSION_TITLE_LEN = SESSION_TITLE.length;

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

// ── Layout constants (detail-div coords) ─────────────────────────────────────
// TEXT_BLOCK_LEFT: centering offset inside the detail div
//   = detail-padding-left(28) + (1200-56-860)/2=142 = 170px
// TITLE_CURSOR_Y: y of the title element top inside detail div
//   = detail-padding-top(16) = 16px  (title h1 is the first child)
// ENRICH_Y / SUMMARY_LABEL_Y / SUMMARY_TEXT_Y: as before
const TEXT_BLOCK_LEFT = 170;
const TITLE_CURSOR_Y = 16;
// Bottom of the title text line: top(16) + font-size(24) * line-height(1.2) ≈ 45
const TITLE_BOTTOM_Y = 45;
const ENRICH_Y = 118;
const SUMMARY_LABEL_Y = 132;
const SUMMARY_TEXT_Y = 151;
const TEXT_LINE_HEIGHT = 20;

// ── Zoom constants ────────────────────────────────────────────────────────────
// Title zoom: 1.8× focused on the title row.
// tx=-216 → visible area from div-x=120 (50px breathing room before title at 170)
// ty=0    → no vertical pan (title is already at top of content)
// Visible div-x range: 120 to 831 — RAW_TITLE text ends at ~761, SESSION_TITLE ~666
const TITLE_ZOOM_SCALE = 1.8;
const TITLE_TX = -216; // = -120 × 1.8
const TITLE_TY = 0;

// ── Timing constants ──────────────────────────────────────────────────────────
const TITLE_ZOOM_IN_FRAME = 112;
const BLINK_START = 112;
// Figma cursor + label enter at frame 90; label opacity tracks cursor (no separate show window)
const TITLE_DEL_START = 205;     // 93f thinking pause after cursor arrives
const TITLE_DEL_END = 233;       // 28f for 36 chars ≈ 1.29 chars/f (deliberate)
const TITLE_TYPE_START = 253;    // 20f pause — beat before rewriting
const TITLE_TYPE_END = 288;      // 35f for 46 chars ≈ 1.31 chars/f (deliberate)
const TITLE_ZOOM_OUT_START = 303; // 15f hold on finished title before zoom-out
// Post-zoom: summary block types fast (zoom settles ~frame 328)
// All sections use ~4 chars/frame; 2f gaps between sections (no intermittent pauses)
const SL_START = 330, SL_END = 333;   // "Summary" label: 7 chars @ ~3.5 chars/f
const S_FRAMES = [335, 358] as const; // summary content: ~93 chars @ ~4 chars/f
const S_CHARS  = [0, SUMMARY_LEN] as const;
const TAGS_START = 360;               // 4f stagger → all 3 tags by frame 368
const LL_START = 370, LL_END = 373;   // "Learnings" label: 9 chars @ 3 chars/f
const L0_START = 375, L0_END = 393;   // L0: ~72 chars @ 4 chars/f
const L1_START = 395, L1_END = 418;   // L1: ~94 chars @ ~4 chars/f
const QL_START = 420, QL_END = 425;   // "Questions answered": 18 chars @ 3.6 chars/f
const Q0_START = 427, Q0_END = 448;   // Q0: ~82 chars @ ~4 chars/f
// scene fade
const FADE_START = 458;
const FADE_END = 478;

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
  title: RAW_TITLE,
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

// Figma cursor entry position (detail-div coords — right side, mid-height)
const POS_ENTER = {x: 1370, y: 250} as const;

// ── CSS injected into .enrich-animated ───────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function measureTitleText(text: string): number {
  return measureText({
    text,
    fontFamily: 'Google Sans Flex',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: '-0.72px',
    validateFontIsLoaded: false,
  }).width;
}

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

// Figma-style AI cursor. labelOpacity controls the "Qwen3-1.7B" pill separately
// from the arrow so we can show the arrow first (blink), then reveal the label.
const FigmaCursor: React.FC<{
  x: number; y: number; opacity: number; labelOpacity: number;
}> = ({x, y, opacity, labelOpacity}) => (
  <div style={{
    position: 'absolute', left: x, top: y, opacity, pointerEvents: 'none',
    filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.3))',
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
      fontFamily: 'Google Sans Flex, system-ui, sans-serif',
      lineHeight: 1.3,
      opacity: labelOpacity,
    }}>
      Qwen3-1.7B (local)
    </div>
  </div>
);

// ── Main scene ────────────────────────────────────────────────────────────────
export const EnrichDetail: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // Pre-measure the raw title end position (for cursor entry target)
  const rawTitleEndX = useMemo(() => TEXT_BLOCK_LEFT + measureTitleText(RAW_TITLE), []);

  // ── Scene opacity ────────────────────────────────────────────────────────────
  const sceneOpacity = 1;

  // ── Browser cursor ──────────────────────────────────────────────────────────
  const cursorMoveSp = spring({frame: frame - 8, fps,
    config: {damping: 22, stiffness: 130, mass: 1, overshootClamping: true}});
  const cursorX = interpolate(cursorMoveSp, [0, 1], [961, 220]);
  const cursorY = interpolate(cursorMoveSp, [0, 1], [153, 545]);
  const clickProgress = interpolate(frame, [35, 43], [0, 1], CLAMP);
  const cursorScale = interpolate(clickProgress, [0, 0.35, 1], [1, 0.82, 1]);
  const cursorOpacity = interpolate(frame, [0, 75, 90], [1, 1, 0], CLAMP);

  // ── Sessions phase ──────────────────────────────────────────────────────────
  const sessionsOpacity = interpolate(frame, [43, 63], [1, 0], CLAMP);
  const sessionsScale = interpolate(frame, [43, 65], [1, 1.04], CLAMP);
  const titleHovered = frame >= 30 && frame < 55;

  // ── Detail phase ────────────────────────────────────────────────────────────
  const detailOpacity = interpolate(frame, [55, 76], [0, 1], CLAMP);
  const detailScaleSp = spring({frame: frame - 55, fps, config: SPRING_SNAPPY});
  const detailScale = interpolate(detailScaleSp, [0, 1], [0.97, 1]);

  // ── Title zoom in/out ────────────────────────────────────────────────────────
  const titleZoomInSp  = Math.min(1, spring({frame: frame - TITLE_ZOOM_IN_FRAME, fps,
    config: {damping: 26, stiffness: 80, overshootClamping: true}}));
  const titleZoomOutSp = Math.min(1, spring({frame: frame - TITLE_ZOOM_OUT_START, fps,
    config: {damping: 26, stiffness: 80, overshootClamping: true}}));
  const titleZoomLevel = Math.max(0, titleZoomInSp - titleZoomOutSp);
  const zoomScale = detailScale * (1 + (TITLE_ZOOM_SCALE - 1) * titleZoomLevel);
  const totalTx = TITLE_TX * titleZoomLevel;
  const totalTy = TITLE_TY * titleZoomLevel;

  // ── Title delete / retype ────────────────────────────────────────────────────
  const rawDelChars = Math.round(
    interpolate(frame, [TITLE_DEL_START, TITLE_DEL_END], [RAW_TITLE_LEN, 0], CLAMP),
  );
  const titleTypeChars = Math.round(
    interpolate(frame, [TITLE_TYPE_START, TITLE_TYPE_END], [0, SESSION_TITLE_LEN], CLAMP),
  );

  // isTitleBlinking: the "thinking" phase — cursor blinks at end of raw title before deletion
  const isTitleBlinking = frame >= BLINK_START && frame < TITLE_DEL_START;
  const isTitleDeleting = frame >= TITLE_DEL_START && frame < TITLE_DEL_END + 3;
  const isTitleTyping   = frame >= TITLE_TYPE_START && frame < TITLE_TYPE_END + 3;

  // ── Summary label typing ─────────────────────────────────────────────────────
  const summLabelChars = Math.round(
    interpolate(frame, [SL_START, SL_END], [0, 7], CLAMP),
  );
  const typedSummLabel = 'Summary'.substring(0, summLabelChars);
  const isSummLabelTyping = frame >= SL_START && frame < SL_END + 3;

  // ── Summary content typing ───────────────────────────────────────────────────
  const summaryChars = interpolate(frame, [...S_FRAMES], [...S_CHARS], CLAMP);
  const typedSummary = SESSION_SUMMARY.substring(0, Math.round(summaryChars));
  const isSummaryTyping = frame >= S_FRAMES[0] && frame < S_FRAMES[S_FRAMES.length - 1] + 3;

  // ── Post-zoom typing (learnings, questions) ──────────────────────────────────
  const L0_LEN = SESSION_LEARNINGS[0].length;
  const L1_LEN = SESSION_LEARNINGS[1].length;
  const Q0_LEN = SESSION_QUESTIONS[0].length;

  const learn0Chars = interpolate(frame, [L0_START, L0_END], [0, L0_LEN], CLAMP);
  const learn1Chars = interpolate(frame, [L1_START, L1_END], [0, L1_LEN], CLAMP);
  const q0Chars     = interpolate(frame, [Q0_START, Q0_END], [0, Q0_LEN], CLAMP);

  const typedLearn0 = SESSION_LEARNINGS[0].substring(0, Math.round(learn0Chars));
  const typedLearn1 = SESSION_LEARNINGS[1].substring(0, Math.round(learn1Chars));
  const typedQ0     = SESSION_QUESTIONS[0].substring(0, Math.round(q0Chars));

  const isLearn0Typing = frame >= L0_START && frame < L0_END + 3;
  const isLearn1Typing = frame >= L1_START && frame < L1_END + 3;
  const isQ0Typing     = frame >= Q0_START && frame < Q0_END + 3;

  const learnLabelChars = Math.round(interpolate(frame, [LL_START, LL_END], [0, 9], CLAMP));
  const questLabelChars = Math.round(interpolate(frame, [QL_START, QL_END], [0, 18], CLAMP));
  const typedLearnLabel = 'Learnings'.substring(0, learnLabelChars);
  const typedQuestLabel = 'Questions answered'.substring(0, questLabelChars);
  const isLearnLabelTyping = frame >= LL_START && frame < LL_END + 3;
  const isQuestLabelTyping = frame >= QL_START && frame < QL_END + 3;

  // ── Cursor blink ─────────────────────────────────────────────────────────────
  const anyTyping = (
    isTitleBlinking || isTitleDeleting || isTitleTyping ||
    isSummLabelTyping || isSummaryTyping ||
    isLearnLabelTyping || isLearn0Typing || isLearn1Typing ||
    isQuestLabelTyping || isQ0Typing
  );
  const showCursor = anyTyping && cursorBlink(frame, 10);
  const blinkChar = showCursor ? '|' : '';
  // Blue cursor span — used in title node; summary/learnings already blue via CSS
  const BlueCursor = showCursor
    ? <span style={{color: '#0062a8', fontWeight: 400}}>|</span>
    : null;

  // ── Display title: raw (blinking) → deleting → pause → typing → enriched ────
  // displayTitle (string) is passed as the `title` prop fallback; titleNode overrides rendering.
  let displayTitle: string;
  if (frame < TITLE_DEL_START) {
    displayTitle = RAW_TITLE + blinkChar;
  } else if (frame <= TITLE_DEL_END + 3) {
    displayTitle = (RAW_TITLE.substring(0, rawDelChars) + blinkChar) || '\u00a0';
  } else if (frame < TITLE_TYPE_START) {
    displayTitle = blinkChar || '\u00a0';
  } else if (frame <= TITLE_TYPE_END + 3) {
    displayTitle = (SESSION_TITLE.substring(0, titleTypeChars) + blinkChar) || '\u00a0';
  } else {
    displayTitle = SESSION_TITLE;
  }

  // ── Title node: blue cursor + blue rewrite text ───────────────────────────────
  let displayTitleNode: React.ReactNode;
  if (frame < TITLE_DEL_START) {
    // Thinking/blink: raw title in default color, blue cursor
    displayTitleNode = <>{RAW_TITLE}{BlueCursor}</>;
  } else if (frame <= TITLE_DEL_END + 3) {
    // Deletion: shrinking raw text + blue cursor
    const text = RAW_TITLE.substring(0, rawDelChars);
    displayTitleNode = <>{text || '\u00a0'}{BlueCursor}</>;
  } else if (frame < TITLE_TYPE_START) {
    // Gap: only blue cursor (or nbsp to prevent "(untitled)")
    displayTitleNode = BlueCursor ?? '\u00a0';
  } else if (frame <= TITLE_TYPE_END + 3) {
    // Rewrite: blue text + blue cursor
    const typed = SESSION_TITLE.substring(0, titleTypeChars);
    displayTitleNode = typed
      ? <><span style={{color: '#0062a8'}}>{typed}</span>{BlueCursor}</>
      : (BlueCursor ?? '\u00a0');
  } else {
    // Enriched title stays blue
    displayTitleNode = <span style={{color: '#0062a8'}}>{SESSION_TITLE}</span>;
  }

  // ── Display typed summary / learnings / questions ────────────────────────────
  const summLabelDisplay = typedSummLabel + (isSummLabelTyping ? blinkChar : '');
  const displaySummary = isSummaryTyping ? typedSummary + blinkChar : typedSummary;

  const displayLearnings: string[] = [];
  if (learn0Chars > 0) displayLearnings.push(typedLearn0 + (isLearn0Typing ? blinkChar : ''));
  if (learn1Chars > 0) displayLearnings.push(typedLearn1 + (isLearn1Typing ? blinkChar : ''));

  const displayQuestions: string[] = [];
  if (q0Chars > 0) displayQuestions.push(typedQ0 + (isQ0Typing ? blinkChar : ''));

  const typedLearnLabelDisplay = typedLearnLabel + (isLearnLabelTyping ? blinkChar : '');
  const typedQuestLabelDisplay = typedQuestLabel + (isQuestLabelTyping ? blinkChar : '');

  // ── Tags reveal ──────────────────────────────────────────────────────────────
  const tagCount = frame >= TAGS_START
    ? Math.min(SESSION_TAGS.length, Math.ceil((frame - TAGS_START) / 4))
    : 0;
  const displayTags = SESSION_TAGS.slice(0, tagCount);

  // ── Figma cursor ─────────────────────────────────────────────────────────────
  // Entry: spring from POS_ENTER → end of RAW_TITLE
  const spEnter = spring({frame: frame - 90, fps,
    config: {damping: 18, stiffness: 100, overshootClamping: true}});
  const figmaEntryX = interpolate(spEnter, [0, 1], [POS_ENTER.x, rawTitleEndX]);
  const figmaEntryY = interpolate(spEnter, [0, 1], [POS_ENTER.y, TITLE_BOTTOM_Y]);

  // Cursor tracks deletion/typing in title phase
  let figmaX: number;
  let figmaY: number;

  if (frame < TITLE_DEL_START) {
    // Entry + blink: at end of full RAW_TITLE
    figmaX = figmaEntryX;
    figmaY = figmaEntryY;
  } else if (frame <= TITLE_DEL_END) {
    // Delete phase: cursor retreats left with remaining text
    figmaX = TEXT_BLOCK_LEFT + measureTitleText(RAW_TITLE.substring(0, rawDelChars));
    figmaY = TITLE_BOTTOM_Y;
  } else if (frame < TITLE_TYPE_START) {
    // Gap: cursor at left edge of title
    figmaX = TEXT_BLOCK_LEFT;
    figmaY = TITLE_BOTTOM_Y;
  } else if (frame <= TITLE_TYPE_END) {
    // Type phase: cursor advances right
    figmaX = TEXT_BLOCK_LEFT + measureTitleText(SESSION_TITLE.substring(0, titleTypeChars));
    figmaY = TITLE_BOTTOM_Y;
  } else {
    // Hold: cursor at end of new enriched title
    figmaX = TEXT_BLOCK_LEFT + measureTitleText(SESSION_TITLE);
    figmaY = TITLE_BOTTOM_Y;
  }

  // Figma cursor opacity: enters at 90, fades on zoom-out
  const figmaOpacity = interpolate(
    frame,
    [90, 110, TITLE_ZOOM_OUT_START, TITLE_ZOOM_OUT_START + 20],
    [0, 1, 1, 0],
    CLAMP,
  );

  // Label appears with the cursor (no separate delay — cursor enters with label)
  const figmaLabelOpacity = figmaOpacity;

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

            {/* ── Phase 2: Session detail (title zoom) ── */}
            {/*
              FigmaCursor lives INSIDE this div — same coordinate space as the title.
              Zoom: translate(tx,ty) scale(s) at transformOrigin:'top left'
              TITLE_TX/TY pan so the title row is centred in the zoomed view.
            */}
            <div style={{
              position: 'absolute', inset: 0,
              opacity: detailOpacity,
              transform: `translate(${totalTx}px, ${totalTy}px) scale(${zoomScale})`,
              transformOrigin: 'top left',
              background: '#ffffff', overflowY: 'hidden',
              padding: '16px 28px 20px',
            }}>
              <div style={{maxWidth: 860, margin: '0 auto', width: '100%'}}>

                <SessionDetailHeader title={displayTitle} titleNode={displayTitleNode} />
                <SessionDetailMeta
                  id={SESSION_ID}
                  project={SESSION_PROJECT}
                  date={SESSION_DATE}
                  turnCount={MOCK_TURNS.length}
                />

                {/* EnrichBlock area — typed summary above, tags/learnings/questions below */}
                <div className="enrich-animated">
                  <style>{ENRICH_ANIMATED_CSS}</style>

                  {/* Custom typed summary section */}
                  {summLabelChars > 0 && (
                    <div className="summary-block" style={{paddingBottom: 0, marginBottom: 0}}>
                      <div className="summary-block-section">
                        <span className="summary-block-label">{summLabelDisplay}</span>
                        {displaySummary && <p style={{marginTop: 4}}>{displaySummary}</p>}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {displayTags.length > 0 && (
                    <div className="summary-block-tags">
                      {displayTags.map((t, i) => (
                        <span key={i} className="enrich-tag">{t}</span>
                      ))}
                    </div>
                  )}

                  {/* Learnings */}
                  {learnLabelChars > 0 && (
                    <div className="summary-block-section" style={{marginTop: 12}}>
                      <span className="summary-block-label">{typedLearnLabelDisplay}</span>
                      {displayLearnings.length > 0 && (
                        <ul className="summary-block-list">
                          {displayLearnings.map((l, i) => <li key={i}>{l}</li>)}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Questions */}
                  {questLabelChars > 0 && (
                    <div className="summary-block-section" style={{marginTop: 12}}>
                      <span className="summary-block-label">{typedQuestLabelDisplay}</span>
                      {displayQuestions.length > 0 && (
                        <ul className="summary-block-list">
                          {displayQuestions.map((q, i) => <li key={i}>{q}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <div style={{marginTop: 40}}>
                  <SessionTurns turns={MOCK_TURNS} />
                </div>

              </div>

              {/* Figma cursor — inside zoomed div, tracks title text */}
              <FigmaCursor
                x={figmaX}
                y={figmaY}
                opacity={figmaOpacity}
                labelOpacity={figmaLabelOpacity}
              />

            </div>
          </div>
        </div>
      </div>

      {/* Browser mouse cursor — screen coords (outside zoomed div) */}
      <MouseCursor x={cursorX} y={cursorY} scale={cursorScale} opacity={cursorOpacity} />
    </AbsoluteFill>
  );
};
