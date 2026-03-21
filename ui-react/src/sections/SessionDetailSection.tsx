import React, { useState } from 'react';
import './SessionDetailSection.css';
import { EnrichBlock } from '../components/EnrichBlock/EnrichBlock';
import { marked } from 'marked';

export interface Turn {
  role: 'user' | 'assistant';
  text: string;
  tools: string[];
  thinking: string[];
  timestamp: string | null;
}

export interface SessionDetailSectionProps {
  id: string;
  title: string;
  project?: string;
  date?: string;
  durationSeconds?: number;
  summary?: string;
  tags?: string[];
  entities?: string[];
  learnings?: string[];
  questions?: string[];

  turns: Turn[];

  onProjectClick?: (project: string) => void;
  onTagClick?: (tag: string) => void;
}

interface AgentGroup {
  type: 'agent';
  turns: Turn[];
}

interface UserGroup {
  type: 'user';
  turn: Turn;
}

type TurnGroup = UserGroup | AgentGroup;

function groupTurns(turns: Turn[]): TurnGroup[] {
  const groups: TurnGroup[] = [];
  let i = 0;
  while (i < turns.length) {
    if (turns[i].role === 'user') {
      groups.push({ type: 'user', turn: turns[i] });
      i++;
    } else {
      const agentTurns: Turn[] = [];
      while (i < turns.length && turns[i].role === 'assistant') {
        agentTurns.push(turns[i]);
        i++;
      }
      groups.push({ type: 'agent', turns: agentTurns });
    }
  }
  return groups;
}

function renderMarkdown(text: string): string {
  try {
    return marked.parse(text, { breaks: true, gfm: true }) as string;
  } catch {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

const UserTurn: React.FC<{ turn: Turn }> = ({ turn }) => (
  <div className="turn user">
    <div className="turn-role">User</div>
    <div
      className="turn-text"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(turn.text) }}
    />
    {turn.timestamp && (
      <div className="turn-ts">
        {new Date(turn.timestamp).toLocaleString()}
      </div>
    )}
  </div>
);

const AgentTurn: React.FC<{ turns: Turn[] }> = ({ turns }) => {
  const allTools = turns.flatMap(t => t.tools ?? []);
  const allThinking = turns.flatMap(t => t.thinking ?? []);
  const texts = turns.map(t => t.text).filter(Boolean);
  const timestamps = turns.map(t => t.timestamp).filter(Boolean) as string[];
  const lastTs = timestamps.length > 0 ? timestamps[timestamps.length - 1] : null;

  return (
    <div className="turn assistant">
      <div className="turn-role">Agent</div>

      {texts.length > 0 && (
        <div className="turn-text">
          {texts.map((text, i) => (
            <React.Fragment key={i}>
              {i > 0 && <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '10px 0' }} />}
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
            </React.Fragment>
          ))}
        </div>
      )}

      {allThinking.length > 0 && (
        <details className="agent-thinking">
          <summary>Thinking ({allThinking.length})</summary>
          <div className="agent-thinking-body">
            {allThinking.join('\n\n---\n\n')}
          </div>
        </details>
      )}

      {allTools.length > 0 && (
        <details className="agent-actions">
          <summary>{allTools.length} tool call{allTools.length === 1 ? '' : 's'}</summary>
          <div className="agent-actions-body">
            {allTools.map((tool, i) => (
              <details key={i} className="tool-detail">
                <summary>{tool}</summary>
                <div className="tool-content">{tool}</div>
              </details>
            ))}
          </div>
        </details>
      )}

      {lastTs && (
        <div className="turn-ts">
          {new Date(lastTs).toLocaleString()}
        </div>
      )}
    </div>
  );
};

// ── Decomposed sub-components (for Remotion demo scenes) ─────────────────────
// These export the same building blocks that SessionDetailSection uses internally,
// so demo scenes can compose them independently (e.g. animate EnrichBlock in place).

export const SessionDetailHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="detail-header">
    <div className="detail-title">{title || '(untitled)'}</div>
  </div>
);

export interface SessionDetailMetaProps {
  id: string;
  project?: string;
  date?: string;
  turnCount?: number;
  onProjectClick?: (project: string) => void;
}

export const SessionDetailMeta: React.FC<SessionDetailMetaProps> = ({
  id, project, date, turnCount = 0, onProjectClick,
}) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <div className="detail-meta">
      <span className="tag clickable-tag" onClick={() => onProjectClick?.(project ?? '')}>
        {project ?? '—'}
      </span>
      <span className="tag clickable-tag">{date ?? '—'}</span>
      <span className="tag session-id">
        {id}
        <button className="copy-btn" title="Copy session UUID" onClick={handleCopy}>
          {copied ? '✓' : '⎘'}
        </button>
      </span>
      <span className="tag">{turnCount} turns</span>
    </div>
  );
};

export const SessionTurns: React.FC<{ turns: Turn[] }> = ({ turns }) => {
  const groups = groupTurns(turns);
  return (
    <div className="turns">
      {turns.length === 0 ? (
        <div className="empty-state">No turns found in this session.</div>
      ) : (
        groups.map((group, i) =>
          group.type === 'user' ? (
            <UserTurn key={i} turn={group.turn} />
          ) : (
            <AgentTurn key={i} turns={group.turns} />
          )
        )
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

export const SessionDetailSection: React.FC<SessionDetailSectionProps> = ({
  id,
  title,
  project,
  date,
  summary,
  tags,
  entities,
  learnings,
  questions,
  turns,
  onProjectClick,
  onTagClick,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  const groups = groupTurns(turns);

  return (
    <>
      <div className="detail-header">
        <div className="detail-title">{title || '(untitled)'}</div>
      </div>

      <div className="detail-meta">
        <span
          className="tag clickable-tag"
          onClick={() => onProjectClick?.(project || '')}
        >
          {project || '—'}
        </span>
        <span
          className="tag clickable-tag"
        >
          {date || '—'}
        </span>
        <span className="tag session-id">
          {id}
          <button
            className="copy-btn"
            title="Copy session UUID"
            onClick={handleCopy}
          >
            {copied ? '✓' : '⎘'}
          </button>
        </span>
        <span className="tag">{turns.length} turns</span>
      </div>

      <EnrichBlock
        summary={summary}
        tags={tags}
        entities={entities}
        learnings={learnings}
        questions={questions}
        showSummary={!!summary}
        showTags={!!tags?.length}
        showEntities={!!entities?.length}
        showLearnings={!!learnings?.length}
        showQuestions={!!questions?.length}
        onTagClick={onTagClick}
      />

      <div className="turns">
        {turns.length === 0 ? (
          <div className="empty-state">No turns found in this session.</div>
        ) : (
          groups.map((group, i) =>
            group.type === 'user' ? (
              <UserTurn key={i} turn={group.turn} />
            ) : (
              <AgentTurn key={i} turns={group.turns} />
            )
          )
        )}
      </div>
    </>
  );
};
