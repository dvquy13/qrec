import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {CLAMP, SPRING_BOUNCY, SPRING_SNAPPY, getTyped, cursorBlink, remotionCSSAnimVars, REMOTION_ANIM_OVERRIDES} from '../animUtils';
import {TrafficDots} from '../components/TrafficDots';
import {DashboardSection} from '../../../ui-react/src/sections/DashboardSection';
import {RunGroup} from '../../../ui-react/src/components/ActivityFeed/ActivityFeed';
import {RecentActivitySection} from '../../../ui-react/src/sections/RecentActivitySection';
import {
  HEATMAP_DAYS,
  HEATMAP_BYPROJECT_BREAKDOWN,
  PROJECTS,
} from '../data/index';

// CSS vars are defined globally by Root.tsx → ui-react/src/styles/variables.css

const SESSIONS_TOTAL = 50;
const SUMMARIES_TOTAL = 50;

// ── Timeline ─────────────────────────────────────────────────────────────────
//   0– 12f:  scene fade in          ← terminal: original speed
//  12– 55f:  type cmd1
//  48– 56f:  install response fades in
//  60– 75f:  type cmd2
//  78–102f:  daemon messages appear
// 108–112f:  terminal fades out     ← browser: compressed to 90f total (3s)
// 109–116f:  browser springs in
// 117–128f:  model_download (0→100%)
// 128–137f:  model_loading (indeterminate)
// 137–169f:  sessions count 0→50 + indexing in activity feed
// 149–189f:  summaries count 0→50 + enriching in activity feed
// 192–198f:  (no fade out — hard cut to ProjectFilter)


