// Shared data for the c0ffee04 "Archive JSONL" session used by EnrichDetail and SearchDemo.
import {type Turn} from '../../../ui-react/src/sections/SessionDetailSection';

export const SESSION_ID = 'c0ffee04';
// RAW_TITLE: truncated first user message — what qrec shows before enrichment
export const RAW_TITLE = 'How can we ensure old sessions stay\u2026';
export const SESSION_TITLE = 'Archive JSONL on index for session durability';
export const SESSION_PROJECT = 'qrec';
export const SESSION_DATE = '2026-03-13';
export const SESSION_SUMMARY =
  'Added archiveJsonl() in indexer.ts to copy each JSONL to ~/.qrec/archive/ before indexing.';
export const SESSION_TAGS = ['indexer', 'durability', 'archive'];
export const SESSION_LEARNINGS = [
  'JSONL files disappear silently — never assume source files are durable.',
  'Self-copy guard is essential: if source is already inside ARCHIVE_DIR, skip to avoid ENOENT.',
];
export const SESSION_QUESTIONS = [
  'What happens when archiveJsonl() is called on a path already inside ARCHIVE_DIR?',
];

export const MOCK_TURNS: Turn[] = [
  {
    role: 'user',
    text: 'How can we ensure old sessions stay queryable after Claude Code deletes their source JSONL files?',
    tools: [],
    thinking: [],
    timestamp: '2026-03-13T11:00:00Z',
  },
  {
    role: 'assistant',
    text: 'Added `archiveJsonl()` to `indexer.ts` — copies each JSONL to `~/.qrec/archive/<project>/` before indexing. Self-copy guard: skips if source is already inside `ARCHIVE_DIR` to prevent ENOENT.',
    tools: ['Read: src/indexer.ts', 'Edit: src/indexer.ts'],
    thinking: [],
    timestamp: '2026-03-13T11:05:00Z',
  },
];

// CSS injected into .enrich-animated to style live-typed enrichment fields in blue.
export const ENRICH_ANIMATED_CSS = `
  .enrich-animated .summary-block-label {
    color: rgb(0, 98, 168) !important;
    opacity: 1 !important;
  }
  .enrich-animated .summary-block p,
  .enrich-animated .summary-block-list li {
    color: rgb(0, 98, 168) !important;
  }
  .enrich-animated .enrich-tag {
    background: rgba(0, 98, 168, 0.08) !important;
    color: rgb(0, 98, 168) !important;
    border-color: rgba(0, 98, 168, 0.25) !important;
  }
`;
