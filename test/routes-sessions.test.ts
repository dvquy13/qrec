// test/routes-sessions.test.ts
import { test, expect, describe } from "bun:test";
import { handleSessions } from "../src/routes.ts";
import { createTestDb, cleanupTestDb, insertSession } from "./helpers.ts";

function makeUrl(params: Record<string, string> = {}): URL {
  const u = new URL("http://localhost:25927/sessions");
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u;
}

describe("handleSessions", () => {
  test("returns sessions sorted by last_message_at DESC", async () => {
    const { db, path } = createTestDb();
    try {
      insertSession(db, { id: "aaaa0001", last_message_at: 1000 });
      insertSession(db, { id: "bbbb0002", last_message_at: 3000 });
      insertSession(db, { id: "cccc0003", last_message_at: 2000 });

      const res = handleSessions(db, makeUrl());
      const data = await res.json() as { sessions: Array<{ id: string }> };
      const ids = data.sessions.map(s => s.id);
      expect(ids).toEqual(["bbbb0002", "cccc0003", "aaaa0001"]);
    } finally {
      cleanupTestDb(db, path);
    }
  });

  test("falls back to indexed_at when last_message_at is null", async () => {
    const { db, path } = createTestDb();
    try {
      insertSession(db, { id: "aaaa0001", indexed_at: 1000, last_message_at: null });
      insertSession(db, { id: "bbbb0002", indexed_at: 3000, last_message_at: null });

      const res = handleSessions(db, makeUrl());
      const data = await res.json() as { sessions: Array<{ id: string }> };
      expect(data.sessions[0].id).toBe("bbbb0002");
    } finally {
      cleanupTestDb(db, path);
    }
  });

  test("respects ?limit param — returns at most N sessions", async () => {
    const { db, path } = createTestDb();
    try {
      for (let i = 0; i < 5; i++) {
        insertSession(db, { id: `aaaa000${i}`, last_message_at: i * 1000 });
      }

      const res = handleSessions(db, makeUrl({ limit: "2" }));
      const data = await res.json() as { sessions: Array<{ id: string }>; total: number };
      expect(data.sessions.length).toBe(2);
      expect(data.total).toBe(5); // total counts all, not just page
    } finally {
      cleanupTestDb(db, path);
    }
  });

  test("no-arg call (bare browse) returns K most recent sessions", async () => {
    const { db, path } = createTestDb();
    try {
      // Insert 15 sessions with ascending timestamps
      for (let i = 0; i < 15; i++) {
        insertSession(db, { id: `sess${String(i).padStart(4, "0")}`, last_message_at: i * 1000 });
      }

      // Default limit is 10 (k=10 from CLI default)
      const res = handleSessions(db, makeUrl({ limit: "10" }));
      const data = await res.json() as { sessions: Array<{ id: string }>; total: number };
      expect(data.sessions.length).toBe(10);
      expect(data.total).toBe(15);
      // Most recent first: sess0014, sess0013, ...
      expect(data.sessions[0].id).toBe("sess0014");
      expect(data.sessions[9].id).toBe("sess0005");
    } finally {
      cleanupTestDb(db, path);
    }
  });
});
