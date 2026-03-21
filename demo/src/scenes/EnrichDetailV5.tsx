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
import {EnrichBlock} from '../../../ui-react/src/components/EnrichBlock/EnrichBlock';
import {
  HEATMAP_BYPROJECT_BREAKDOWN,
  HEATMAP_BY_PROJECT,
  PROJECTS,
} from '../data/index';

// ── Timeline ──────────────────────────────────────────────────────────────────
//   0–  8f:  fade in
//   8– 35f:  browser cursor moves to session title
//  30– 43f:  hover effect
//  35– 43f:  click pulse
//  43– 65f:  sessions fade out
//  55– 78f:  detail fades in
//  78– 90f:  browser cursor fades out
//  90–112f:  Figma cursor slides in (arrow only, no label)
// 112–157f:  cursor blinks 3× — "thinking" / model loading
// 157–164f:  "Qwen3-1.7B (local)" label fades in
//            zoom-in spring also starts at 112
// 164–172f:  "Summary" label typed (7 chars)
// 172–175f:  brief gap
// 175–280f:  summary content types out with viewport pan following cursor
//   Burst 1: 175–205 (30f, ~90 chars = 3/f)
//   Pause:   205–215 (10f)
//   Burst 2: 215–250 (35f, ~90 chars ≈ 2.6/f)
//   Pause:   250–260 (10f)
//   Burst 3: 260–280 (20f, remaining chars)
// 280–305f:  zoom-out spring; Figma cursor fades out
// 308–326f:  tags appear (6f stagger)
// 326–345f:  Learning[0] types
// 345–358f:  hesitation
// 358–381f:  Learning[1] types
// 381–395f:  hesitation/cursor moves
// 395–413f:  Question[0] types
// 413–425f:  hold
// 425–445f:  scene fade out

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
const SUMMARY_LEN = SESSION_SUMMARY.length;

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

// ── Layout constants (content-div coords, 1200×598px) ─────────────────────────
// TEXT_BLOCK_LEFT: left edge of text inside the detail div
//   = detail-padding-left(28) + centering-offset((1200-56-860)/2=142) = 170px
// ENRICH_Y: content-div y where EnrichBlock starts
//   ≈ detail-padding-top(16) + header(29+24) + meta(22+24) = 115 → calibrated 118
// SUMMARY_LABEL_Y: y of the "Summary" label = ENRICH_Y + summary-block padding-top(14)
// SUMMARY_TEXT_Y: y of summary <p> = SUMMARY_LABEL_Y + label-height(15) + p-margin(4)
const TEXT_BLOCK_LEFT = 170;
const TEXT_BLOCK_WIDTH = 860;
const TEXT_LINE_HEIGHT = 20; // 12.5px × 1.6
const ENRICH_Y = 118;
const SUMMARY_LABEL_Y = 132; // ENRICH_Y + 14
const SUMMARY_TEXT_Y = 151;  // SUMMARY_LABEL_Y + 15 + 4

// Zoom pan: translate(tx, ty) scale(2.5) with transformOrigin top-left
// matches original transformOrigin:'15% 18%' at these values:
//   tx = 180 × (1 - 2.5) = -270,  ty = 107.6 × (1 - 2.5) = -161
const ZOOM_SCALE = 2.5;
const INITIAL_TX = -270;
const INITIAL_TY = -161;
const RIGHT_SCREEN_MARGIN = 1050; // keep cursor left of this screen x during pan

// ── Timing constants ──────────────────────────────────────────────────────────
const ZOOM_IN_FRAME = 112;
const BLINK_START = 112;
const BLINK_END = 157;
const LABEL_SHOW_START = 157;
const LABEL_SHOW_END = 164;
const LABEL_TYPE_START = 164;
const LABEL_TYPE_END = 172;
const CONTENT_TYPE_START = 175;
const S_FRAMES = [175, 205, 215, 250, 260, 280] as const;
const S_CHARS  = [0,    90,  90,  180, 180, SUMMARY_LEN] as const;
const ZOOM_OUT_START = 280;
const TAGS_START = 308;
const L0_START = 326, L0_END = 345;
const L1_START = 358, L1_END = 381;
const Q0_START = 395, Q0_END = 413;

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

// Figma cursor entry/click positions (content-div coords)
const POS_ENTER = {x: 1370, y: 250} as const;
const POS_CLICK = {x: 172,  y: 118} as const;

