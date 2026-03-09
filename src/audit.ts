// src/audit.ts
// Append-only audit log: query, results, scores, duration_ms → SQLite

import type { Database } from "bun:sqlite";
import type { SearchResult } from "./search.ts";

export interface AuditEntry {
  id: number;
  query: string;
  k: number;
  result_count: number;
  top_session_id: string | null;
  top_score: number | null;
  duration_ms: number;
  created_at: number;
}

export function migrateAudit(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS query_audit (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      query          TEXT NOT NULL,
      k              INTEGER NOT NULL,
      result_count   INTEGER NOT NULL,
      top_session_id TEXT,
      top_score      REAL,
      duration_ms    REAL NOT NULL,
      created_at     INTEGER NOT NULL
    );
  `);
}

export function logQuery(
  db: Database,
  query: string,
  k: number,
  results: SearchResult[],
  durationMs: number
): void {
  const topResult = results[0] ?? null;
  db.prepare(`
    INSERT INTO query_audit (query, k, result_count, top_session_id, top_score, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    query,
    k,
    results.length,
    topResult?.session_id ?? null,
    topResult?.score ?? null,
    durationMs,
    Date.now()
  );
}

export function getAuditEntries(db: Database, limit: number = 100): AuditEntry[] {
  return db
    .prepare(`SELECT * FROM query_audit ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as AuditEntry[];
}