export const Onboard: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // ── Scene opacity ─────────────────────────────────────────────────────────
  const sceneOpacity = interpolate(frame, [0, 12], [0, 1], CLAMP);

  // ── Terminal typing ───────────────────────────────────────────────────────
  const CMD1 = 'npm install -g @dvquys/qrec';
  const CMD2 = 'qrec serve --daemon';
  const cmd1 = getTyped(CMD1, 12, frame);
  const cmd1Done = cmd1.length >= CMD1.length;
  const cmd2StartFrame = 60;
  const cmd2 = getTyped(CMD2, cmd2StartFrame, frame);
  const cmd2Done = cmd2.length >= CMD2.length;
  const blinkOn = cursorBlink(frame);

  const installResponseOpacity = interpolate(frame, [48, 56], [0, 1], CLAMP);
  const daemon1Opacity = interpolate(frame, [78, 84], [0, 1], CLAMP);
  const daemon2Opacity = interpolate(frame, [86, 92], [0, 1], CLAMP);
  const daemon3Opacity = interpolate(frame, [94, 100], [0, 1], CLAMP);

  // ── Terminal / browser transitions ────────────────────────────────────────
  const terminalSlideY = interpolate(
    spring({frame, fps, config: SPRING_SNAPPY}),
    [0, 1],
    [600, 0],
  );
  const terminalOpacity = interpolate(frame, [108, 112], [1, 0], CLAMP);
  const browserSp = spring({frame: frame - 109, fps, config: SPRING_BOUNCY});
  const browserScale = interpolate(browserSp, [0, 1], [0.88, 1]);
  const browserOpacity = interpolate(frame, [109, 115], [0, 1], CLAMP);

  // ── Dashboard counts ──────────────────────────────────────────────────────
  const sessionsCount = Math.round(interpolate(frame, [137, 169], [0, SESSIONS_TOTAL], CLAMP));
  const summariesCount = Math.round(interpolate(frame, [149, 189], [0, SUMMARIES_TOTAL], CLAMP));
  const sessionsIndexing = frame >= 137 && frame < 172;
  const summariesEnriching = frame >= 149 && frame < 191;
  // Full 15-week grid matches the real qrec UI; only the last 30 days animate
  // (Claude only retains the last 30 days of sessions).
  const HEATMAP_15W = HEATMAP_DAYS.slice(-105);
  const LAST30_OFFSET = HEATMAP_15W.length - 30;
  const heatmap30 = HEATMAP_15W.slice(LAST30_OFFSET);
  // Distribute exactly sessionsCount sessions across the last 30 days (largest-remainder rounding).
  // useMemo avoids recreating 105+ day objects on every frame — only recomputes when count changes.
  const animatedDays = useMemo(() => {
    const weightTotal = heatmap30.reduce((s, d) => s + d.count, 0);
    const exact = heatmap30.map((d) => (d.count / weightTotal) * sessionsCount);
    const floors = exact.map(Math.floor);
    const remaining = sessionsCount - floors.reduce((s, v) => s + v, 0);
    exact
      .map((v, i) => ({i, frac: v % 1}))
      .sort((a, b) => b.frac - a.frac)
      .slice(0, remaining)
      .forEach(({i}) => floors[i]++);
    return HEATMAP_15W.map((d, i) =>
      i >= LAST30_OFFSET ? {...d, count: floors[i - LAST30_OFFSET]} : {...d, count: 0},
    );
  }, [sessionsCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeDays = animatedDays.filter((d) => d.count > 0).length;
  const footerText = `${sessionsCount} sessions · ${activeDays} active days`;

  // ── Frame-driven CSS animation overrides (CSS animations don't run in Remotion) ──
  const cssAnimVars = remotionCSSAnimVars(frame, fps);
  const pulseOpacity = parseFloat(cssAnimVars['--remotion-pulse-opacity' as string]);

  // ── Activity feed groups ──────────────────────────────────────────────────
  // Use Date.now() so formatRelative returns "just now" for all entries
  const NOW = Date.now();
  const activityGroups: RunGroup[] = [];

  if (frame >= 117) {
    const dlPercent = Math.round(interpolate(frame, [117, 128], [0, 100], CLAMP));
    const dlDone = frame >= 128;
    activityGroups.push({
      type: 'model_download',
      running: !dlDone,
      ts: NOW,
      events: [],
      syntheticProgress: !dlDone
        ? {percent: dlPercent, label: 'embeddinggemma-300M-Q8_0.gguf'}
        : undefined,
    });
  }

  if (frame >= 128) {
    const loadingDone = frame >= 137;
    activityGroups.unshift({
      type: 'model_loading',
      running: !loadingDone,
      ts: NOW,
      events: [],
    });
  }

  if (frame >= 137) {
    const indexDone = frame >= 172;
    const n = Math.round(interpolate(frame, [137, 169], [0, SESSIONS_TOTAL], CLAMP));
    activityGroups.unshift({
      type: 'index',
      running: !indexDone,
      ts: NOW,
      events: [],
      syntheticLabel: indexDone ? undefined : `Indexing… ${n} indexed`,
    });
  }

  if (frame >= 149) {
    const enrichDone = frame >= 191;
    const n = Math.round(interpolate(frame, [149, 186], [0, SUMMARIES_TOTAL], CLAMP));
    activityGroups.unshift({
      type: 'enrich',
      running: !enrichDone,
      ts: NOW,
      events: [],
      syntheticLabel: enrichDone ? undefined : `Enriching… ${n} / ${SUMMARIES_TOTAL}`,
    });
  }

  return (
    <AbsoluteFill
      style={{
        background: theme.blue,
        fontFamily: theme.sans,
        overflow: 'hidden',
        opacity: sceneOpacity,
      }}
    >
      {/* ── Terminal ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: terminalOpacity,
          transform: `translateY(${terminalSlideY}px)`,
        }}
      >
        <div
          style={{
            width: 1000,
            borderRadius: 10,
            overflow: 'hidden',
            boxShadow: '0 20px 56px rgba(0,0,0,0.55)',
            fontFamily: theme.mono,
          }}
        >
          {/* Terminal header — WHITE background so blue dots are visible */}
          <div
            style={{
              background: '#ffffff',
              height: 46,
              display: 'flex',
              alignItems: 'center',
              padding: '0 18px',
              borderBottom: `1px solid ${theme.border}`,
            }}
          >
            <TrafficDots />
            <div
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 15,
                fontWeight: 500,
                color: theme.textMuted,
                fontFamily: theme.mono,
              }}
            >
              zsh
            </div>
            <div style={{width: 56}} />
          </div>

          {/* Terminal body */}
          <div
            style={{
              background: '#0d1117',
              padding: '24px 28px',
              minHeight: 280,
              fontSize: 18,
              lineHeight: 1.6,
            }}
          >
            {/* cmd1 */}
            <div style={{display: 'flex', alignItems: 'baseline'}}>
              <span style={{color: theme.blue, marginRight: 10, fontWeight: 600}}>$</span>
              <span style={{color: '#ffffff'}}>
                {cmd1}
                {!cmd1Done && (
                  <span style={{opacity: blinkOn ? 1 : 0, color: 'rgba(255,255,255,0.6)'}}>
                    ▌
                  </span>
                )}
              </span>
            </div>

            {/* install response */}
            <div style={{opacity: installResponseOpacity, marginBottom: 14, paddingLeft: 22}}>
              <span style={{color: 'rgba(255,255,255,0.4)', fontSize: 16}}>
                added 1 package in 2s
              </span>
            </div>

            {/* cmd2 */}
            {frame >= cmd2StartFrame - 4 && (
              <div style={{display: 'flex', alignItems: 'baseline'}}>
                <span style={{color: theme.blue, marginRight: 10, fontWeight: 600}}>$</span>
                <span style={{color: '#ffffff'}}>
                  {cmd2}
                  {!cmd2Done && (
                    <span style={{opacity: blinkOn ? 1 : 0, color: 'rgba(255,255,255,0.6)'}}>
                      ▌
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* daemon messages */}
            <div style={{paddingLeft: 22}}>
              <div style={{opacity: daemon1Opacity, color: 'rgba(255,255,255,0.4)', fontSize: 16}}>
                [daemon] starting...
              </div>
              <div style={{opacity: daemon2Opacity, color: theme.blue, fontSize: 16}}>
                [daemon] model loaded — ready
              </div>
              <div style={{opacity: daemon3Opacity, color: theme.blue, fontSize: 16}}>
                [daemon] server listening on :25927
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Browser ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: browserOpacity,
          transform: `scale(${browserScale})`,
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
          {/* Browser title bar — WHITE with blue dots */}
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

            {/* URL bar */}
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
              // CSS custom properties for frame-driven animation overrides (see animUtils.ts)
              ...cssAnimVars,
            }}
          >
            {/* Override CSS animations that don't run in Remotion */}
            <style>{REMOTION_ANIM_OVERRIDES}</style>
            {/* max-width: 900px matches the real qrec UI <main> constraint */}
            <div style={{maxWidth: 900, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden'}}>
            <DashboardSection
              sessionsCount={sessionsCount}
              sessionsIndexing={sessionsIndexing}
              summariesCount={frame >= 149 ? summariesCount : null}
              summariesSub={
                frame < 149
                  ? 'disabled'
                  : summariesEnriching
                    ? `${summariesCount} enriched`
                    : 'enriched'
              }
              summariesEnriching={summariesEnriching}
              searchesCount={0}
              heatmapDays={animatedDays}
              heatmapByProject={HEATMAP_BYPROJECT_BREAKDOWN}
              projects={[...PROJECTS]}
              selectedProject={null}
              heatmapMetric="sessions"
              footerText={footerText}
            />

            {/* Recent Activity — exact same component as qrec web UI */}
            {frame >= 117 && (
              <RecentActivitySection
                groups={activityGroups}
                modelName="embeddinggemma-300M-Q8_0.gguf"
                maxVisible={5}
                isLive={activityGroups.some((g) => g.running)}
                liveDotOpacity={pulseOpacity}
                marginTop={24}
                style={{flex: 1, overflow: 'hidden'}}
              />
            )}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
