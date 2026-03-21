import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
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
  type Turn,
} from '../../../ui-react/src/sections/SessionDetailSection';
import {SessionsSection} from '../../../ui-react/src/sections/SessionsSection';
import {NavBar} from '../../../ui-react/src/components/NavBar/NavBar';
import {MouseCursor} from '../components/MouseCursor';
import {TerminalWindow} from '../components/TerminalWindow';
import {QrecLogo} from '../components/QrecLogo';
import {SEARCH_RESULTS} from '../data/index';

// ── Timeline ──────────────────────────────────────────────────────────────────
//   0– 12f:  fade in — browser with session detail + NavBar (activeTab="dashboard")
//  12– 40f:  scroll-up: browser content translateY spring -50px → 0 (NavBar reveals)
//  40– 78f:  MouseCursor spring-moves to "Search" nav button
//  72– 82f:  click: cursor scale dip (0.82), activeTab switches at frame 78
//  82–105f:  session detail fades out; SessionsSection empty state fades in
// 105–155f:  search query "archive JSONL" types into search bar
//            results appear one by one: card 0 at 135f, card 1 at 145f, card 2 at 155f
// 155–195f:  split animation: browser narrows, terminal slides in from right
// 195–290f:  TerminalWindow types CLI output lines
// 290–310f:  fade out

// ── Session data (same session as EnrichDetail) ───────────────────────────────
const SESSION_ID = 'c0ffee04';
const SESSION_TITLE = 'Archive JSONL on index for session durability';
const SESSION_PROJECT = 'qrec';
const SESSION_DATE = '2026-03-13';
const SESSION_SUMMARY =
  'Added archiveJsonl() in indexer.ts to copy each JSONL to ~/.qrec/archive/ before indexing.';

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
    text: 'Added `archiveJsonl()` to `indexer.ts` — copies each JSONL to `~/.qrec/archive/<project>/` before indexing.',
    tools: ['Read: src/indexer.ts', 'Edit: src/indexer.ts'],
    thinking: [],
    timestamp: '2026-03-13T11:05:00Z',
  },
];

// ── Search results ────────────────────────────────────────────────────────────
const SEARCH_QUERY = 'archive JSONL';
const RESULTS = SEARCH_RESULTS['archive JSONL'];
const SEARCH_LATENCY = {bm25Ms: 1.2, embedMs: 0, knnMs: 3.8, fusionMs: 0.4, totalMs: 5.4};

// ── Layout constants ──────────────────────────────────────────────────────────
// BROWSER_FULL: width 1200, centered (left 40), top 40, height 640
// BROWSER_SPLIT: left 30, width 600, top 40, height 640
// TERMINAL_SPLIT: left 650, width 600, top 40, height 640

// ── Timing constants ──────────────────────────────────────────────────────────
const SCROLL_START = 12;
const CURSOR_MOVE_START = 40;
const CLICK_START = 72;
const TAB_SWITCH_FRAME = 78;
const SEARCH_TYPE_START = 105;
const CARD0_FRAME = 135;
const CARD1_FRAME = 145;
const CARD2_FRAME = 155;
const SPLIT_START = 155;
const TERMINAL_START = 195;
const FADE_START = 290;
const FADE_END = 310;

// ── Terminal line timings ─────────────────────────────────────────────────────
const T_CMD_START   = TERMINAL_START;        // 195f: command line
const T_CMD_FRAMES  = 35;                    // typewriter over 35f
const T_FOUND_START = T_CMD_START + T_CMD_FRAMES; // 230f: "3 sessions found"
const T_R0_START    = T_FOUND_START + 7;     // 237f: result 0
const T_R1_START    = T_R0_START + 12;       // 249f: result 1
const T_R2_START    = T_R1_START + 12;       // 261f: result 2

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

// ── Main scene ────────────────────────────────────────────────────────────────
export const SearchDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // ── Scene opacity ────────────────────────────────────────────────────────────
  const sceneOpacity = interpolate(frame, [0, 12, FADE_START, FADE_END], [0, 1, 1, 0], CLAMP);

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

  // ── CSS animation overrides ───────────────────────────────────────────────────
  const cssAnimVars = remotionCSSAnimVars(frame, fps);

  // ── Terminal content ──────────────────────────────────────────────────────────
  const CMD_TEXT = '$ qrec search "archive JSONL" --k 3';
  const terminalLines = [
    {
      text: CMD_TEXT,
      color: 'rgba(255,255,255,0.9)',
      startFrame: T_CMD_START,
      typewriter: true,
      typeFrames: T_CMD_FRAMES,
    },
    {
      text: '↳ 3 sessions found  [28ms]',
      color: 'rgba(255,255,255,0.5)',
      startFrame: T_FOUND_START,
    },
    {
      text: `  Archive JSONL on index for session durability   0.943`,
      color: '#7ec8f5',
      startFrame: T_R0_START,
    },
    {
      text: `  Fixed mtime pre-filter bug in indexer            0.812`,
      color: '#7ec8f5',
      startFrame: T_R1_START,
    },
    {
      text: `  Embedder singleton + dispose lifecycle            0.741`,
      color: '#7ec8f5',
      startFrame: T_R2_START,
    },
  ];

  const searchResults = revealedCount > 0 ? RESULTS.slice(0, revealedCount).map(r => ({
    id: r.id,
    title: r.title,
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

              {/* Phase 1: Session detail */}
              <div style={{
                position: 'absolute', inset: 0, opacity: detailOpacity,
                padding: '16px 28px 20px', overflowY: 'hidden',
              }}>
                <div style={{maxWidth: 860, margin: '0 auto', width: '100%'}}>
                  <SessionDetailHeader title={SESSION_TITLE} />
                  <SessionDetailMeta
                    id={SESSION_ID}
                    project={SESSION_PROJECT}
                    date={SESSION_DATE}
                    turnCount={MOCK_TURNS.length}
                  />
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
                <div style={{maxWidth: 900, margin: '0 auto', width: '100%'}}>
                  <SessionsSection
                    query={typedQuery}
                    onSearch={() => {}}
                    sessions={searchResults}
                    total={searchResults.length}
                    isLoading={false}
                    isEmpty={revealedCount === 0 && frame < CARD0_FRAME && frame >= 82}
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <TerminalWindow
          lines={terminalLines}
          title="zsh"
          width={560}
          variant="light"
        />
      </div>

      {/* ── Mouse cursor (screen coords, outside browser) ── */}
      <MouseCursor x={cursorX} y={cursorY} scale={cursorScale} opacity={cursorOpacity} />

    </AbsoluteFill>
  );
};
