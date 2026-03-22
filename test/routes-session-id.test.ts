// test/routes-session-id.test.ts
// TDD: full UUID → 8-char ID resolution in session handlers
import { test, expect, describe } from "bun:test";
import { handleSessionDetail, handleSessionMarkdown } from "../src/routes.ts";
import { createTestDb, cleanupTestDb, insertSession } from "./helpers.ts";

describe("UUID resolution in session handlers", () => {
  test("handleSessionDetail: full UUID resolves to 8-char id (not 404)", async () => {
    const { db, path } = createTestDb();
    try {
      insertSession(db, { id: "dfce70c4" });
      const res = await handleSessionDetail(db, "dfce70c4-274d-4cf0-ba6d-109ad49ee419");
      // If resolved correctly, we get past the 404 gate (parse error → 500 is fine)
      expect(res.status).not.toBe(404);
    } finally {
      cleanupTestDb(db, path);
    }
  });

  test("handleSessionDetail: 8-char id still works", async () => {
    const { db, path } = createTestDb();
    try {
      insertSession(db, { id: "dfce70c4" });
      const res = await handleSessionDetail(db, "dfce70c4");
      expect(res.status).not.toBe(404);
    } finally {
      cleanupTestDb(db, path);
    }
  });

  test("handleSessionDetail: unknown UUID returns 404", async () => {
    const { db, path } = createTestDb();
    try {
      const res = await handleSessionDetail(db, "00000000-0000-0000-0000-000000000000");
      expect(res.status).toBe(404);
    } finally {
      cleanupTestDb(db, path);
    }
  });

  test("handleSessionMarkdown: full UUID resolves to 8-char id (not 404)", async () => {
    const { db, path } = createTestDb();
    try {
      insertSession(db, { id: "abcd1234" });
      const res = await handleSessionMarkdown(db, "abcd1234-0000-0000-0000-000000000000");
      expect(res.status).not.toBe(404);
    } finally {
      cleanupTestDb(db, path);
    }
  });

  test("handleSessionMarkdown: unknown UUID returns 404", async () => {
    const { db, path } = createTestDb();
    try {
      const res = await handleSessionMarkdown(db, "00000000-0000-0000-0000-000000000000");
      expect(res.status).toBe(404);
    } finally {
      cleanupTestDb(db, path);
    }
  });
});
