import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../theme';
import {DashboardSection} from '../../../ui-react/src/sections/DashboardSection';
// CSS vars are defined globally by Root.tsx → ui-react/src/styles/variables.css
import {
  HEATMAP_DAYS,
  HEATMAP_BYPROJECT_BREAKDOWN,
  PROJECTS,
} from '../data/index';

// ── Static demo data ─────────────────────────────────────────────────────────
const SESSIONS_COUNT  = 100;
const SUMMARIES_COUNT = 87;
const SEARCHES_COUNT  = 0;
const ACTIVE_DAYS     = HEATMAP_DAYS.filter(d => d.count > 0).length;

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

        {/* ── Dashboard content ── */}
        <div
          style={{
            flex: 1,
            background: '#ffffff',
            overflow: 'hidden',
            padding: '28px 32px',
            fontFamily: theme.sans,
          }}
        >
          <DashboardSection
            sessionsCount={SESSIONS_COUNT}
            summariesCount={SUMMARIES_COUNT}
            summariesSub="enriched"
            searchesCount={SEARCHES_COUNT}
            heatmapDays={HEATMAP_DAYS}
            heatmapByProject={HEATMAP_BYPROJECT_BREAKDOWN}
            projects={[...PROJECTS]}
            selectedProject={null}
            heatmapMetric="sessions"
            footerText={`${SESSIONS_COUNT} sessions · ${ACTIVE_DAYS} active days`}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
