import React from 'react';

export interface TagBadgeProps {
  text: string;
  variant: 'project' | 'enrich' | 'entity' | 'plain';
  onClick?: () => void;
}

export const TagBadge: React.FC<TagBadgeProps> = ({ text, variant, onClick }) => {
  if (variant === 'enrich') {
    return (
      <span className="enrich-tag" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
        {text}
      </span>
    );
  }
  if (variant === 'entity') {
    return (
      <span className="tag" style={{ fontFamily: 'var(--mono)', fontSize: '11px' }}>
        {text}
      </span>
    );
  }
  if (variant === 'project') {
    return (
      <span className="tag clickable-tag" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
        {text}
      </span>
    );
  }
  // 'plain'
  return <span className="tag">{text}</span>;
};
