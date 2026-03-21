import React, { useState, useCallback } from 'react';
import './ActivityFeed.css';

export interface RunEvent {
  type: 'session_indexed' | 'session_enriched';
  ts: number;
  data?: { sessionId?: string; latencyMs?: number; title?: string; summary?: string };
}

export interface RunGroup {
  type: 'index' | 'enrich' | 'model_download' | 'model_loading' |
        'index_collapsed' | 'enrich_collapsed' | 'enrich_model_download';
  running: boolean;
  ts: number;
  events: RunEvent[];
  syntheticLabel?: string;
  syntheticProgress?: { percent: number | null; label: string | null };
  // allow extra fields from activity-groups.js (count, etc.)
  count?: number;
}

export interface SessionMeta {
  id: string;
  title?: string;
  summary?: string;
}

export interface ActivityFeedProps {
  groups: RunGroup[];
  modelName?: string;
  enrichModelName?: string;
  maxVisible?: number;
  onSessionClick?: (id: string) => void;
  onSessionsLoad?: (ids: string[]) => Promise<SessionMeta[]>;
  style?: React.CSSProperties;
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return Math.round(ms) + 'ms';
  return (ms / 1000).toFixed(1) + 's';
}

function formatRelative(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

interface GroupSummary {
  label: string;
  detail: string | null;
}

function getGroupSummary(group: RunGroup): GroupSummary {
  if (group.syntheticLabel !== undefined) return { label: group.syntheticLabel, detail: null };

  const completeEvent = group.events.find(e => (e as { type: string }).type === 'index_complete' || (e as { type: string }).type === 'enrich_complete') as (RunEvent & { type: string; data?: Record<string, unknown> }) | undefined;
  const startEvent = group.events.find(e => (e as { type: string }).type === 'index_started' || (e as { type: string }).type === 'enrich_started') as (RunEvent & { type: string; data?: Record<string, unknown> }) | undefined;

  if (group.type === 'index_collapsed') {
    return { label: 'Index scan', detail: `${group.count ?? 0}× no new sessions` };
  }
  if (group.type === 'enrich_collapsed') {
    return { label: 'Enrich run', detail: `${group.count ?? 0}× nothing to enrich` };
  }
  if (group.type === 'index') {
    if (group.running) {
      const n = group.events.filter(e => e.type === 'session_indexed').length;
      return { label: 'Indexing…', detail: n > 0 ? `${n} indexed` : null };
    }
    const n = (completeEvent?.data?.newSessions as number | undefined) ?? group.events.filter(e => e.type === 'session_indexed').length;
    const ms = completeEvent?.data?.durationMs as number | undefined;
    return { label: 'Index scan', detail: `${n} new session${n === 1 ? '' : 's'}${ms ? '  ' + fmtDuration(ms) : ''}` };
  }
  if (group.type === 'enrich') {
    if (group.running) {
      const done = group.events.filter(e => e.type === 'session_enriched').length;
      const pending = (startEvent?.data?.pending as number | string | undefined) ?? '?';
      return { label: 'Enriching…', detail: `${done} / ${pending}` };
    }
    const n = (completeEvent?.data?.enriched as number | undefined) ?? group.events.filter(e => e.type === 'session_enriched').length;
    const ms = completeEvent?.data?.durationMs as number | undefined;
    return { label: 'Enrich run', detail: `${n} session${n === 1 ? '' : 's'} enriched${ms ? '  ' + fmtDuration(ms) : ''}` };
  }
  if (group.type === 'model_download') {
    return { label: 'Downloading embedding model', detail: null };
  }
  if (group.type === 'model_loading') {
    return { label: 'Loading embedding model', detail: null };
  }
  if (group.type === 'enrich_model_download') {
    return { label: 'Downloading enrich model', detail: null };
  }
  return { label: group.type, detail: null };
}

function runIcon(type: RunGroup['type']): string {
  if (type === 'index' || type === 'index_collapsed') return '⊙';
  if (type === 'enrich' || type === 'enrich_collapsed') return '✦';
  if (type === 'model_download' || type === 'enrich_model_download') return '⬇';
  if (type === 'model_loading') return '◎';
  return '◉';
}

function iconClass(type: RunGroup['type']): string {
  if (type === 'index' || type === 'index_collapsed') return 'run-icon-badge index';
  if (type === 'enrich' || type === 'enrich_collapsed') return 'run-icon-badge enrich';
  if (type === 'model_download' || type === 'enrich_model_download') return 'run-icon-badge model_download';
  if (type === 'model_loading') return 'run-icon-badge model_loading';
  return 'run-icon-badge';
}

interface ProgressBarProps {
  percent: number | null;
  label: string | null;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ percent, label }) => (
  <div className="af-progress">
    <div className="af-progress-label">
      {label && <span>{label}</span>}
      {percent != null && <strong>{percent}%</strong>}
    </div>
    <div className="af-progress-track">
      <div
        className={`af-progress-fill${percent == null ? ' af-progress-fill--indeterminate' : ''}`}
        style={percent != null ? { width: `${percent}%` } : undefined}
      />
    </div>
  </div>
);

