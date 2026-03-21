import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {DashboardSection} from '../../../ui-react/src/sections/DashboardSection';
import {RunGroup} from '../../../ui-react/src/components/ActivityFeed/ActivityFeed';
import {RecentActivitySection} from '../../../ui-react/src/sections/RecentActivitySection';
import {
  HEATMAP_DAYS,
  HEATMAP_BYPROJECT_BREAKDOWN,
  PROJECTS,
} from '../data/index';

// CSS vars are defined globally by Root.tsx → ui-react/src/styles/variables.css

const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const SESSIONS_TOTAL = 100;
const SUMMARIES_TOTAL = 87;
const CHARS_PER_FRAME = 1.5;

// ── Timeline ─────────────────────────────────────────────────────────────────
//   0–12f:   scene fade in
//  12–55f:   type cmd1 (npm install -g @dvquys/qrec)
//  48–56f:   install response fades in
//  60–75f:   type cmd2 (qrec serve --daemon)
//  78–102f:  daemon messages appear
// 108–125f:  terminal fades out
// 112–135f:  browser springs in
// 140–178f:  model_download (0→100%)
// 178–208f:  model_loading (indeterminate)
// 208–320f:  sessions count 0→100 + indexing in activity feed
// 250–390f:  summaries count 0→87 + enriching in activity feed
// 400–420f:  fade out

function getTyped(text: string, startFrame: number, frame: number): string {
  return text.substring(
    0,
    Math.min(text.length, Math.floor(Math.max(0, frame - startFrame) * CHARS_PER_FRAME)),
  );
}

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

export const Onboard: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // ── Scene opacity ─────────────────────────────────────────────────────────
  const sceneOpacity = interpolate(frame, [0, 12, 400, 420], [0, 1, 1, 0], CLAMP);

  // ── Terminal typing ───────────────────────────────────────────────────────
  const CMD1 = 'npm install -g @dvquys/qrec';
  const CMD2 = 'qrec serve --daemon';
  const cmd1 = getTyped(CMD1, 12, frame);
  const cmd1Done = cmd1.length >= CMD1.length;
  const cmd2StartFrame = 60;
  const cmd2 = getTyped(CMD2, cmd2StartFrame, frame);
  const cmd2Done = cmd2.length >= CMD2.length;
  const blinkOn = Math.floor(frame / 15) % 2 === 0;

  const installResponseOpacity = interpolate(frame, [48, 56], [0, 1], CLAMP);
  const daemon1Opacity = interpolate(frame, [78, 84], [0, 1], CLAMP);
  const daemon2Opacity = interpolate(frame, [86, 92], [0, 1], CLAMP);
  const daemon3Opacity = interpolate(frame, [94, 100], [0, 1], CLAMP);

  // ── Terminal / browser transitions ────────────────────────────────────────
  const terminalOpacity = interpolate(frame, [0, 8, 108, 122], [0, 1, 1, 0], CLAMP);
  const browserSp = spring({frame: frame - 112, fps, config: {damping: 15, stiffness: 140}});
  const browserScale = interpolate(browserSp, [0, 1], [0.88, 1]);
  const browserOpacity = interpolate(frame, [112, 132], [0, 1], CLAMP);

  // ── Dashboard counts ──────────────────────────────────────────────────────
  const sessionsCount = Math.round(interpolate(frame, [208, 320], [0, SESSIONS_TOTAL], CLAMP));
  const summariesCount = Math.round(interpolate(frame, [250, 390], [0, SUMMARIES_TOTAL], CLAMP));
  const sessionsIndexing = frame >= 208 && frame < 330;
  const summariesEnriching = frame >= 250 && frame < 395;
  // Real qrec UI defaults to 15 weeks (105 days); slice to match
  const HEATMAP_15W = HEATMAP_DAYS.slice(-105);
  const revealedCount = Math.round(interpolate(frame, [208, 320], [0, HEATMAP_15W.length], CLAMP));

  const activeDays = HEATMAP_15W.filter((d) => d.count > 0).length;
  const footerText = `${sessionsCount} sessions · ${activeDays} active days`;

  // ── Frame-driven CSS animation overrides (CSS animations don't run in Remotion) ──
  const spinAngle = (frame / (0.7 * fps)) * 360;
  const indetermPhase = (frame / (1.4 * fps)) % 1; // 0–1 per cycle
  const indetermX = `${indetermPhase * 500 - 100}%`; // -100% → 400%
  const pulseOpacity = 0.35 + 0.65 * (Math.sin((frame / (1.5 * fps)) * 2 * Math.PI) * 0.5 + 0.5);

  // ── Activity feed groups ──────────────────────────────────────────────────
  // Use Date.now() so formatRelative returns "just now" for all entries
  const NOW = Date.now();
  const activityGroups: RunGroup[] = [];

  if (frame >= 140) {
    const dlPercent = Math.round(interpolate(frame, [140, 178], [0, 100], CLAMP));
    const dlDone = frame >= 178;
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

  if (frame >= 178) {
    const loadingDone = frame >= 208;
    activityGroups.unshift({
      type: 'model_loading',
      running: !loadingDone,
      ts: NOW,
      events: [],
    });
  }

  if (frame >= 208) {
    const indexDone = frame >= 330;
    const n = Math.round(interpolate(frame, [208, 320], [0, 100], CLAMP));
    activityGroups.unshift({
      type: 'index',
      running: !indexDone,
      ts: NOW,
      events: [],
      syntheticLabel: indexDone ? undefined : `Indexing… ${n} indexed`,
    });
  }

  if (frame >= 250) {
    const enrichDone = frame >= 395;
    const n = Math.round(interpolate(frame, [250, 380], [0, 87], CLAMP));
    activityGroups.unshift({
      type: 'enrich',
      running: !enrichDone,
      ts: NOW,
      events: [],
      syntheticLabel: enrichDone ? undefined : `Enriching… ${n} / 87`,
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
              // CSS custom properties for frame-driven animation overrides
              ['--remotion-spin-angle' as string]: `${spinAngle}deg`,
              ['--remotion-indeterminate-x' as string]: indetermX,
              ['--remotion-pulse-opacity' as string]: String(pulseOpacity),
            }}
          >
            {/* Override CSS animations that don't run in Remotion */}
            <style>{`
              .af-spinner { animation: none !important; transform: rotate(var(--remotion-spin-angle, 0deg)); }
              .af-progress-fill--indeterminate { animation: none !important; transform: translateX(var(--remotion-indeterminate-x, -100%)); }
              .stat-indexing-dot.visible, .activity-live-dot { animation: none !important; opacity: var(--remotion-pulse-opacity, 1); }
            `}</style>
            {/* max-width: 900px matches the real qrec UI <main> constraint */}
            <div style={{maxWidth: 900, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', flex: 1}}>
            <DashboardSection
              sessionsCount={sessionsCount}
              sessionsIndexing={sessionsIndexing}
              summariesCount={frame >= 250 ? summariesCount : null}
              summariesSub={
                frame < 250
                  ? 'disabled'
                  : summariesEnriching
                    ? `${summariesCount} enriched`
                    : 'enriched'
              }
              summariesEnriching={summariesEnriching}
              searchesCount={0}
              heatmapDays={HEATMAP_15W}
              heatmapByProject={HEATMAP_BYPROJECT_BREAKDOWN}
              projects={[...PROJECTS]}
              selectedProject={null}
              heatmapMetric="sessions"
              footerText={footerText}
              revealedCount={revealedCount}
            />

            {/* Recent Activity — exact same component as qrec web UI */}
            {frame >= 140 && (
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
