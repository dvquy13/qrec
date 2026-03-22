import React from 'react';
import './EnrichBlock.css';

export interface EnrichBlockProps {
  summary?: string;
  tags?: string[];
  entities?: string[];
  learnings?: string[];
  questions?: string[];
  compact?: boolean;
  showSummary?: boolean;
  showTags?: boolean;
  showEntities?: boolean;
  showLearnings?: boolean;
  showQuestions?: boolean;
  onTagClick?: (tag: string) => void;
}

export const EnrichBlock: React.FC<EnrichBlockProps> = ({
  summary,
  tags = [],
  entities = [],
  learnings = [],
  questions = [],
  compact = false,
  showSummary = true,
  showTags = true,
  showEntities = false,
  showLearnings = true,
  showQuestions = false,
  onTagClick,
}) => {
  // Determine what to render
  const shouldShowSummary = showSummary && !!summary;
  // In compact mode, tags are shown in the meta row by SessionCard — NOT in EnrichBlock
  const shouldShowTagsInBlock = !compact && showTags && tags.length > 0;
  const shouldShowEntities = showEntities && entities.length > 0;
  const shouldShowLearnings = showLearnings && learnings.length > 0;
  const shouldShowQuestions = showQuestions && questions.length > 0;

  const hasContent = shouldShowSummary || shouldShowTagsInBlock || shouldShowEntities || shouldShowLearnings || shouldShowQuestions;
  if (!hasContent) return null;

  return (
    <div className={`summary-block${compact ? ' summary-block--compact' : ''}`}>
      {shouldShowSummary && (
        <div className="summary-block-section">
          <span className="summary-block-label">Summary</span>
          <p style={{ marginTop: 4 }}>{summary}</p>
        </div>
      )}

      {(shouldShowTagsInBlock || shouldShowEntities) && (
        <div className="summary-block-tags">
          {shouldShowTagsInBlock && tags.map((t, i) => (
            <span
              key={`tag-${i}-${t}`}
              className="enrich-tag"
              onClick={() => onTagClick?.(t)}
            >
              {t}
            </span>
          ))}
          {shouldShowEntities && entities.map((e, i) => (
            <span key={`entity-${i}-${e}`} className="tag" style={{ fontFamily: 'var(--mono)', fontSize: '11px' }}>
              {e}
            </span>
          ))}
        </div>
      )}

      {shouldShowLearnings && (
        <div className="summary-block-section">
          <span className="summary-block-label">Learnings</span>
          <ul className="summary-block-list">
            {learnings.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </div>
      )}

      {shouldShowQuestions && (
        <div className="summary-block-section">
          <span className="summary-block-label">Questions answered</span>
          <ul className="summary-block-list">
            {questions.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
};
