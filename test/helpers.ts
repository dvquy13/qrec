// test/helpers.ts
// Shared test utilities

import { unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { openDb } from "../src/db.ts";
import type { Database } from "bun:sqlite";

const DIMENSIONS = 768;
// Stub unit vector matching src/embed/stub.ts
const STUB_UNIT_VECTOR = new Float32Array(DIMENSIONS);
STUB_UNIT_VECTOR[0] = 1.0;

export function createTestDb(): { db: Database; path: string } {
  const path = join(
    tmpdir(),
    `qrec-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
  );
  const db = openDb(path);
  return { db, path };
}

export function cleanupTestDb(db: Database, path: string): void {
  db.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    try { unlinkSync(path + suffix); } catch { /* may not exist */ }
  }
}

export function insertSession(
  db: Database,
  opts: {
    id: string;
    path?: string;
    project?: string;
    date?: string;
    title?: string;
    hash?: string;
    indexed_at?: number;
    last_message_at?: number | null;
  }
): void {
  db.prepare(`
    INSERT INTO sessions (id, path, project, date, title, hash, indexed_at, last_message_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    opts.id,
    opts.path ?? "/test/session.jsonl",
    opts.project ?? "test-project",
    opts.date ?? "2024-01-01",
    opts.title ?? null,
    opts.hash ?? "deadbeef",
    opts.indexed_at ?? Date.now(),
    opts.last_message_at ?? null
  );
}

export function insertChunkWithVec(
  db: Database,
  opts: {
    id: string;          // "{session_id}_{seq}"
    session_id: string;
    seq: number;
    pos?: number;
    text: string;
    embedding?: Float32Array;
  }
): void {
  const embedding = opts.embedding ?? STUB_UNIT_VECTOR;
  db.prepare(`
    INSERT OR REPLACE INTO chunks (id, session_id, seq, pos, text, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(opts.id, opts.session_id, opts.seq, opts.pos ?? 0, opts.text, Date.now());
  db.prepare(`
    INSERT OR REPLACE INTO chunks_vec (chunk_id, embedding)
    VALUES (?, ?)
  `).run(opts.id, Buffer.from(embedding.buffer));
}
