// test/indexer.test.ts
import { test, expect, describe, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, existsSync, unlinkSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, basename } from "path";
import { indexVault, embedSummaryChunks } from "../src/indexer.ts";
import { ARCHIVE_DIR } from "../src/dirs.ts";
import type { EmbedProvider } from "../src/embed/provider.ts";
import { createTestDb, cleanupTestDb } from "./helpers.ts";

const DIMENSIONS = 768;
function makeStubEmbedder(): EmbedProvider & { callCount: number } {
  let callCount = 0;
  const v = new Float32Array(DIMENSIONS);
  v[0] = 1.0;
  return {
    dimensions: DIMENSIONS,
    get callCount() { return callCount; },
    async embed(_text: string): Promise<Float32Array> {
      callCount++;
      return v;
    },
  };
}

const FIXTURES_DIR = join(import.meta.dir, "fixtures");
const MINIMAL_JSONL = join(FIXTURES_DIR, "01234567-89ab-cdef-0123-456789abcdef.jsonl");
const SINGLE_TURN_JSONL = join(FIXTURES_DIR, "deadbeef-0000-0000-0000-000000000000.jsonl");

// Minimal 2-user-turn content (project = "testproj" from cwd)
const MINIMAL_CONTENT = [
  '{"type":"user","timestamp":"2025-02-01T10:00:00.000Z","cwd":"/tmp/testproj","message":{"role":"user","content":"Hello world"}}',
  '{"type":"assistant","timestamp":"2025-02-01T10:00:05.000Z","message":{"role":"assistant","content":[{"type":"text","text":"Hi there!"}]}}',
  '{"type":"user","timestamp":"2025-02-01T10:01:00.000Z","message":{"role":"user","content":"How are you?"}}',
  '{"type":"assistant","timestamp":"2025-02-01T10:01:05.000Z","message":{"role":"assistant","content":[{"type":"text","text":"I am fine."}]}}',
].join("\n") + "\n";

const MINIMAL_CONTENT_V2 = [
  '{"type":"user","timestamp":"2025-02-01T10:00:00.000Z","cwd":"/tmp/testproj","message":{"role":"user","content":"Hello world modified"}}',
  '{"type":"assistant","timestamp":"2025-02-01T10:00:05.000Z","message":{"role":"assistant","content":[{"type":"text","text":"Hi there modified!"}]}}',
  '{"type":"user","timestamp":"2025-02-01T10:01:00.000Z","message":{"role":"user","content":"How are you today?"}}',
  '{"type":"assistant","timestamp":"2025-02-01T10:01:05.000Z","message":{"role":"assistant","content":[{"type":"text","text":"I am great."}]}}',
].join("\n") + "\n";

// Track temp dirs created by tests for cleanup
const tempDirs: string[] = [];
afterAll(() => {
  for (const d of tempDirs) {
    try { rmSync(d, { recursive: true }); } catch { /* may not exist */ }
  }
});

