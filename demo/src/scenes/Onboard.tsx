import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../theme';
import {HeatmapGrid} from '../../../ui-react/src/components/HeatmapGrid';
import {HeatmapProjectFilter} from '../../../ui-react/src/components/HeatmapProjectFilter';
import {
  HEATMAP_DAYS,
  HEATMAP_BYPROJECT_BREAKDOWN,
  PROJECTS,
} from '../data/index';
import '../styles/dashboard.css';

// ── Static demo data ─────────────────────────────────────────────────────────
const SESSIONS_COUNT  = 100;
const SUMMARIES_COUNT = 87;
const SEARCHES_COUNT  = 0;
const ACTIVE_DAYS     = HEATMAP_DAYS.filter(d => d.count > 0).length;

// CSS custom properties injected on the white content container so all
// ui-react components (HeatmapGrid, HeatmapProjectFilter) can consume them.
const CSS_VARS: React.CSSProperties = {
  // @ts-ignore — custom CSS properties
  '--bg':           '#ffffff',
  '--bg2':          theme.bg2,
  '--bg3':          theme.bg3,
  '--border':       theme.border,
  '--text':         theme.text,
  '--text-muted':   theme.textMuted,
  '--text-dim':     theme.textDim,
  '--accent':       theme.blue,
  '--accent-hover': theme.blueHover,
  '--accent-light': theme.blueLight,
  '--accent-border':theme.blueBorder,
  '--mono':         theme.mono,
};

export const Onboard: React.FC = () => {
  const frame = useCurrentFrame();

  const sceneOpacity = interpolate(frame, [0, 20, 390, 420], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: theme.blue,
        fontFamily: theme.sans,
        overflow: 'hidden',
        opacity: sceneOpacity,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* ── Browser chrome ── */}
      <div
        style={{
          width: 1200,
          height: 600,
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 16px 56px rgba(0,0,0,0.45)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Title bar: black, blue + white only */}
        <div
          style={{
            background: '#000000',
            height: 42,
            padding: '0 18px',
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        >
          {/* Traffic dots — three blue circles */}
          <div style={{display: 'flex', gap: 6, alignItems: 'center', width: 64}}>
            {([0.3, 0.6, 1] as const).map((alpha, i) => (
              <div
                key={i}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: `rgba(0,98,168,${alpha})`,
                }}
              />
            ))}
          </div>

          {/* URL bar */}
          <div style={{flex: 1, display: 'flex', justifyContent: 'center'}}>
            <div
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 5,
                padding: '4px 16px',
                fontFamily: theme.mono,
                fontSize: 12,
                color: 'rgba(255,255,255,0.65)',
                minWidth: 160,
                maxWidth: 260,
                textAlign: 'center',
              }}
            >
              localhost:25927
            </div>
          </div>

          <div style={{width: 64}} />
        </div>

        {/* ── Dashboard: white, uses exact CSS classes from ui/styles.css ── */}
        <div
          style={{
            flex: 1,
            background: '#ffffff',
            overflow: 'hidden',
            padding: '28px 32px',
            fontFamily: theme.sans,
            ...CSS_VARS,
          }}
        >
          {/* .dashboard-header */}
          <div className="dashboard-header">
            <h2 className="section-heading">Dashboard</h2>
          </div>

          {/* .dashboard-top */}
          <div className="dashboard-top">

            {/* .stats-grid — 3 columns, label → value → sub (matches actual HTML) */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Sessions</div>
                <div className="stat-value">{SESSIONS_COUNT}</div>
                <div className="stat-sub">indexed</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">AI Summaries</div>
                <div className="stat-value">{SUMMARIES_COUNT}</div>
                <div className="stat-sub">enriched</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Searches</div>
                <div className="stat-value">{SEARCHES_COUNT}</div>
                <div className="stat-sub">queries run</div>
              </div>
            </div>

            {/* .dashboard-heatmap-col */}
            <div className="dashboard-heatmap-col">

              {/* .heatmap-controls */}
              <div className="heatmap-controls">
                <div className="heatmap-metrics">
                  <button className="heatmap-metric heatmap-metric--active">Sessions</button>
                  <button className="heatmap-metric">Hours</button>
                </div>
                <HeatmapProjectFilter
                  projects={[...PROJECTS]}
                  selected={null}
                  onSelect={() => {}}
                />
              </div>

              <HeatmapGrid
                days={HEATMAP_DAYS}
                byProject={HEATMAP_BYPROJECT_BREAKDOWN}
                showWeeklyBars
                showDayLabels
              />

              <div className="heatmap-footer">
                {SESSIONS_COUNT} sessions · {ACTIVE_DAYS} active days
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
