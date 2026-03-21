import React from 'react';
import './SessionCard.css';
import { EnrichBlock } from '../EnrichBlock/EnrichBlock';
import { formatRelative } from '../../utils/formatRelative';

export interface SessionCardProps {
  id: string;
  title: string;
  project?: string;
  date?: string;
  last_message_at?: number;
  summary?: string;
  tags?: string[];
  entities?: string[];
  learnings?: string[];
  questions?: string[];
  score?: number;
  showScore?: boolean;
  preview?: string;
  showSummary?: boolean;
  showTags?: boolean;
  showEntities?: boolean;
  showLearnings?: boolean;
  showQuestions?: boolean;
  onClick?: () => void;
  onProjectClick?: (project: string) => void;
  onTagClick?: (tag: string) => void;
  style?: React.CSSProperties;
}

export const SessionCard: React.FC<SessionCardProps> = ({
  id,
  title,
  project,
  date,
  last_message_at,
  summary,
  tags = [],
  entities = [],
  learnings = [],
  questions = [],
  score,
  showScore = false,
  preview,
  showSummary = false,
  showTags = false,
  showEntities = false,
  showLearnings = false,
  showQuestions = false,
  onClick,
  onProjectClick,
  onTagClick,
  style,
}) => {
  // Compact tag pills in meta row (only if showTags is true)
  const metaTagPills = showTags ? tags.map((t, i) => (
    <span
      key={`tag-${i}-${t}`}
      className="enrich-tag"
      onClick={(e) => { e.stopPropagation(); onTagClick?.(t); }}
    >
      {t}
    </span>
  )) : [];

  return (
    <div
      className="session-card"
      onClick={onClick}
      data-qrec-card={id}
      style={style}
    >
      <div className="session-card-body">
        <div className="session-card-title">{title || '(untitled)'}</div>
        <div className="session-card-meta">
          <span
            className="tag clickable-tag"
            onClick={(e) => { e.stopPropagation(); onProjectClick?.(project || ''); }}
          >
            {project || '—'}
          </span>
          <span className="tag clickable-tag">{date || '—'}</span>
          {last_message_at && (
            <span className="session-ts">{formatRelative(last_message_at)}</span>
          )}
          <span className="session-id">{id}</span>
          {metaTagPills}
          {showScore && score !== undefined && (
            <span className="session-card-score" style={{ marginLeft: 'auto' }}>{score.toFixed(4)}</span>
          )}
        </div>

        <EnrichBlock
          compact
          summary={summary}
          tags={tags}
          entities={entities}
          learnings={learnings}
          questions={questions}
          showSummary={showSummary}
          showTags={false}
          showEntities={showEntities}
          showLearnings={showLearnings}
          showQuestions={showQuestions}
          onTagClick={onTagClick}
        />

        {preview && (
          <div
            className="result-snippet"
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        )}
      </div>
      <div className="session-card-arrow">›</div>
    </div>
  );
};
