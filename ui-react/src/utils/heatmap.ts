export const HEATMAP_COLORS = ['#f0f0f0', '#d0d0d0', '#a0a0a0', '#686868', '#2a2a2a'];
export const PROJECT_COLORS = ['#e63946','#2a9d8f','#e9a825','#9b5de5','#f4713c','#4361ee','#43aa8b','#0062a8','#3d7ebf','#c77dff'];

export const HEATMAP_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const HEATMAP_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const HEATMAP_METRICS = [
  { id: 'sessions', label: 'Sessions', unit: 'session', units: 'sessions' },
  { id: 'hours',    label: 'Hours',    unit: 'hour',    units: 'hours'    },
];

export function projectColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PROJECT_COLORS[h % PROJECT_COLORS.length];
}

export function projectColorScale(hex: string): string[] {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  const mix = (c: number, t: number) => Math.round(c * t + 255 * (1 - t));
  return [
    '#f0f0f0',
    `rgb(${mix(r,0.2)},${mix(g,0.2)},${mix(b,0.2)})`,
    `rgb(${mix(r,0.45)},${mix(g,0.45)},${mix(b,0.45)})`,
    `rgb(${mix(r,0.7)},${mix(g,0.7)},${mix(b,0.7)})`,
    hex,
  ];
}

export function heatmapIntensity(count: number, maxCount: number): number {
  if (count === 0 || maxCount === 0) return 0;
  const q = count / maxCount;
  if (q <= 0.25) return 1;
  if (q <= 0.5)  return 2;
  if (q <= 0.75) return 3;
  return 4;
}

export function heatmapUnitLabel(count: number, metricId: string): string {
  const m = HEATMAP_METRICS.find(m => m.id === metricId) || HEATMAP_METRICS[0];
  const display = Number.isInteger(count) ? count.toLocaleString() : count.toFixed(1);
  return `${display} ${count === 1 ? m!.unit : m!.units}`;
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function heatmapCurrentWeek(days: { date: string; count: number }[]): { date: string; count: number }[] {
  const today = new Date();
  const wd = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - wd);
  monday.setHours(0, 0, 0, 0);
  const result = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { date: localDateStr(d), count: 0 };
  });
  const mondayStr = result[0].date;
  const sundayStr = result[6].date;
  for (const day of days) {
    if (day.date >= mondayStr && day.date <= sundayStr) {
      const i = (new Date(day.date + 'T00:00:00').getDay() + 6) % 7;
      result[i] = { date: day.date, count: day.count };
    }
  }
  return result;
}

export function buildProjectTooltipHtml(headerText: string, projectCounts: Record<string, number>, metric: string): string {
  const sorted = Object.entries(projectCounts).sort((a, b) => b[1] - a[1]);
  let html = `<div style="font-weight:600;margin-bottom:4px;">${escHtml(headerText)}</div>`;
  for (const [proj, cnt] of sorted) {
    const color = projectColor(proj);
    html += `<div style="display:flex;align-items:center;gap:5px;margin-top:2px;">`;
    html += `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0;"></span>`;
    html += `<span style="flex:1;overflow:hidden;text-overflow:ellipsis;max-width:120px;">${escHtml(proj)}</span>`;
    html += `<span style="margin-left:6px;opacity:0.85;">${heatmapUnitLabel(cnt, metric)}</span>`;
    html += `</div>`;
  }
  return html;
}

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