describe("indexVault", () => {
  test("indexes JSONL: session, chunks, and embeddings stored", async () => {
    const { db, path } = createTestDb();
    const embedder = makeStubEmbedder();
    try {
      await indexVault(db, MINIMAL_JSONL, {}, undefined, embedder);

      const sessions = db.prepare("SELECT * FROM sessions").all();
      expect(sessions).toHaveLength(1);
      expect((sessions[0] as any).id).toBe("01234567");

      const chunks = db.prepare("SELECT * FROM chunks").all();
      expect(chunks.length).toBeGreaterThan(0);

      const vecs = db.prepare("SELECT * FROM chunks_vec").all();
      expect(vecs.length).toBe(chunks.length);

      expect(embedder.callCount).toBeGreaterThan(0);
    } finally {
      cleanupTestDb(db, path);
    }
  });

  test("skips unchanged: second call with same hash doesn't re-index", async () => {
    const { db, path } = createTestDb();
    const embedder = makeStubEmbedder();
    try {
      await indexVault(db, MINIMAL_JSONL, {}, undefined, embedder);
      const firstCallCount = embedder.callCount;

      await indexVault(db, MINIMAL_JSONL, {}, undefined, embedder);

      expect(embedder.callCount).toBe(firstCallCount);
      const count = (db.prepare("SELECT COUNT(*) as n FROM sessions").get() as any).n;
      expect(count).toBe(1);
    } finally {
      cleanupTestDb(db, path);
    }
  });

  test("force re-index: re-indexes despite matching hash", async () => {
    const { db, path } = createTestDb();
    const embedder = makeStubEmbedder();
    try {
      await indexVault(db, MINIMAL_JSONL, {}, undefined, embedder);
      const firstCallCount = embedder.callCount;

      await indexVault(db, MINIMAL_JSONL, { force: true }, undefined, embedder);

      expect(embedder.callCount).toBeGreaterThan(firstCallCount);
    } finally {
      cleanupTestDb(db, path);
    }
  });

  test("min turn filter: single-turn JSONL is skipped", async () => {
    const { db, path } = createTestDb();
    const embedder = makeStubEmbedder();
    try {
      await indexVault(db, SINGLE_TURN_JSONL, {}, undefined, embedder);

      const count = (db.prepare("SELECT COUNT(*) as n FROM sessions").get() as any).n;
      expect(count).toBe(0);
      expect(embedder.callCount).toBe(0);
    } finally {
      cleanupTestDb(db, path);
    }
  });

  test("archive: source JSONL copied to archive dir", async () => {
    const { db, path } = createTestDb();
    const embedder = makeStubEmbedder();
    // MINIMAL_JSONL has cwd="/tmp/testproject" → project = "testproject"
    const archivePath = join(ARCHIVE_DIR, "testproject", basename(MINIMAL_JSONL));
    try {
      await indexVault(db, MINIMAL_JSONL, {}, undefined, embedder);
      expect(existsSync(archivePath)).toBe(true);
    } finally {
      cleanupTestDb(db, path);
      try { unlinkSync(archivePath); } catch { /* may not exist */ }
    }
  });

  test("ON CONFLICT: preserves enrichment when hash unchanged", async () => {
    const { db, path } = createTestDb();
    const embedder = makeStubEmbedder();
    try {
      await indexVault(db, MINIMAL_JSONL, {}, undefined, embedder);

      // Simulate enrichment
      db.prepare(`
        UPDATE sessions SET summary='test summary', tags='["tag1"]', entities='["Entity1"]',
        enriched_at=1000000, enrichment_version=1 WHERE id='01234567'
      `).run();

      // Force re-index with same file (hash unchanged)
      await indexVault(db, MINIMAL_JSONL, { force: true }, undefined, embedder);

      const session = db.prepare("SELECT * FROM sessions WHERE id='01234567'").get() as any;
      expect(session.summary).toBe("test summary");
      expect(session.tags).toBe('["tag1"]');
      expect(session.enriched_at).toBe(1000000);
    } finally {
      cleanupTestDb(db, path);
    }
  });

  test("ON CONFLICT: clears enrichment when hash changes", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "qrec-idx-test-"));
    tempDirs.push(tmpDir);
    const tmpFile = join(tmpDir, "eeee1111-0000-0000-0000-000000000000.jsonl");
    writeFileSync(tmpFile, MINIMAL_CONTENT);

    const { db, path } = createTestDb();
    const embedder = makeStubEmbedder();
    try {
      await indexVault(db, tmpFile, {}, undefined, embedder);

      // Simulate enrichment
      db.prepare(`
        UPDATE sessions SET summary='old summary', enriched_at=1000000, enrichment_version=1
        WHERE id='eeee1111'
      `).run();

      // Modify file → new hash
      writeFileSync(tmpFile, MINIMAL_CONTENT_V2);

      await indexVault(db, tmpFile, {}, undefined, embedder);

      const session = db.prepare("SELECT * FROM sessions WHERE id='eeee1111'").get() as any;
      expect(session.summary).toBeNull();
      expect(session.enriched_at).toBeNull();
    } finally {
      cleanupTestDb(db, path);
    }
  });
});

describe("embedSummaryChunks", () => {
  test("embeds pending summary chunks (seq=-1)", async () => {
    const { db, path } = createTestDb();
    const embedder = makeStubEmbedder();
    try {
      db.prepare(
        "INSERT INTO sessions (id, path, project, date, title, hash, indexed_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run("aabbccdd", "/fake/path.jsonl", "testproj", "2025-01-01", null, "deadbeef", Date.now());

      db.prepare(
        "INSERT INTO chunks (id, session_id, seq, pos, text, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run("aabbccdd_summary", "aabbccdd", -1, -1, "This is a summary of the session.", Date.now());

      const before = db.prepare("SELECT COUNT(*) as n FROM chunks_vec WHERE chunk_id='aabbccdd_summary'").get() as any;
      expect(before.n).toBe(0);

      await embedSummaryChunks(db, embedder);

      const after = db.prepare("SELECT COUNT(*) as n FROM chunks_vec WHERE chunk_id='aabbccdd_summary'").get() as any;
      expect(after.n).toBe(1);
      expect(embedder.callCount).toBe(1);
    } finally {
      cleanupTestDb(db, path);
    }
  });

  test("no-op when no pending summary chunks", async () => {
    const { db, path } = createTestDb();
    const embedder = makeStubEmbedder();
    try {
      await embedSummaryChunks(db, embedder);
      expect(embedder.callCount).toBe(0);
    } finally {
      cleanupTestDb(db, path);
    }
  });
});
