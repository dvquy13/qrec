import React, { useState, useEffect, useRef } from 'react';
import './HeatmapProjectFilter.css';
import { projectColor } from '../../utils/heatmap';

export interface HeatmapProjectFilterProps {
  projects: string[];
  selected: string | null;
  onSelect: (project: string | null) => void;
  style?: React.CSSProperties;
}

const MAX_PILLS = 2;

export const HeatmapProjectFilter: React.FC<HeatmapProjectFilterProps> = ({
  projects,
  selected,
  onSelect,
  style,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const recentPills = projects.slice(0, MAX_PILLS);
  const label = selected ?? 'All projects';

  const pick = (p: string | null) => { onSelect(p); setOpen(false); };

  return (
    <div className="hpf-row" style={style}>
      {/* Custom dropdown */}
      <div className="hpf-dropdown" ref={ref}>
        <button
          className={`hpf-trigger${open ? ' hpf-trigger--open' : ''}`}
          onClick={() => setOpen(o => !o)}
        >
          {selected && (
            <span className="hpf-dot" style={{ background: projectColor(selected) }} />
          )}
          <span className="hpf-trigger-label">{label}</span>
          <svg className="hpf-caret" width="10" height="6" viewBox="0 0 10 6">
            <path d="M0 0l5 6 5-6z" fill="currentColor" />
          </svg>
        </button>

        {open && (
          <div className="hpf-menu">
            <button
              className={`hpf-option${selected === null ? ' hpf-option--selected' : ''}`}
              onClick={() => pick(null)}
            >
              All projects
            </button>
            {projects.map(p => (
              <button
                key={p}
                className={`hpf-option${selected === p ? ' hpf-option--selected' : ''}`}
                onClick={() => pick(p)}
              >
                <span className="hpf-dot" style={{ background: projectColor(p) }} />
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recent project pills */}
      {recentPills.map(project => {
        const color = projectColor(project);
        const isSelected = selected === project;
        return (
          <button
            key={project}
            className={`hpf-pill${isSelected ? ' hpf-pill--selected' : ''}`}
            style={isSelected ? { backgroundColor: color + '22', borderColor: color } : undefined}
            onClick={() => onSelect(isSelected ? null : project)}
            title={project}
          >
            <span className="hpf-dot" style={{ background: color }} />
            <span className="hpf-label">{project}</span>
          </button>
        );
      })}
    </div>
  );
};
