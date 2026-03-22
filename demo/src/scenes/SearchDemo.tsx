import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {measureText} from '@remotion/layout-utils';
import {theme} from '../theme';
import {
  CLAMP,
  SPRING_SNAPPY,
  getTyped,
  remotionCSSAnimVars,
  REMOTION_ANIM_OVERRIDES,
} from '../animUtils';
import {
  SessionDetailHeader,
  SessionDetailMeta,
  SessionTurns,
} from '../../../ui-react/src/sections/SessionDetailSection';
import {SessionsSection} from '../../../ui-react/src/sections/SessionsSection';
import {NavBar} from '../../../ui-react/src/components/NavBar/NavBar';
import {MouseCursor} from '../components/MouseCursor';
import {TrafficDots} from '../components/TrafficDots';
import {TerminalWindow} from '../components/TerminalWindow';
import {QrecLogo} from '../components/QrecLogo';
import {ClawdMascot} from '../components/ClawdMascot';
import {SEARCH_RESULTS} from '../data/index';
import {
  SESSION_ID,
  SESSION_TITLE,
  SESSION_PROJECT,
  SESSION_DATE,
  SESSION_SUMMARY,
  SESSION_TAGS,
  SESSION_LEARNINGS,
  SESSION_QUESTIONS,
  MOCK_TURNS,
  ENRICH_ANIMATED_CSS,
} from '../data/sessionC0ffee04';

// ── Timeline ──────────────────────────────────────────────────────────────────
//   0– 12f:  fade in — browser with session detail + NavBar (activeTab="dashboard")
//  12– 40f:  scroll-up: browser content translateY spring -50px → 0 (NavBar reveals)
//  40– 78f:  MouseCursor spring-moves to "Search" nav button
//  72– 82f:  click: cursor scale dip (0.82), activeTab switches at frame 78
//  82–105f:  session detail fades out; SessionsSection empty state fades in
// 105–135f:  split animation: browser narrows left, terminal slides in from right
//            (terminal panel visible but empty — shows open terminal)
// 135–175f:  BOTH sides type simultaneously:
//            browser bar types "archive JSONL" (13 chars @ 1.4/f → done ~145f)
//            terminal types full CLI command (40 chars over 40f → done 175f)
// 175–215f:  results appear progressively in both panels:
//            card 0 + terminal result 0 at 175f
//            card 1 + terminal result 1 at 195f
//            card 2 + terminal result 2 at 215f
// 215–270f:  hold on completed dual view
// 270–290f:  fade out

// ── Session data (same session as EnrichDetail — imported from data/sessionC0ffee04)

// ── Search results ────────────────────────────────────────────────────────────
const SEARCH_QUERY = 'archive JSONL';
const RESULTS = SEARCH_RESULTS['archive JSONL'];
const SEARCH_LATENCY = {bm25Ms: 1.2, embedMs: 0, knnMs: 3.8, fusionMs: 0.4, totalMs: 5.4};

// ── Hand-drawn underline for "Archive JSONL" in first search result ───────────
const UL_TEXT = 'Archive JSONL';
const UL_W = measureText({
  text: UL_TEXT,
  fontFamily: 'Google Sans Flex',
  fontSize: 18,
  fontWeight: '500',
  validateFontIsLoaded: false,
}).width;
// Two-hump wavy path — hand-drawn feel
const UL_PATH = `M 1,2 C ${UL_W*0.15},-1 ${UL_W*0.35},3.5 ${UL_W*0.5},1.5 C ${UL_W*0.65},-0.5 ${UL_W*0.85},3 ${UL_W-1},1.5`;
const UL_LEN = UL_W * 1.08; // approximate arc length of the wavy path
const UNDERLINE_START = 183;  // 8f after CARD0_FRAME

// ── Layout constants ──────────────────────────────────────────────────────────
// BROWSER_FULL: width 1200, centered (left 40), top 40, height 640
// BROWSER_SPLIT: left 30, width 600, top 40, height 640
// TERMINAL_SPLIT: left 650, width 600, top 40, height 640

