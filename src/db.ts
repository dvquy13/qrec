// src/db.ts
// SQLite schema, migrations, and open/close helpers
// Uses bun:sqlite with Homebrew SQLite for extension loading support

import { Database } from "bun:sqlite";
import { getLoadablePath } from "sqlite-vec";
import { mkdirSync, statSync } from "fs";
import { DB_PATH } from "./dirs.ts";

export { Database };

export const DEFAULT_DB_PATH = DB_PATH;

// Candidates for Homebrew SQLite (supports dynamic extension loading)
function findHomebrewSQLite(): string | null {
  const brewPrefix = process.env.BREW_PREFIX || process.env.HOMEBREW_PREFIX;
  const candidates: string[] = [];

  if (brewPrefix) {
    candidates.push(`${brewPrefix}/opt/sqlite/lib/libsqlite3.dylib`);
    candidates.push(`${brewPrefix}/lib/libsqlite3.dylib`);
  }

  // Common Homebrew locations
  candidates.push("/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib");
  candidates.push("/usr/local/opt/sqlite/lib/libsqlite3.dylib");

  for (const candidate of candidates) {
    try {
      if (statSync(candidate).size > 0) {
        return candidate;
      }
    } catch {
      // Not found
    }
  }

  return null;
}

// Only override SQLite on macOS — Homebrew build required for extension loading.
// Linux system SQLite supports loadExtension() natively.
if (process.platform === "darwin") {
  const homebrewSQLite = findHomebrewSQLite();
  if (!homebrewSQLite) {
    throw new Error(
      "sqlite-vec requires a Homebrew SQLite build that supports dynamic extension loading. " +
      "Install with: brew install sqlite\n" +
      "Then set BREW_PREFIX if Homebrew is in a non-standard location."
    );
  }
  Database.setCustomSQLite(homebrewSQLite);
}

const VEC_EXTENSION_PATH = getLoadablePath();

export function openDb(path: string = DEFAULT_DB_PATH): Database {
  // Ensure parent directory exists
  const dir = path.replace(/\/[^/]+$/, "");
  mkdirSync(dir, { recursive: true });

  const db = new Database(path);

  // Load sqlite-vec extension
  db.loadExtension(VEC_EXTENSION_PATH);

  // Performance settings
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA cache_size = -32000"); // 32MB cache
  db.exec("PRAGMA foreign_keys = ON");

  // Run migrations
  migrate(db);

  return db;
}

export function closeDb(db: Database): void {
  db.close();
}

function migrate(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      id          TEXT PRIMARY KEY,
      session_id  TEXT NOT NULL,
      seq         INTEGER NOT NULL,
      pos         INTEGER NOT NULL,
      text        TEXT NOT NULL,
      created_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_session_id ON chunks(session_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_seq ON chunks(seq);

    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      path        TEXT NOT NULL,
      project     TEXT NOT NULL,
      date        TEXT NOT NULL,
      title       TEXT,
      hash        TEXT NOT NULL,
      indexed_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_date    ON sessions(date);
    CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project);

    CREATE TABLE IF NOT EXISTS query_cache (
      query_hash  TEXT PRIMARY KEY,
      embedding   BLOB NOT NULL,
      created_at  INTEGER NOT NULL
    );

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

  // Enrichment columns on sessions (idempotent — ignore if already exist)
  for (const col of [
    "ALTER TABLE sessions ADD COLUMN summary TEXT",
    "ALTER TABLE sessions ADD COLUMN tags TEXT",
    "ALTER TABLE sessions ADD COLUMN entities TEXT",
    "ALTER TABLE sessions ADD COLUMN enriched_at INTEGER",
    "ALTER TABLE sessions ADD COLUMN enrichment_version INTEGER",
    "ALTER TABLE sessions ADD COLUMN learnings TEXT",
    "ALTER TABLE sessions ADD COLUMN questions TEXT",
    "ALTER TABLE sessions ADD COLUMN duration_seconds INTEGER",
    "ALTER TABLE sessions ADD COLUMN last_message_at INTEGER",
  ]) {
    try { db.exec(col); } catch { /* column already exists */ }
  }

  // FTS5 virtual table — content='chunks' means FTS5 reads from chunks table
  // Column names must match the content table (chunks.session_id, chunks.text)
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
      session_id,
      text,
      content='chunks',
      content_rowid='rowid'
    );
  `);

  // sqlite-vec virtual table for vector search
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(
      chunk_id TEXT PRIMARY KEY,
      embedding FLOAT[768] distance_metric=cosine
    );
  `);

  // FTS5 triggers to keep content table in sync
  // Note: bun:sqlite supports triggers
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
      INSERT INTO chunks_fts(rowid, session_id, text) VALUES (new.rowid, new.session_id, new.text);
    END;

    CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
      INSERT INTO chunks_fts(chunks_fts, rowid, session_id, text) VALUES ('delete', old.rowid, old.session_id, old.text);
    END;

    CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
      INSERT INTO chunks_fts(chunks_fts, rowid, session_id, text) VALUES ('delete', old.rowid, old.session_id, old.text);
      INSERT INTO chunks_fts(rowid, session_id, text) VALUES (new.rowid, new.session_id, new.text);
    END;
  `);
}
