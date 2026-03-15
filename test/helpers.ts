// test/helpers.ts
// Shared test utilities

import { unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { openDb } from "../src/db.ts";
import type { Database } from "bun:sqlite";

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
