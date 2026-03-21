import React, { useEffect, useRef } from 'react';
import './SessionsSection.css';
import { SessionCard, SessionCardProps } from '../components/SessionCard';

export interface SessionsSectionProps {
  // Search bar (for Remotion — web app keeps its own search bar in index.html)
  query?: string;
  onQueryChange?: (q: string) => void;
  onSearch?: () => void;
  onClearSearch?: () => void;

  // Results
  sessions: SessionCardProps[];
  total: number;
  isLoading?: boolean;
  isEmpty?: boolean;
  latency?: {
    bm25Ms: number;
    embedMs: number;
    knnMs: number;
    fusionMs: number;
    totalMs: number;
  };

  // Field visibility
  showFields?: {
    summary: boolean;
    tags: boolean;
    entities: boolean;
    learnings: boolean;
    questions: boolean;
  };

  // Callbacks
  onSessionClick?: (id: string) => void;
  onProjectClick?: (project: string) => void;
  onTagClick?: (tag: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export const SessionsSection: React.FC<SessionsSectionProps> = ({
  query,
  onSearch,
  onClearSearch,
  sessions,
  isLoading,
  isEmpty,
  latency,
  showFields,
  onSessionClick,
  onProjectClick,
  onTagClick,
  onLoadMore,
  hasMore,
}) => {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onLoadMore || !hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onLoadMore();
      },
      { rootMargin: '300px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  if (isLoading) {
    return <div className="loading-state"><span className="spinner"></span></div>;
  }

  return (
    <>
      {/* Optional search bar — shown in Remotion scenes, hidden in web app (handled by index.html) */}
      {onSearch && (
        <div className="search-bar" style={{ marginBottom: 16 }}>
          <input
            type="text"
            value={query ?? ''}
            placeholder="Search sessions…"
            readOnly
          />
          <button onClick={onSearch}>Search</button>
          {onClearSearch && query && (
            <button onClick={onClearSearch}>✕</button>
          )}
        </div>
      )}

      {/* Latency bar — for Remotion scenes */}
      {latency && (
        <div className="latency-bar" style={{ display: 'flex' }}>
          <span>BM25 <strong>{latency.bm25Ms.toFixed(1)}ms</strong></span>
          <span>Embed <strong>{latency.embedMs.toFixed(1)}ms</strong></span>
          <span>KNN <strong>{latency.knnMs.toFixed(1)}ms</strong></span>
          <span>Fusion <strong>{latency.fusionMs.toFixed(1)}ms</strong></span>
          <span>Total <strong>{latency.totalMs.toFixed(1)}ms</strong></span>
        </div>
      )}

      {isEmpty || sessions.length === 0 ? (
        <div className="empty-state">
          {isEmpty ? 'No results found.' : 'No sessions found.'}
        </div>
      ) : (
        <>
          <div className="search-grid" id="sessions-grid">
            {sessions.map(s => (
              <SessionCard
                key={s.id}
                {...s}
                showSummary={showFields?.summary ?? s.showSummary}
                showTags={showFields?.tags ?? s.showTags}
                showEntities={showFields?.entities ?? s.showEntities}
                showLearnings={showFields?.learnings ?? s.showLearnings}
                showQuestions={showFields?.questions ?? s.showQuestions}
                onClick={onSessionClick ? () => onSessionClick(s.id) : s.onClick}
                onProjectClick={onProjectClick ?? s.onProjectClick}
                onTagClick={onTagClick ?? s.onTagClick}
              />
            ))}
          </div>
          {hasMore && <div id="sessions-sentinel" ref={sentinelRef} />}
        </>
      )}
    </>
  );
};