// ── CSS injected into .enrich-animated ───────────────────────────────────────
// Colors everything in the EnrichBlock blue while typing; we hide the built-in
// Summary label (rendering our own typed one above) but leave Learnings/Questions labels.
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

// ── Text position computation ─────────────────────────────────────────────────
// Simulates CSS word-wrap and computes cursor (x, y) in text-relative coords
// for every character index 0..text.length.  Runs once in useMemo.
// Returns positions in px relative to (TEXT_BLOCK_LEFT, SUMMARY_TEXT_Y).
function buildCharPositions(
  text: string,
  maxWidth: number,
  fontFamily: string,
  fontSize: number,
  fontWeight: string,
  lineHeight: number,
): Array<{x: number; y: number}> {
  const m = (t: string) =>
    measureText({text: t, fontFamily, fontSize, fontWeight, validateFontIsLoaded: false}).width;

  // Step 1: find char indices where each line starts (word-wrap simulation)
  const words = text.split(' ');
  const wordStarts: number[] = [];
  let pos = 0;
  for (const w of words) { wordStarts.push(pos); pos += w.length + 1; }

  const lineBreaks: number[] = [0]; // char indices where lines start
  let currentLine = '';
  for (let wi = 0; wi < words.length; wi++) {
    const testLine = currentLine ? currentLine + ' ' + words[wi] : words[wi];
    if (m(testLine) > maxWidth && currentLine) {
      lineBreaks.push(wordStarts[wi]);
      currentLine = words[wi];
    } else {
      currentLine = testLine;
    }
  }

  // Step 2: for each char, find its line and x offset
  const positions: Array<{x: number; y: number}> = [];
  for (let ci = 0; ci <= text.length; ci++) {
    // Find the last lineBreak ≤ ci
    let lineIdx = 0;
    for (let li = lineBreaks.length - 1; li >= 0; li--) {
      if (ci >= lineBreaks[li]) { lineIdx = li; break; }
    }
    const textOnLine = text.substring(lineBreaks[lineIdx], ci);
    positions.push({
      x: textOnLine.length > 0 ? m(textOnLine) : 0,
      y: lineIdx * lineHeight,
    });
  }
  return positions;
}

// ── Viewport pan spring simulation ───────────────────────────────────────────
// Pre-computes cursorPanX[i] (additional leftward pan on top of INITIAL_TX) for
// each frame offset from CONTENT_TYPE_START.  Uses a spring that:
//   - tracks the cursor rightward within each line
//   - hard-resets to 0 on line wrap so the start of new lines is always visible
//   - springs back to 0 during zoom-out phase (frame > ZOOM_OUT_START)
function buildTxCurve(
  positions: Array<{x: number; y: number}>,
): number[] {
  const TOTAL = 250; // frames from CONTENT_TYPE_START (covers typing + zoom-out settling)
  const result = new Array(TOTAL).fill(0);
  let panX = 0;
  let vel = 0;
  const K = 0.12; // spring constant (controls follow lag)
  const D = 0.76; // damping (prevents overshoot during tracking)
  let prevLineIdx = 0;

  for (let i = 0; i < TOTAL; i++) {
    const f = CONTENT_TYPE_START + i;
    const chars = Math.min(
      Math.round(interpolate(f, [...S_FRAMES], [...S_CHARS], CLAMP)),
      positions.length - 1,
    );
    const pos = positions[chars];
    const lineIdx = Math.round(pos.y / TEXT_LINE_HEIGHT);
    const cursorContentX = TEXT_BLOCK_LEFT + pos.x;

    // On line wrap: hard-reset pan so the new line's start is immediately visible
    const isLineWrap = lineIdx > prevLineIdx;
    prevLineIdx = lineIdx;
    if (isLineWrap) { panX = 0; vel = 0; }

    // Target: keep cursor ≤ RIGHT_SCREEN_MARGIN on screen.
    // After ZOOM_OUT_START, spring back to 0 (pan disappears with zoom).
    const targetPanX = f > ZOOM_OUT_START
      ? 0
      : Math.min(0, RIGHT_SCREEN_MARGIN - INITIAL_TX - cursorContentX * ZOOM_SCALE);

    vel = (vel + (targetPanX - panX) * K) * D;
    panX += vel;
    result[i] = panX;
  }
  return result;
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

// Figma-style AI cursor. labelOpacity controls the "Qwen3-1.7B" pill separately
// from the arrow so we can show the arrow first (blink), then reveal the label.
const FigmaCursor: React.FC<{
  x: number; y: number; opacity: number; labelOpacity: number; clickScale?: number;
}> = ({x, y, opacity, labelOpacity, clickScale = 1}) => (
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
      opacity: labelOpacity,
    }}>
      Qwen3-1.7B (local)
    </div>
  </div>
);

