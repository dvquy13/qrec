import React from 'react';
import './HeatmapProjectFilter.css';
import { projectColor } from '../../utils/heatmap';

export interface HeatmapProjectFilterProps {
  projects: string[];
  selected: string | null;
  onSelect: (project: string | null) => void;
  style?: React.CSSProperties;
}

export const HeatmapProjectFilter: React.FC<HeatmapProjectFilterProps> = ({
  projects,
  selected,
  onSelect,
  style,
}) => {
  return (
    <div className="hpf-row" style={style}>
      <button
        className={`hpf-pill${selected === null ? ' hpf-pill--selected' : ''}`}
        onClick={() => onSelect(null)}
      >
        All
      </button>
      {projects.map(project => {
        const color = projectColor(project);
        const isSelected = selected === project;
        return (
          <button
            key={project}
            className={`hpf-pill${isSelected ? ' hpf-pill--selected' : ''}`}
            style={isSelected ? {
              backgroundColor: color + '22',
              borderColor: color,
            } : undefined}
            onClick={() => onSelect(project)}
          >
            <span
              className="hpf-dot"
              style={{ background: color }}
            />
            <span className="hpf-label">{project}</span>
          </button>
        );
      })}
    </div>
  );
};