// ── Timing constants ──────────────────────────────────────────────────────────
const SCROLL_START = 12;
const CURSOR_MOVE_START = 40;
const CLICK_START = 72;
const TAB_SWITCH_FRAME = 78;
// Split starts immediately when search UI appears
const SPLIT_START = 105;
// Both sides start typing after split completes
const SEARCH_TYPE_START = 135;
// Terminal typing (same start frame as browser bar)
const T_CMD_START = 135;
const T_CMD_FRAMES = 40;
// Search button click fires when query finishes typing (13 chars @ 1.4/f → frame 145)
const SEARCH_BTN_CLICK_FRAME = 145;
// Results appear after command finishes typing
const T_FOUND_START = 175;  // = T_CMD_START + T_CMD_FRAMES
const CARD0_FRAME = 175;
const T_R0_START = 180;
const CARD1_FRAME = 195;
const T_R1_START = 197;
const CARD2_FRAME = 215;
const T_R2_START = 217;
const FADE_START = 270;
const FADE_END = 290;

// ── Cursor target (measured post-build, placeholder until measured) ───────────
// These coords are in canvas space (1280×720).
// After build: measure via DevTools `[data-nav-search]` getBoundingClientRect.
// Placeholder: ~right side of nav, vertically centered in 50px header.
// Browser left=40, browser top=40, header=50px → header center Y = 40+25 = 65px (canvas)
// NavBar "Search" button: ~right side nav area ≈ x:1050, y:65
const CURSOR_START_X = 961;
const CURSOR_START_Y = 153;
const CURSOR_END_X   = 1052; // measured via DevTools getBoundingClientRect at frame 35
const CURSOR_END_Y   = 106;  // measured via DevTools getBoundingClientRect at frame 35