const ClickRipple: React.FC<{x: number; y: number; scale: number; opacity: number}> = ({
  x, y, scale, opacity,
}) => (
  <div style={{
    position: 'absolute', left: x - 14, top: y - 14,
    width: 28, height: 28, borderRadius: '50%',
    border: '1.5px solid rgba(0,98,168,0.9)',
    transform: `scale(${scale})`, opacity, pointerEvents: 'none',
  }} />
);

// ── Main scene ────────────────────────────────────────────────────────────────
export const EnrichDetailV5: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // ── One-time text measurement (useMemo, fonts guaranteed loaded by Remotion) ─
  const {positions, labelEndWidth, txCurve} = useMemo(() => {
    const positions = buildCharPositions(
      SESSION_SUMMARY, TEXT_BLOCK_WIDTH,
      'Google Sans Flex', 12.5, '400', TEXT_LINE_HEIGHT,
    );
    // Width of "SUMMARY" (7 chars, uppercase, weight 600, letter-spacing 0.06em)
    // Used to spring FigmaCursor from label end to content start.
    const labelEndWidth = measureText({
      text: 'SUMMARY', fontFamily: 'Google Sans Flex',
      fontSize: 12.5, fontWeight: '600', letterSpacing: '0.75px',
      validateFontIsLoaded: false,
    }).width;
    const txCurve = buildTxCurve(positions);
    return {positions, labelEndWidth, txCurve};
  }, []);

  // ── Scene opacity ────────────────────────────────────────────────────────────
  const sceneOpacity = interpolate(frame, [0, 8, 425, 445], [0, 1, 1, 0], CLAMP);

  // ── Browser cursor ──────────────────────────────────────────────────────────
  const cursorMoveSp = spring({frame: frame - 8, fps,
    config: {damping: 22, stiffness: 130, mass: 1, overshootClamping: true}});
  const cursorX = interpolate(cursorMoveSp, [0, 1], [961, 220]);
  const cursorY = interpolate(cursorMoveSp, [0, 1], [153, 545]);
  const clickProgress = interpolate(frame, [35, 43], [0, 1], CLAMP);
  const cursorScale = interpolate(clickProgress, [0, 0.35, 1], [1, 0.82, 1]);
  const cursorOpacity = interpolate(frame, [0, 8, 75, 90], [0, 1, 1, 0], CLAMP);

  // ── Sessions phase ──────────────────────────────────────────────────────────
  const sessionsOpacity = interpolate(frame, [43, 63], [1, 0], CLAMP);
  const sessionsScale = interpolate(frame, [43, 65], [1, 1.04], CLAMP);
  const titleHovered = frame >= 30 && frame < 55;

  // ── Detail phase ────────────────────────────────────────────────────────────
  const detailOpacity = interpolate(frame, [55, 76], [0, 1], CLAMP);
  const detailScaleSp = spring({frame: frame - 55, fps, config: SPRING_SNAPPY});
  const detailScale = interpolate(detailScaleSp, [0, 1], [0.97, 1]);

  // ── Zoom in/out ─────────────────────────────────────────────────────────────
  // zoomLevel 0→1 on zoom-in, 1→0 on zoom-out.
  // translate(tx, ty) scale(zoomScale) with transformOrigin:'top left'
  // reproduces the original transformOrigin:'15% 18%' behavior at zoomLevel=1.
  const zoomInSp  = Math.min(1, spring({frame: frame - ZOOM_IN_FRAME, fps,
    config: {damping: 26, stiffness: 80, overshootClamping: true}}));
  const zoomOutSp = Math.min(1, spring({frame: frame - ZOOM_OUT_START, fps,
    config: {damping: 26, stiffness: 80, overshootClamping: true}}));
  const zoomLevel = Math.max(0, zoomInSp - zoomOutSp);
  const zoomScale = detailScale * (1 + (ZOOM_SCALE - 1) * zoomLevel);

  // Viewport pan: cursorPanX is the additional leftward pan to keep cursor visible.
  // Comes from precomputed spring simulation; 0 outside typing phase.
  const txOffset = frame >= CONTENT_TYPE_START
    ? (txCurve[Math.min(frame - CONTENT_TYPE_START, txCurve.length - 1)] ?? 0)
    : 0;
  const totalTx = (INITIAL_TX + txOffset) * zoomLevel;
  const totalTy = INITIAL_TY * zoomLevel;

  // ── Summary label typing ────────────────────────────────────────────────────
  // "Summary" renders as "SUMMARY" via CSS text-transform: uppercase
  const labelChars = Math.round(
    interpolate(frame, [LABEL_TYPE_START, LABEL_TYPE_END], [0, 7], CLAMP),
  );
  const typedLabel = 'Summary'.substring(0, labelChars);
  const isLabelTyping = frame >= LABEL_TYPE_START && frame < LABEL_TYPE_END + 3;

  // Label cursor x (for FigmaCursor position tracking during label phase):
  // Measure the uppercase prefix since that's what renders.
  const labelCursorX = labelChars > 0
    ? measureText({
        text: 'SUMMARY'.substring(0, labelChars),
        fontFamily: 'Google Sans Flex', fontSize: 12.5, fontWeight: '600',
        letterSpacing: '0.75px', validateFontIsLoaded: false,
      }).width
    : 0;

  // ── Summary content typing ──────────────────────────────────────────────────
  const summaryChars = interpolate(frame, [...S_FRAMES], [...S_CHARS], CLAMP);
  const charIdx = Math.min(Math.round(summaryChars), positions.length - 1);
  const contentCursorPos = positions[charIdx];
  const typedSummary = SESSION_SUMMARY.substring(0, Math.round(summaryChars));
  const isSummaryTyping = frame >= S_FRAMES[0] && frame < S_FRAMES[S_FRAMES.length - 1] + 3;

  // ── Post-zoom typing (learnings, questions) ─────────────────────────────────
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

  // ── Cursor blink character ───────────────────────────────────────────────────
  const anyTyping = isSummaryTyping || isLabelTyping || isLearn0Typing || isLearn1Typing || isQ0Typing;
  const blinkChar = anyTyping && cursorBlink(frame, 10) ? '|' : '';

  const typedLabelDisplay = isLabelTyping ? typedLabel + blinkChar : typedLabel;
  const displaySummary = isSummaryTyping ? typedSummary + blinkChar : typedSummary;

  const displayLearnings: string[] = [];
  if (learn0Chars > 0) displayLearnings.push(typedLearn0 + (isLearn0Typing ? blinkChar : ''));
  if (learn1Chars > 0) displayLearnings.push(typedLearn1 + (isLearn1Typing ? blinkChar : ''));

  const displayQuestions: string[] = [];
  if (q0Chars > 0) displayQuestions.push(typedQ0 + (isQ0Typing ? blinkChar : ''));

  // ── Tags reveal ─────────────────────────────────────────────────────────────
  const tagCount = frame >= TAGS_START
    ? Math.min(SESSION_TAGS.length, Math.ceil((frame - TAGS_START) / 6))
    : 0;
  const displayTags = SESSION_TAGS.slice(0, tagCount);

  // ── Figma cursor ────────────────────────────────────────────────────────────
  // Entry: spring from POS_ENTER → POS_CLICK (same as before)
  const spEnter = spring({frame: frame - 90, fps,
    config: {damping: 18, stiffness: 100, overshootClamping: true}});
  const figmaEntryX = interpolate(spEnter, [0, 1], [POS_ENTER.x, POS_CLICK.x]);
  const figmaEntryY = interpolate(spEnter, [0, 1], [POS_ENTER.y, POS_CLICK.y]);

  // Blink phase: oscillate opacity to signal "thinking"
  const isBlinkPhase = frame >= BLINK_START && frame < BLINK_END;
  const blinkAlpha = isBlinkPhase ? (cursorBlink(frame, 15) ? 1.0 : 0.12) : 1.0;

  // Figma cursor position: entry → click → label tracking → content tracking
  let figmaX: number;
  let figmaY: number;
  if (frame < LABEL_TYPE_START) {
    // Entry + blink phase: at POS_CLICK (after entry spring settles)
    figmaX = figmaEntryX;
    figmaY = figmaEntryY;
  } else if (frame < CONTENT_TYPE_START) {
    // Label typing phase: track end of typed label text
    figmaX = TEXT_BLOCK_LEFT + labelCursorX;
    figmaY = SUMMARY_LABEL_Y;
  } else {
    // Content typing phase: track end of typed summary text
    figmaX = TEXT_BLOCK_LEFT + contentCursorPos.x;
    figmaY = SUMMARY_TEXT_Y + contentCursorPos.y;
  }

  // FigmaCursor overall opacity (enter → hold → fade on zoom-out)
  const figmaBaseOpacity =
    interpolate(frame, [90, 110, ZOOM_OUT_START, ZOOM_OUT_START + 30], [0, 1, 1, 0], CLAMP);
  const figmaOpacity = figmaBaseOpacity * blinkAlpha;

  // Label pill fades in after blink phase ends
  const figmaLabelOpacity = interpolate(frame, [LABEL_SHOW_START, LABEL_SHOW_END], [0, 1], CLAMP);

  // Click animation at zoom-in trigger frame
  const figmaClickScale = interpolate(frame, [ZOOM_IN_FRAME, ZOOM_IN_FRAME + 3, ZOOM_IN_FRAME + 10], [1, 0.72, 1], CLAMP);
  const rippleProgress   = interpolate(frame, [ZOOM_IN_FRAME, ZOOM_IN_FRAME + 22], [0, 1], CLAMP);
  const rippleScale      = interpolate(rippleProgress, [0, 1], [0.3, 2.4]);
  const rippleOpacity    = interpolate(rippleProgress, [0, 0.2, 1], [0, 0.65, 0]);

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

            {/* ── Phase 2: Session detail (zoomed) ── */}
            {/*
              Architectural note: FigmaCursor lives INSIDE this div so it shares
              the same coordinate space as the text — no coordinate mapping needed.
              Zoom uses translate(tx,ty) scale(s) at transformOrigin:'top left'
              so tx/ty can be animated independently for viewport pan.
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

                <SessionDetailHeader title={SESSION_TITLE} />
                <SessionDetailMeta
                  id={SESSION_ID}
                  project={SESSION_PROJECT}
                  date={SESSION_DATE}
                  turnCount={MOCK_TURNS.length}
                />

                {/* EnrichBlock area — typed summary above, EnrichBlock for tags/learnings/questions */}
                <div className="enrich-animated">
                  <style>{ENRICH_ANIMATED_CSS}</style>

                  {/* Custom typed summary section (replaces EnrichBlock's summary render) */}
                  {frame >= LABEL_TYPE_START && (
                    <div className="summary-block" style={{paddingBottom: 0, marginBottom: 0}}>
                      <div className="summary-block-section">
                        <span className="summary-block-label">{typedLabelDisplay}</span>
                        {displaySummary && <p style={{marginTop: 4}}>{displaySummary}</p>}
                      </div>
                    </div>
                  )}

                  {/* EnrichBlock: tags / learnings / questions only */}
                  <EnrichBlock
                    summary={undefined}
                    tags={displayTags.length ? displayTags : undefined}
                    learnings={displayLearnings.length ? displayLearnings : undefined}
                    questions={displayQuestions.length ? displayQuestions : undefined}
                    showSummary={false}
                    showTags={displayTags.length > 0}
                    showLearnings={displayLearnings.length > 0}
                    showQuestions={displayQuestions.length > 0}
                  />
                </div>

                <SessionTurns turns={MOCK_TURNS} />

              </div>

              {/* Click ripple at the empty EnrichBlock area */}
              <ClickRipple
                x={POS_CLICK.x} y={POS_CLICK.y}
                scale={rippleScale} opacity={rippleOpacity}
              />

              {/* Figma cursor — lives inside the zoomed div, same coordinate space as text */}
              <FigmaCursor
                x={figmaX}
                y={figmaY}
                opacity={figmaOpacity}
                labelOpacity={figmaLabelOpacity}
                clickScale={figmaClickScale}
              />

            </div>
          </div>
        </div>
      </div>

      {/* Browser mouse cursor — stays in screen coords (outside zoomed div) */}
      <MouseCursor x={cursorX} y={cursorY} scale={cursorScale} opacity={cursorOpacity} />
    </AbsoluteFill>
  );
};
