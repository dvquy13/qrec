import React from 'react';
import './RecentSessionsSection.css';
import { formatRelative } from '../utils/formatRelative';

export interface RecentSession {
  id: string;
  title: string;
  project?: string;
  date?: string;
  last_message_at?: number;
  summary?: string;
}

export interface RecentSessionsSectionProps {
  sessions: RecentSession[];
  total: number;
  onSessionClick: (id: string) => void;
  onViewAll: () => void;
}

export const RecentSessionsSection: React.FC<RecentSessionsSectionProps> = ({
  sessions,
  total,
  onSessionClick,
  onViewAll,
}) => {
  return (
    <>
      <div className="dashboard-recent-header">
        <span className="section-heading">Recent Sessions</span>
      </div>

      {sessions.length === 0 ? (
        <div style={{ padding: '20px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
          No sessions indexed yet.
        </div>
      ) : (
        <>
          {sessions.slice(0, 5).map(s => {
            const relTime = s.last_message_at
              ? formatRelative(s.last_message_at)
              : (s.date || '—');
            return (
              <div
                key={s.id}
                className="dashboard-session-card"
                onClick={() => onSessionClick(s.id)}
              >
                <div className="dashboard-session-title">
                  {s.title || '(untitled)'}
                </div>
                <div className="dashboard-session-meta">
                  <span>{s.project || '—'}</span>
                  <span>·</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '11px' }}>{s.id}</span>
                  <span>·</span>
                  <span className="dashboard-session-ts">{relTime}</span>
                </div>
                {s.summary && (
                  <div className="dashboard-session-summary">
                    {s.summary.slice(0, 180)}
                  </div>
                )}
              </div>
            );
          })}
          <button className="dashboard-recent-footer" onClick={onViewAll}>
            All {total.toLocaleString()} sessions →
          </button>
        </>
      )}
    </>
  );
};