interface RunGroupRowProps {
  group: RunGroup;
  modelName?: string;
  enrichModelName?: string;
  onSessionClick?: (id: string) => void;
  onSessionsLoad?: (ids: string[]) => Promise<SessionMeta[]>;
}

const RunGroupRow: React.FC<RunGroupRowProps> = ({
  group,
  modelName,
  enrichModelName,
  onSessionClick,
  onSessionsLoad,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [sessionMetas, setSessionMetas] = useState<Record<string, SessionMeta>>({});
  const [loadingMeta, setLoadingMeta] = useState(false);

  const { label, detail } = getGroupSummary(group);

  const subEvents = group.events.filter(e =>
    e.type === 'session_indexed' || e.type === 'session_enriched'
  );
  const hasEvents = subEvents.length > 0;

  const handleToggle = useCallback(async () => {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    if (nextExpanded && hasEvents && onSessionsLoad && !loadingMeta) {
      const ids = subEvents.map(e => e.data?.sessionId ?? '').filter(Boolean);
      if (ids.length > 0) {
        setLoadingMeta(true);
        try {
          const metas = await onSessionsLoad(ids);
          const byId: Record<string, SessionMeta> = {};
          for (const m of metas) byId[m.id] = m;
          setSessionMetas(byId);
        } catch {
          // session IDs remain as fallback
        } finally {
          setLoadingMeta(false);
        }
      }
    }
  }, [expanded, hasEvents, onSessionsLoad, loadingMeta, subEvents]);

  const modelNameForGroup = group.type === 'index' ? modelName : group.type === 'enrich' ? enrichModelName : null;

  const iconEl = group.running
    ? <span className="af-spinner-wrap"><span className="af-spinner" /></span>
    : <span className={iconClass(group.type)}>{runIcon(group.type)}</span>;

  const progressEl = group.syntheticProgress && group.running
    ? <ProgressBar percent={group.syntheticProgress.percent} label={group.syntheticProgress.label} />
    : null;

  if (!hasEvents) {
    return (
      <div className="af-group af-group--no-expand">
        <div className="af-header">
          <span className="af-ts">{formatRelative(group.ts)}</span>
          <span className="af-chevron-spacer" />
          {iconEl}
          <span className="af-label">{label}</span>
          {detail && <span className="af-detail">{detail}</span>}
        </div>
        {progressEl}
      </div>
    );
  }

  return (
    <div className={`af-group${expanded ? ' af-group--open' : ''}`}>
      <div className="af-header af-header--clickable" onClick={handleToggle}>
        <span className="af-ts">{formatRelative(group.ts)}</span>
        <span className={`af-chevron${expanded ? ' af-chevron--open' : ''}`}>›</span>
        {iconEl}
        <span className="af-label">{label}</span>
        {detail && <span className="af-detail">{detail}</span>}
      </div>
      {progressEl}
      {expanded && (
        <div className="af-events">
          {modelNameForGroup && (
            <div className="af-model-info">
              <span className="af-model-name">model: {modelNameForGroup}</span>
            </div>
          )}
          {subEvents.map((e, i) => {
            const sid = e.data?.sessionId ?? '';
            const ms = e.data?.latencyMs != null ? fmtDuration(e.data.latencyMs) : null;
            const timeStr = new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const meta = sessionMetas[sid];
            return (
              <div
                key={`${sid}-${i}`}
                className={`af-event${onSessionClick && sid ? ' af-event--clickable' : ''}`}
                onClick={onSessionClick && sid ? () => onSessionClick(sid) : undefined}
              >
                <span className="af-event-ts">{timeStr}</span>
                {meta ? (
                  <div className="af-event-info">
                    <div className="af-event-header">
                      <span className="af-event-title">{meta.title || 'Untitled session'}</span>
                    </div>
                    {meta.summary && (
                      <div className="af-event-summary">
                        {meta.summary.slice(0, 120)}{meta.summary.length > 120 ? '…' : ''}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="af-event-id">{sid}</span>
                )}
                {ms && <span className="af-event-meta">{ms}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  groups,
  modelName,
  enrichModelName,
  maxVisible = 5,
  onSessionClick,
  onSessionsLoad,
  style,
}) => {
  const [showAll, setShowAll] = useState(false);

  if (groups.length === 0) {
    return (
      <div className="af-feed" style={style}>
        <div className="af-empty">No activity yet.</div>
      </div>
    );
  }

  const visible = showAll ? groups : groups.slice(0, maxVisible);
  const hidden = groups.length - visible.length;

  return (
    <div className="af-feed" style={style}>
      {visible.map((group, i) => (
        <RunGroupRow
          key={`${group.type}-${group.ts}-${i}`}
          group={group}
          modelName={modelName}
          enrichModelName={enrichModelName}
          onSessionClick={onSessionClick}
          onSessionsLoad={onSessionsLoad}
        />
      ))}
      {!showAll && hidden > 0 && (
        <button className="af-show-more" onClick={() => setShowAll(true)}>
          Show {hidden} older run{hidden === 1 ? '' : 's'}
        </button>
      )}
    </div>
  );
};
