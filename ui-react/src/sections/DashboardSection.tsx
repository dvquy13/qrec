import React, { useState, useEffect } from 'react';
import './DashboardSection.css';
import { HeatmapGrid } from '../components/HeatmapGrid';
import { HeatmapProjectFilter } from '../components/HeatmapProjectFilter';

export interface DashboardSectionProps {
  // Stat cards
  sessionsCount: number;
  sessionsIndexing?: boolean;
  summariesCount: number | null;   // null = enrichment disabled → shows "—"
  summariesSub?: string;           // e.g. "enriched" | "87% enriched" | "disabled"
  summariesEnriching?: boolean;
  searchesCount: number;

  // Heatmap
  heatmapDays?: { date: string; count: number }[];
  heatmapByProject?: Record<string, Record<string, number>>;
  projects?: string[];
  selectedProject?: string | null;
  onProjectSelect?: (p: string | null) => void;
  heatmapMetric?: string;          // 'sessions' | 'hours', default 'sessions'
  onMetricSelect?: (m: string) => void;
  footerText?: string;             // e.g. "322 sessions · 32 active days"

  // Remotion-specific (animation)
  revealedCount?: number;
}

const HEATMAP_METRICS = [
  { id: 'sessions', label: 'Sessions' },
  { id: 'hours', label: 'Hours' },
];

export const DashboardSection: React.FC<DashboardSectionProps> = ({
  sessionsCount,
  sessionsIndexing,
  summariesCount,
  summariesSub,
  summariesEnriching,
  searchesCount,
  heatmapDays,
  heatmapByProject,
  projects,
  selectedProject,
  onProjectSelect,
  heatmapMetric = 'sessions',
  onMetricSelect,
  footerText,
  revealedCount,
}) => {
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const isMobile = windowWidth <= 600;
  const maxWeeks = isMobile ? 12 : undefined;

  const summariesValue =
    summariesCount === null ? (
      <span style={{ color: 'var(--text-muted)' }}>—</span>
    ) : (
      summariesCount.toLocaleString()
    );

  const summariesSubText =
    summariesSub ?? (summariesCount === null ? 'disabled' : 'enriched');

  const hasHeatmap = heatmapDays && heatmapDays.length > 0;
  const visibleDays = maxWeeks !== undefined && heatmapDays
    ? heatmapDays.slice(-maxWeeks * 7)
    : heatmapDays;

  return (
    <>
      <div className="dashboard-header">
        <h2 className="section-heading">Dashboard</h2>
      </div>

      <div className="dashboard-top">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Sessions
              {sessionsIndexing && <span className="stat-indexing-dot visible" />}
            </div>
            <div className="stat-value">{sessionsCount.toLocaleString()}</div>
            <div className="stat-sub">indexed</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">
              AI Summaries
              {summariesEnriching && <span className="stat-indexing-dot visible" />}
            </div>
            <div className="stat-value">{summariesValue}</div>
            <div className="stat-sub">{summariesSubText}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Searches</div>
            <div className="stat-value">{searchesCount.toLocaleString()}</div>
            <div className="stat-sub">queries run</div>
          </div>
        </div>

        {hasHeatmap && (
          <div className="dashboard-heatmap-col">
            <div className="heatmap-controls">
              <div className="heatmap-metrics">
                {HEATMAP_METRICS.map(m => (
                  <button
                    key={m.id}
                    className={`heatmap-metric${heatmapMetric === m.id ? ' heatmap-metric--active' : ''}`}
                    onClick={() => onMetricSelect?.(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {projects && projects.length > 0 && (
                <HeatmapProjectFilter
                  projects={projects}
                  selected={selectedProject ?? null}
                  onSelect={onProjectSelect ?? (() => {})}
                />
              )}
            </div>

            <HeatmapGrid
              days={visibleDays!}
              byProject={heatmapByProject}
              metric={heatmapMetric}
              project={selectedProject ?? undefined}
              showWeeklyBars
              showDayLabels
              revealedCount={revealedCount}
            />

            {footerText && (
              <div className="heatmap-footer">{footerText}</div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
