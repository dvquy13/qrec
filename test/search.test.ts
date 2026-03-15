// test/search.test.ts
import { test, expect, describe } from "bun:test";
import { search, extractHighlightSnippets } from "../src/search.ts";
import type { EmbedProvider } from "../src/embed/provider.ts";
import { createTestDb, cleanupTestDb, insertSession, insertChunkWithVec } from "./helpers.ts";

// Stub embedder: fixed unit vector [1, 0, 0, ...] — no model, no network
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

describe("search", () => {
  test("empty DB returns []", async () => {
    const { db, path } = createTestDb();
    try {
      const results = await search(db, makeStubEmbedder(), "anything");
      expect(results).toEqual([]);
    } finally {
      cleanupTestDb(db, path);
    }
  });

  test("returns results sorted by score descending", async () => {
    const { db, path } = createTestDb();
    try {
      insertSession(db, { id: "aaaa0001" });
      insertChunkWithVec(db, { id: "aaaa0001_0", session_id: "aaaa0001", seq: 0, text: "hello world greeting" });
      insertSession(db, { id: "bbbb0002" });
      insertChunkWithVec(db, { id: "bbbb0002_0", session_id: "bbbb0002", seq: 0, text: "hello world salutation" });

      const results = await search(db, makeStubEmbedder(), "hello world", 5);
      expect(results.length).toBeGreaterThan(0);
      // Scores should be non-increasing
      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      }
    } finally {
      cleanupTestDb(db, path);
    }
  });

  test("BM25: text-matching session ranks above no-match session", async () => {
    const { db, path } = createTestDb();
    try {
      // Session A: contains the query term
      insertSession(db, { id: "aaaa0001" });
      insertChunkWithVec(db, { id: "aaaa0001_0", session_id: "aaaa0001", seq: 0, text: "rustacean ownership borrow checker" });
      // Session B: completely unrelated
      insertSession(db, { id: "bbbb0002" });
      insertChunkWithVec(db, { id: "bbbb0002_0", session_id: "bbbb0002", seq: 0, text: "completely unrelated topic about cooking recipes" });

      const results = await search(db, makeStubEmbedder(), "rustacean", 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].session_id).toBe("aaaa0001");
    } finally {
      cleanupTestDb(db, path);
    }
  });

  test("FTS5 sanitization: special chars don't crash", async () => {
    const { db, path } = createTestDb();
    try {
      insertSession(db, { id: "cccc0003" });
      insertChunkWithVec(db, { id: "cccc0003_0", session_id: "cccc0003", seq: 0, text: "some normal text content here" });

      // These chars would crash FTS5 without sanitization
      for (const badQuery of ["file.js", "/path/to/file", "(function)", "test:value", "foo && bar"]) {
        await expect(search(db, makeStubEmbedder(), badQuery)).resolves.toBeDefined();
      }
    } finally {
      cleanupTestDb(db, path);
    }
  });

  test("MAX aggregation: 1 high-relevance chunk beats 5 medium-relevance chunks", async () => {
    const { db, path } = createTestDb();
    try {
      // Session A: 1 chunk with a unique BM25-matching term (always gets BM25 rank 1)
      insertSession(db, { id: "aaaa0001" });
      insertChunkWithVec(db, { id: "aaaa0001_0", session_id: "aaaa0001", seq: 0, text: "xylophonist" });

      // Session B: 5 chunks with no BM25 match — only KNN contribution
      insertSession(db, { id: "bbbb0002" });
      for (let i = 0; i < 5; i++) {
        insertChunkWithVec(db, {
          id: `bbbb0002_${i}`, session_id: "bbbb0002", seq: i,
          text: `unrelated cooking recipe step ${i} with many extra words to dilute document`,
        });
      }

      const results = await search(db, makeStubEmbedder(), "xylophonist", 5);
      expect(results.length).toBeGreaterThan(0);
      // Session A wins because BM25(rank1) + KNN > KNN alone, regardless of KNN tie-break order
      expect(results[0].session_id).toBe("aaaa0001");
    } finally {
      cleanupTestDb(db, path);
    }
  });

  test("query caching: second identical query skips embed call", async () => {
    const { db, path } = createTestDb();
    try {
      insertSession(db, { id: "aaaa0001" });
      insertChunkWithVec(db, { id: "aaaa0001_0", session_id: "aaaa0001", seq: 0, text: "hello world" });

      const embedder = makeStubEmbedder();

      await search(db, embedder, "hello");
      expect(embedder.callCount).toBe(1);

      // Same query: embed should be skipped (cache hit)
      await search(db, embedder, "hello");
      expect(embedder.callCount).toBe(1);

      // Different query: embed is called again
      await search(db, embedder, "world");
      expect(embedder.callCount).toBe(2);

      // Verify cache table has 2 entries (one per unique query)
      const cacheCount = db.prepare("SELECT COUNT(*) as n FROM query_cache").get() as { n: number };
      expect(cacheCount.n).toBe(2);
    } finally {
      cleanupTestDb(db, path);
    }
  });

  test("result includes session metadata", async () => {
    const { db, path } = createTestDb();
    try {
      insertSession(db, {
        id: "aaaa0001",
        project: "my-project",
        date: "2024-03-15",
        title: "Test Session",
        indexed_at: 1710000000000,
      });
      insertChunkWithVec(db, { id: "aaaa0001_0", session_id: "aaaa0001", seq: 0, text: "unique keyword zyxwvuts" });

      const results = await search(db, makeStubEmbedder(), "zyxwvuts", 5);
      expect(results.length).toBe(1);
      const r = results[0];
      expect(r.session_id).toBe("aaaa0001");
      expect(r.project).toBe("my-project");
      expect(r.date).toBe("2024-03-15");
      expect(r.title).toBe("Test Session");
      expect(r.score).toBeGreaterThan(0);
      expect(r.preview).toBeTruthy();
      expect(r.latency).toBeDefined();
    } finally {
      cleanupTestDb(db, path);
    }
  });
});

describe("extractHighlightSnippets", () => {
  test("no <mark> tags — returns fallback slice (first 2×window chars)", () => {
    const html = "a".repeat(500);
    const result = extractHighlightSnippets(html, 150);
    expect(result).toHaveLength(300);
    expect(result).toBe("a".repeat(300));
  });

  test("single <mark> — includes mark and surrounding context", () => {
    const prefix = "x".repeat(200);
    const suffix = "y".repeat(200);
    const html = `${prefix}<mark>hello</mark>${suffix}`;
    const result = extractHighlightSnippets(html, 10);
    expect(result).toContain("<mark>hello</mark>");
    // Should be a windowed snippet, not the entire string
    expect(result.length).toBeLessThan(html.length);
  });

  test("overlapping windows are merged into a single snippet", () => {
    // Two marks close together — windows overlap and should merge
    const html = "abc <mark>foo</mark> def <mark>bar</mark> ghi";
    const result = extractHighlightSnippets(html, 50);
    expect(result).toContain("<mark>foo</mark>");
    expect(result).toContain("<mark>bar</mark>");
    // No gap indicator when merged
    expect(result).not.toContain("<span class='snippet-gap'>…</span>");
  });

  test("distant marks produce multiple snippets joined by gap indicator", () => {
    const far = "x".repeat(500);
    const html = `<mark>first</mark>${far}<mark>second</mark>`;
    const result = extractHighlightSnippets(html, 10);
    expect(result).toContain("<mark>first</mark>");
    expect(result).toContain("<mark>second</mark>");
    expect(result).toContain("<span class='snippet-gap'>…</span>");
  });
});
