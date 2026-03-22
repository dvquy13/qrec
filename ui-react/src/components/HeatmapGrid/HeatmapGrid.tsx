import React from 'react';
import './HeatmapGrid.css';
import {
  HEATMAP_COLORS, HEATMAP_WEEKDAYS, HEATMAP_MONTHS,
  heatmapIntensity, heatmapCurrentWeek, heatmapUnitLabel,
  projectColor, projectColorScale, buildProjectTooltipHtml,
} from '../../utils/heatmap';

export interface HeatmapGridProps {
  days: { date: string; count: number }[];
  byProject?: Record<string, Record<string, number>>;
  metric?: string;
  project?: string;
  onCellClick?: (date: string) => void;
  revealedCount?: number;
  showWeeklyBars?: boolean;
  showDayLabels?: boolean;
  style?: React.CSSProperties;
}

const CELL = 15, GAP = 2, LABEL_W = 40, CHART_H = 70, MAX_INLINE = 80, INLINE_GAP = 16;
const cs: React.CSSProperties = { width: CELL, height: CELL, borderRadius: 2, flexShrink: 0 };

export const HeatmapGrid: React.FC<HeatmapGridProps> = ({
  days,
  byProject,
  metric = 'sessions',
  project,
  onCellClick,
  revealedCount,
  showWeeklyBars = true,
  showDayLabels = true,
  style,
}) => {
  if (!days || days.length === 0) return null;

  const maxCount = Math.max(...days.map(d => d.count), 1);
  const colors = project ? projectColorScale(projectColor(project)) : HEATMAP_COLORS;
  const barColor = project ? projectColor(project) : '#686868';

  // Build week columns
  const weeks: { monday: string; cells: ({ date: string; count: number } | null)[] }[] = [];
  for (const day of days) {
    const d = new Date(day.date + 'T00:00:00');
    const weekday = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - weekday);
    const mondayStr = monday.toISOString().slice(0, 10);
    if (!weeks.length || weeks[weeks.length - 1].monday !== mondayStr)
      weeks.push({ monday: mondayStr, cells: new Array(7).fill(null) });
    weeks[weeks.length - 1].cells[weekday] = day;
  }

  // Month labels
  let lastMonth = -1;
  let lastMonthCol = -99;
  const monthAtCol = weeks.map((week, i) => {
    const first = week.cells.find(c => c);
    if (!first) return null;
    const m = new Date(first.date + 'T00:00:00').getMonth();
    if (m !== lastMonth && i - lastMonthCol >= 3) {
      lastMonth = m; lastMonthCol = i; return HEATMAP_MONTHS[m];
    }
    return null;
  });

  // Current week data (for inline bars)
  const cwDays = heatmapCurrentWeek(days);
  const cwMax = Math.max(...cwDays.map(d => d.count), 1);
  const cwStart = new Date(cwDays[0].date + 'T00:00:00');
  const cwEnd = new Date(cwDays[6].date + 'T00:00:00');
  const fmtDay = (d: Date) => `${HEATMAP_MONTHS[d.getMonth()]} ${d.getDate()}`;
  const cwLabel = `${fmtDay(cwStart)} – ${fmtDay(cwEnd)}`;

  // Pre-compute flat render order for revealedCount (row-major: wd0 all weeks, wd1 all weeks, ...)
  // This assigns a sequential index to each non-null cell in row-major order
  const cellRevealIndex: Map<string, number> = new Map(); // key: `${wi}-${wd}` => reveal index
  if (revealedCount !== undefined) {
    let idx = 0;
    for (let wd = 0; wd < 7; wd++) {
      for (let wi = 0; wi < weeks.length; wi++) {
        if (weeks[wi].cells[wd] !== null) {
          cellRevealIndex.set(`${wi}-${wd}`, idx++);
        }
      }
    }
  }

  // Weekly totals for bottom bar chart
  const weeklyTotals = weeks.map(w => {
    const d = new Date(w.monday + 'T00:00:00');
    const weekProjects: Record<string, number> = {};
    if (byProject) {
      for (const cell of w.cells) {
        if (!cell) continue;
        const dp = byProject[cell.date];
        if (!dp) continue;
        for (const [proj, cnt] of Object.entries(dp)) {
          weekProjects[proj] = (weekProjects[proj] || 0) + cnt;
        }
      }
    }
    return {
      label: `${HEATMAP_MONTHS[d.getMonth()]} ${d.getDate()}`,
      total: w.cells.reduce((s, c) => s + (c?.count || 0), 0),
      projects: weekProjects,
    };
  });
  const maxWeekly = Math.max(...weeklyTotals.map(w => w.total), 1);
  const roundedMax = Math.max(Math.ceil(maxWeekly / 5) * 5, 5);
  const LABEL_H = 14;

  return (
    <div className="heatmap" style={style}>
      {/* Month header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: GAP, marginBottom: GAP }}>
        {showDayLabels && <div style={{ width: LABEL_W, flexShrink: 0 }} />}
        {weeks.map((week, i) => (
          <div key={week.monday} style={{ width: CELL, flexShrink: 0 }}>
            {monthAtCol[i] && <span className="heatmap-month-label">{monthAtCol[i]}</span>}
          </div>
        ))}
        {showWeeklyBars && (
          <div style={{ marginLeft: INLINE_GAP, fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {cwLabel}
          </div>
        )}
      </div>

      {/* Weekday rows */}
      {HEATMAP_WEEKDAYS.map((dayName, wd) => (
        <div key={dayName} style={{ display: 'flex', alignItems: 'center', gap: GAP }}>
          {showDayLabels && (
            <div className="heatmap-day-label" style={{ width: LABEL_W }}>{dayName}</div>
          )}

          {weeks.map((week, wi) => {
            const cell = week.cells[wd];

            if (cell) {
              // Check if this cell is revealed
              const revIdx = cellRevealIndex.get(`${wi}-${wd}`);
              const isHidden = revealedCount !== undefined && revIdx !== undefined && revIdx >= revealedCount;

              if (isHidden) {
                return <div key={wi} style={{ ...cs, background: colors[0] }} />;
              }

              const intensity = heatmapIntensity(cell.count, maxCount);
              const bg = colors[intensity];
              const isClick = !!onCellClick && cell.count > 0;
              const cd = new Date(cell.date + 'T00:00:00');
              const friendlyDate = `${HEATMAP_WEEKDAYS[wd]}, ${HEATMAP_MONTHS[cd.getMonth()]} ${cd.getDate()}`;
              const titleStr = `${friendlyDate}: ${heatmapUnitLabel(cell.count, metric)}`;
              const cellProjects = byProject?.[cell.date];
              const tipHtml = cellProjects ? buildProjectTooltipHtml(titleStr, cellProjects, metric) : undefined;

              const extraProps: Record<string, string> = {};
              if (tipHtml) extraProps['data-tip-html'] = tipHtml;

              return (
                <div
                  key={wi}
                  className={`heatmap-cell${isClick ? ' heatmap-cell--clickable' : ''}`}
                  style={{ ...cs, background: bg }}
                  data-tooltip={titleStr}
                  data-date={cell.date}
                  data-count={String(cell.count)}
                  onClick={isClick ? () => onCellClick!(cell.date) : undefined}
                  {...extraProps}
                />
              );
            } else {
              const ed = new Date(week.monday + 'T00:00:00');
              ed.setDate(ed.getDate() + wd);
              const friendlyDate = `${HEATMAP_WEEKDAYS[wd]}, ${HEATMAP_MONTHS[ed.getMonth()]} ${ed.getDate()}`;
              return (
                <div key={wi} style={{ ...cs, background: colors[0] }} data-tooltip={friendlyDate} />
              );
            }
          })}

          {/* Inline bar for current week */}
          {showWeeklyBars && (() => {
            const cwCount = cwDays[wd]?.count || 0;
            const cwDate = cwDays[wd]?.date;
            const barW = Math.round((cwCount / cwMax) * MAX_INLINE);
            const barBg = cwCount > 0 ? colors[heatmapIntensity(cwCount, cwMax)] : 'transparent';
            const label = cwCount > 0 ? String(cwCount) : '';
            const fitsInside = barW > label.length * 7 + 8;
            const cwFriendly = cwDate
              ? `${HEATMAP_WEEKDAYS[wd]}, ${HEATMAP_MONTHS[new Date(cwDate + 'T00:00:00').getMonth()]} ${new Date(cwDate + 'T00:00:00').getDate()}`
              : HEATMAP_WEEKDAYS[wd];
            const cwTitle = cwCount > 0 ? `${cwFriendly}: ${heatmapUnitLabel(cwCount, metric)}` : cwFriendly;
            const cwProjects = byProject && cwDate ? byProject[cwDate] : undefined;
            const cwTipHtml = cwProjects ? buildProjectTooltipHtml(cwTitle, cwProjects, metric) : undefined;

            const cwExtraProps: Record<string, string> = {};
            if (cwTipHtml) cwExtraProps['data-tip-html'] = cwTipHtml;

            return (
              <div
                style={{ display: 'flex', alignItems: 'center', marginLeft: INLINE_GAP, minWidth: MAX_INLINE + 24 }}
                data-tooltip={!cwTipHtml ? cwTitle : undefined}
                {...cwExtraProps}
              >
                <div style={{ width: barW, height: CELL, background: barBg, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: cwCount > 0 ? 2 : 0, flexShrink: 0 }}>
                  {label && fitsInside && (
                    <span style={{ fontSize: 10, paddingRight: 2, color: '#fff', lineHeight: 1 }}>{label}</span>
                  )}
                </div>
                {label && !fitsInside && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4, lineHeight: 1 }}>{label}</span>
                )}
              </div>
            );
          })()}
        </div>
      ))}

      {/* Bottom weekly bar chart */}
      {showWeeklyBars && (
        <div style={{ display: 'flex', alignItems: 'flex-end', height: CHART_H + LABEL_H, marginTop: 8 }}>
          {showDayLabels && <div style={{ width: LABEL_W, flexShrink: 0 }} />}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: GAP }}>
            {weeklyTotals.map((week, i) => {
              const barH = Math.round((week.total / roundedMax) * CHART_H);
              const actualH = Math.max(barH, week.total > 0 ? 2 : 0);
              const title = `Week of ${week.label}: ${heatmapUnitLabel(week.total, metric)}`;
              const label = week.total > 0 ? String(Math.round(week.total)) : '';
              const weekTipHtml = Object.keys(week.projects).length > 1
                ? buildProjectTooltipHtml(title, week.projects, metric)
                : undefined;

              const barExtraProps: Record<string, string> = {};
              if (weekTipHtml) barExtraProps['data-tip-html'] = weekTipHtml;

              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: CHART_H + LABEL_H }}>
                  {label && <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1, marginBottom: 2, pointerEvents: 'none' }}>{label}</span>}
                  <div
                    className="heatmap-weekly-bar"
                    style={{ width: CELL, height: actualH, background: barColor }}
                    data-tooltip={!weekTipHtml ? title : undefined}
                    {...barExtraProps}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
