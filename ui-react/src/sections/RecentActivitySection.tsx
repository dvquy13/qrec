import React from 'react';
import './RecentActivitySection.css';
import { ActivityFeed, ActivityFeedProps } from '../components/ActivityFeed';

export interface RecentActivitySectionProps extends ActivityFeedProps {
  /** Show the green live dot next to the heading */
  isLive?: boolean;
  /** Override dot opacity (Remotion: pass frame-driven value to bypass CSS animation) */
  liveDotOpacity?: number;
  /** margin-top override (Remotion scenes control their own spacing) */
  marginTop?: number | string;
}

export const RecentActivitySection: React.FC<RecentActivitySectionProps> = ({
  isLive,
  liveDotOpacity,
  marginTop,
  // ActivityFeed props
  groups,
  modelName,
  enrichModelName,
  maxVisible,
  onSessionClick,
  onSessionsLoad,
  style,
}) => {
  return (
    <div className="activity-section" style={marginTop !== undefined ? { marginTop } : undefined}>
      <div className="activity-section-header">
        <span className="section-heading">Recent Activity</span>
        {isLive && (
          <span
            className="activity-live-dot"
            style={liveDotOpacity !== undefined ? { opacity: liveDotOpacity } : undefined}
          />
        )}
      </div>
      <ActivityFeed
        groups={groups}
        modelName={modelName}
        enrichModelName={enrichModelName}
        maxVisible={maxVisible}
        onSessionClick={onSessionClick}
        onSessionsLoad={onSessionsLoad}
        style={style}
      />
    </div>
  );
};