// ── Main scene ────────────────────────────────────────────────────────────────
export const SearchDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  // ── Scene opacity ────────────────────────────────────────────────────────────
  const sceneOpacity = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    CLAMP,
  );

  // ── Scroll-up animation (NavBar reveals) ────────────────────────────────────
  const scrollSp = spring({frame: frame - SCROLL_START, fps, config: SPRING_SNAPPY});
  const contentTranslateY = interpolate(scrollSp, [0, 1], [-50, 0]);

  // ── Tab state ────────────────────────────────────────────────────────────────
  const activeTab = frame >= TAB_SWITCH_FRAME ? 'search' : 'dashboard';

  // ── Phase visibility ──────────────────────────────────────────────────────────
  const detailOpacity  = interpolate(frame, [82, 105], [1, 0], CLAMP);
  const searchOpacity  = interpolate(frame, [82, 105], [0, 1], CLAMP);

  // ── Search typed query ────────────────────────────────────────────────────────
  const typedQuery = getTyped(SEARCH_QUERY, SEARCH_TYPE_START, frame);

  // ── Progressive card reveal ───────────────────────────────────────────────────
  const revealedCount =
    frame >= CARD2_FRAME ? 3 :
    frame >= CARD1_FRAME ? 2 :
    frame >= CARD0_FRAME ? 1 : 0;

  // Show latency only after first card appears
  const showLatency = frame >= CARD0_FRAME;

  // ── Hand-drawn underline on "Archive JSONL" ───────────────────────────────────
  const underlineSp = spring({
    frame: frame - UNDERLINE_START, fps,
    config: {damping: 26, stiffness: 280, mass: 1, overshootClamping: true},
  });
  const underlineDash = interpolate(underlineSp, [0, 1], [UL_LEN, 0], CLAMP);

  // ── Search button hover + click animation ─────────────────────────────────────
  // Hover state: button lights up 3 frames before click, holds until results appear
  const searchBtnHovered = frame >= SEARCH_BTN_CLICK_FRAME - 3 && frame < CARD0_FRAME;
  // Press: scale dip at click frame (simulates :active — no :active defined in SearchBar.css)
  const searchBtnScale = interpolate(
    frame,
    [SEARCH_BTN_CLICK_FRAME, SEARCH_BTN_CLICK_FRAME + 5, SEARCH_BTN_CLICK_FRAME + 14],
    [1, 0.88, 1],
    CLAMP,
  );

  // ── Mouse cursor ──────────────────────────────────────────────────────────────
  const cursorMoveSp = spring({frame: frame - CURSOR_MOVE_START, fps,
    config: {damping: 22, stiffness: 130, mass: 1, overshootClamping: true}});
  const cursorX = interpolate(cursorMoveSp, [0, 1], [CURSOR_START_X, CURSOR_END_X]);
  const cursorY = interpolate(cursorMoveSp, [0, 1], [CURSOR_START_Y, CURSOR_END_Y]);
  const clickProgress = interpolate(frame, [CLICK_START, CLICK_START + 10], [0, 1], CLAMP);
  const cursorScale = interpolate(clickProgress, [0, 0.35, 1], [1, 0.82, 1]);
  // Cursor visible until tab switches, then fades
  const cursorOpacity = interpolate(frame, [0, 12, TAB_SWITCH_FRAME + 5, TAB_SWITCH_FRAME + 15], [0, 1, 1, 0], CLAMP);

  // ── Split animation ───────────────────────────────────────────────────────────
  const splitSp = spring({frame: frame - SPLIT_START, fps, config: SPRING_SNAPPY});

  // Browser panel: width 1200→600, left 40→30
  const browserLeft  = interpolate(splitSp, [0, 1], [40, 30]);
  const browserWidth = interpolate(splitSp, [0, 1], [1200, 600]);

  // Terminal panel: slides in from right
  const terminalTranslateX = interpolate(splitSp, [0, 1], [650, 0]);
  const terminalOpacity = interpolate(frame, [SPLIT_START, SPLIT_START + 20], [0, 1], CLAMP);

  // ── Clawd curious peek from below the terminal (frame 130+) ─────────────────
  // SVG viewBox starts at y=-110 (thought bubble area), so head pixels begin
  // at SVG element y=110. After scale(0.8) center-bottom, head lands at
  // visual y=132 from container top. Body bottom at visual y=220 → clipped at 720.
  // top=510: head visible at canvas y=642, body clipped at y=720. ✓
  // translateY spring 200→0: at dy=200, head at y=842 = off-canvas. ✓
  const clawdPeekSp = spring({frame: frame - 130, fps, config: SPRING_SNAPPY});
  const clawdTranslateY = interpolate(clawdPeekSp, [0, 1], [200, 0]);

  // ── CSS animation overrides ───────────────────────────────────────────────────
  const cssAnimVars = remotionCSSAnimVars(frame, fps);

  // ── Terminal content ──────────────────────────────────────────────────────────
  const CMD_TEXT = '$ qrec search "archive JSONL" --k 3';
  const terminalLines = [
    // Command — typewriter, same start as browser bar
    {
      text: CMD_TEXT,
      color: 'rgba(255,255,255,0.9)',
      startFrame: T_CMD_START,
      typewriter: true,
      typeFrames: T_CMD_FRAMES,
    },
    // Header
    {
      text: '↳ 3 sessions found  [5.4ms]',
      color: 'rgba(255,255,255,0.5)',
      startFrame: T_FOUND_START,
    },
    // ── Result 0 ──
    {
      text: '  [c0ffee04] Archive JSONL on index for session durability  0.943',
      color: '#7ec8f5',
      startFrame: T_R0_START,
    },
    {
      text: '             qrec · Mar 13',
      color: 'rgba(255,255,255,0.4)',
      startFrame: T_R0_START + 2,
    },
    {
      text: '             Added archiveJsonl() in indexer.ts to copy each JSONL…',
      color: 'rgba(255,255,255,0.55)',
      startFrame: T_R0_START + 4,
    },
    {
      text: '             #indexer  #durability  #archive',
      color: 'rgba(126,200,245,0.6)',
      startFrame: T_R0_START + 6,
    },
    // ── Result 1 ──
    {
      text: '  [c0ffee01] Fixed mtime pre-filter bug in indexer          0.812',
      color: '#7ec8f5',
      startFrame: T_R1_START,
    },
    {
      text: '             qrec · Mar 10',
      color: 'rgba(255,255,255,0.4)',
      startFrame: T_R1_START + 2,
    },
    {
      text: '             Mtime pre-filter skips unchanged JSONL; stat-only…',
      color: 'rgba(255,255,255,0.55)',
      startFrame: T_R1_START + 4,
    },
    {
      text: '             #indexer  #performance',
      color: 'rgba(126,200,245,0.6)',
      startFrame: T_R1_START + 6,
    },
    // ── Result 2 ──
    {
      text: '  [c0ffee03] Embedder singleton + dispose lifecycle         0.741',
      color: '#7ec8f5',
      startFrame: T_R2_START,
    },
    {
      text: '             qrec · Mar 12',
      color: 'rgba(255,255,255,0.4)',
      startFrame: T_R2_START + 2,
    },
    {
      text: '             Lazy singleton load; disposeEmbedder() before exit…',
      color: 'rgba(255,255,255,0.55)',
      startFrame: T_R2_START + 4,
    },
    {
      text: '             #embeddings  #lifecycle',
      color: 'rgba(126,200,245,0.6)',
      startFrame: T_R2_START + 6,
    },
  ];

  const searchResults = revealedCount > 0 ? RESULTS.slice(0, revealedCount).map((r, i) => ({
    id: r.id,
    title: r.title,
    titleNode: i === 0
      ? (
        <>
          <span style={{position: 'relative', display: 'inline-block'}}>
            <span style={{color: '#0062a8'}}>Archive JSONL</span>
            <svg
              style={{position: 'absolute', left: 0, bottom: -4, pointerEvents: 'none', overflow: 'visible'}}
              width={UL_W} height={6}
            >
              <path
                d={UL_PATH}
                stroke="#0062a8"
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                strokeDasharray={UL_LEN}
                strokeDashoffset={underlineDash}
              />
            </svg>
          </span>
          {' on index for session durability'}
        </>
      )
      : undefined,
    project: r.project as string,
    date: r.date,
    summary: r.summary,
    tags: r.tags,
    score: r.score,
    showSummary: true,
    showTags: true,
    showEntities: false,
    showLearnings: false,
    showQuestions: false,
  })) : [];

  return (
    <AbsoluteFill style={{
      background: theme.blue, fontFamily: theme.sans,
      overflow: 'hidden', opacity: sceneOpacity,
    }}>

      {/* ── Browser panel ── */}
      <div style={{
        position: 'absolute',
        left: browserLeft,
        top: 40,
        width: browserWidth,
        height: 640,
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        transformOrigin: 'left center',
      }}>
        {/* Browser chrome bar */}
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
              {activeTab === 'search'
                ? 'localhost:25927/#search'
                : 'localhost:25927'}
            </div>
          </div>
          <div style={{width: 56}} />
        </div>

        {/* Browser content */}
        <div style={{flex: 1, position: 'relative', overflow: 'hidden', background: '#ffffff'}}>

          {/* Animated wrapper — NavBar scrolls into view */}
          <div style={{
            position: 'absolute', inset: 0,
            transform: `translateY(${contentTranslateY}px)`,
            display: 'flex', flexDirection: 'column',
            ...cssAnimVars,
          }}>
            <style>{REMOTION_ANIM_OVERRIDES}</style>

            {/* NavBar */}
            <NavBar
              logo={<QrecLogo size={28} />}
              activeTab={activeTab as 'dashboard' | 'search' | 'debug' | 'settings'}
            />

            {/* Page content area */}
            <div style={{flex: 1, position: 'relative', overflow: 'hidden'}}>

              {/* Phase 1: Session detail — enriched state (carries over from EnrichDetail) */}
              <div style={{
                position: 'absolute', inset: 0, opacity: detailOpacity,
                padding: '16px 28px 20px', overflowY: 'hidden',
              }}>
                <div style={{maxWidth: 860, margin: '0 auto', width: '100%'}}>
                  <SessionDetailHeader
                    title={SESSION_TITLE}
                    titleNode={<span style={{color: '#0062a8'}}>{SESSION_TITLE}</span>}
                  />
                  <SessionDetailMeta
                    id={SESSION_ID}
                    project={SESSION_PROJECT}
                    date={SESSION_DATE}
                    turnCount={MOCK_TURNS.length}
                  />
                  <div className="enrich-animated">
                    <style>{ENRICH_ANIMATED_CSS}</style>
                    <div className="summary-block" style={{paddingBottom: 0, marginBottom: 0}}>
                      <div className="summary-block-section">
                        <span className="summary-block-label">Summary</span>
                        <p style={{marginTop: 4}}>{SESSION_SUMMARY}</p>
                      </div>
                    </div>
                    <div className="summary-block-tags">
                      {SESSION_TAGS.map((t, i) => (
                        <span key={i} className="enrich-tag">{t}</span>
                      ))}
                    </div>
                    <div className="summary-block-section" style={{marginTop: 12}}>
                      <span className="summary-block-label">Learnings</span>
                      <ul className="summary-block-list">
                        {SESSION_LEARNINGS.map((l, i) => <li key={i}>{l}</li>)}
                      </ul>
                    </div>
                    <div className="summary-block-section" style={{marginTop: 12}}>
                      <span className="summary-block-label">Questions answered</span>
                      <ul className="summary-block-list">
                        {SESSION_QUESTIONS.map((q, i) => <li key={i}>{q}</li>)}
                      </ul>
                    </div>
                  </div>
                  <div style={{marginTop: 40}}>
                    <SessionTurns turns={MOCK_TURNS} />
                  </div>
                </div>
              </div>

              {/* Phase 2: Search results */}
              <div style={{
                position: 'absolute', inset: 0, opacity: searchOpacity,
                padding: '20px 28px 24px', overflowY: 'hidden',
              }}>
                <style>{`
                  .empty-state { display: none !important; }
                  .search-bar-btn { transform: scale(var(--search-btn-scale, 1)) !important; transition: none !important; }
                  [data-qrec-card="c0ffee04"] .session-card-title { overflow: visible !important; }
                  [data-search-hovered="true"] .search-bar-btn {
                    background: var(--accent) !important;
                    color: white !important;
                    border-color: var(--accent) !important;
                  }
                `}</style>
                <div
                  data-search-hovered={searchBtnHovered ? 'true' : 'false'}
                  style={{maxWidth: 900, margin: '0 auto', width: '100%', ['--search-btn-scale' as string]: String(searchBtnScale)}}
                >
                  <SessionsSection
                    query={typedQuery}
                    onSearch={() => {}}
                    sessions={searchResults}
                    total={searchResults.length}
                    isLoading={false}
                    isEmpty={false}
                    latency={showLatency ? SEARCH_LATENCY : undefined}
                    showFields={{
                      summary: true,
                      tags: true,
                      entities: false,
                      learnings: false,
                      questions: false,
                    }}
                    hasMore={false}
                  />
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ── Terminal panel ── */}
      <div style={{
        position: 'absolute',
        left: 650,
        top: 40,
        width: 600,
        height: 640,
        transform: `translateX(${terminalTranslateX}px)`,
        opacity: terminalOpacity,
      }}>
        <TerminalWindow
          lines={terminalLines}
          title="zsh"
          width={600}
          height={640}
          variant="light"
        />
      </div>

      {/* ── Clawd curious peek from below the terminal ── */}
      {/* Positioned at top:636 so visual top (scale=0.8, center-bottom) = y:680 = terminal bottom edge */}
      {/* Head + raised arms peek into the dark-blue canvas background below the terminal chrome */}
      <div style={{
        position: 'absolute',
        left: 864,
        top: 510,
        transform: `translateY(${clawdTranslateY}px)`,
      }}>
        <ClawdMascot
          scale={0.8}
          opacity={1}
          bob={0}
          armsUp={true}
          frame={frame - 130}
          fps={fps}
        />
      </div>

      {/* ── Mouse cursor (screen coords, outside browser) ── */}
      <MouseCursor x={cursorX} y={cursorY} scale={cursorScale} opacity={cursorOpacity} />

    </AbsoluteFill>
  );
};
