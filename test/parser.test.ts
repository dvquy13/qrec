// test/parser.test.ts
import { test, expect, describe, afterAll } from "bun:test";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  parseSession,
  extractChunkText,
  renderMarkdown,
  type ParsedSession,
} from "../src/parser.ts";

const FIXTURES = join(import.meta.dir, "fixtures");
const MINIMAL = join(FIXTURES, "01234567-89ab-cdef-0123-456789abcdef.jsonl");
const WITH_THINKING = join(FIXTURES, "aaaabbbb-cccc-dddd-eeee-ffffffffffff.jsonl");
const SINGLE_TURN = join(FIXTURES, "deadbeef-0000-0000-0000-000000000000.jsonl");

// Temp files created by tests that need custom JSONL
const tempFiles: string[] = [];
afterAll(() => {
  for (const f of tempFiles) {
    try { unlinkSync(f); } catch { /* may not exist */ }
  }
});

function writeTempSession(lines: object[]): string {
  const path = join(tmpdir(), `11111111-test-0000-0000-000000000000.jsonl`);
  writeFileSync(path, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  tempFiles.push(path);
  return path;
}

// ---------------------------------------------------------------------------
// parseSession
// ---------------------------------------------------------------------------

describe("parseSession", () => {
  test("basic parse: session_id, project, date, title, turn count, hash", async () => {
    const parsed = await parseSession(MINIMAL);

    expect(parsed.session_id).toBe("01234567");
    expect(parsed.project).toBe("testproject");
    expect(parsed.date).toBe("2025-01-15");
    expect(parsed.title).toBe("Hello, can you help me with this?");
    expect(parsed.turns).toHaveLength(4); // 2 user + 2 assistant
    expect(parsed.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.path).toBe(MINIMAL);
  });

  test("thinking blocks → Turn.thinking[] populated", async () => {
    const parsed = await parseSession(WITH_THINKING);

    const assistantTurns = parsed.turns.filter((t) => t.role === "assistant");
    // First assistant turn has a thinking block
    expect(assistantTurns[0].thinking).toHaveLength(1);
    expect(assistantTurns[0].thinking[0]).toContain("sorting approach");
    // Second assistant turn has no thinking
    expect(assistantTurns[1].thinking).toHaveLength(0);
  });

  test("tool summarization → Turn.tools contains 'Bash: `cmd`' format", async () => {
    const parsed = await parseSession(WITH_THINKING);

    const assistantTurns = parsed.turns.filter((t) => t.role === "assistant");
    expect(assistantTurns[0].tools).toHaveLength(1);
    expect(assistantTurns[0].tools[0]).toBe("Bash: `ls /foo`");
    expect(assistantTurns[1].tools).toHaveLength(0);
  });

  test("tool_result user turns are skipped", async () => {
    const parsed = await parseSession(WITH_THINKING);

    // with-thinking has 1 real user turn + 1 tool_result user turn (skipped)
    const userTurns = parsed.turns.filter((t) => t.role === "user");
    expect(userTurns).toHaveLength(1);
    expect(userTurns[0].text).toBe("Implement a sorting algorithm");
  });

  test("duration gap-capping → gaps > 15 min are capped at 15 min", async () => {
    const parsed = await parseSession(WITH_THINKING);
    // T1→T2: 10s, T2→T3: 1200s (capped to 900s), T3→T4: 30s → total 940s
    expect(parsed.duration_seconds).toBe(940);
  });

  test("last_message_at → unix ms of the last message", async () => {
    const parsed = await parseSession(WITH_THINKING);
    expect(parsed.last_message_at).toBe(Date.parse("2025-01-15T11:20:40.000Z"));
  });

  test("single-turn session parses correctly", async () => {
    const parsed = await parseSession(SINGLE_TURN);

    expect(parsed.session_id).toBe("deadbeef");
    expect(parsed.title).toBe("This is a single user turn only");
    expect(parsed.turns).toHaveLength(1);
    expect(parsed.duration_seconds).toBe(0); // only 1 timestamp, no gaps
  });

  test("title truncation → capped at 120 chars", async () => {
    const longTitle = "A".repeat(200);
    const path = writeTempSession([
      {
        type: "user",
        timestamp: "2025-01-15T10:00:00.000Z",
        cwd: "/tmp/testproject",
        message: { role: "user", content: longTitle },
      },
    ]);

    const parsed = await parseSession(path);
    expect(parsed.title).toBe(longTitle.slice(0, 120));
    expect(parsed.title!.length).toBe(120);
  });

  test("system/progress/file-history-snapshot lines are ignored", async () => {
    const path = writeTempSession([
      { type: "system", timestamp: "2025-01-15T10:00:00.000Z", message: { role: "user", content: "sys" } },
      { type: "progress", timestamp: "2025-01-15T10:00:01.000Z", message: { role: "user", content: "prog" } },
      { type: "file-history-snapshot", timestamp: "2025-01-15T10:00:02.000Z", message: { role: "user", content: "snap" } },
      {
        type: "user",
        timestamp: "2025-01-15T10:00:03.000Z",
        cwd: "/tmp/testproject",
        message: { role: "user", content: "Real message" },
      },
    ]);

    const parsed = await parseSession(path);
    expect(parsed.title).toBe("Real message");
    expect(parsed.turns).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// extractChunkText
// ---------------------------------------------------------------------------

describe("extractChunkText", () => {
  test("produces [User] / [Assistant] / [Tool] prefixed lines", async () => {
    const parsed = await parseSession(WITH_THINKING);
    const text = extractChunkText(parsed);

    expect(text).toContain("[User] Implement a sorting algorithm");
    expect(text).toContain("[Assistant] I will implement a quicksort algorithm.");
    expect(text).toContain("[Tool] Bash: `ls /foo`");
    expect(text).toContain("[Assistant] Done! Here is the complete implementation.");
  });

  test("thinking blocks are excluded from chunk text", async () => {
    const parsed = await parseSession(WITH_THINKING);
    const text = extractChunkText(parsed);

    expect(text).not.toContain("sorting approach"); // thinking content
  });

  test("empty session produces empty string", () => {
    const session: ParsedSession = {
      session_id: "test0001",
      path: "/tmp/test.jsonl",
      project: "test",
      date: "2025-01-15",
      title: null,
      hash: "abc",
      duration_seconds: 0,
      last_message_at: 0,
      turns: [],
    };
    expect(extractChunkText(session)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// renderMarkdown
// ---------------------------------------------------------------------------

describe("renderMarkdown", () => {
  test("produces ## User and ## Assistant headings", async () => {
    const parsed = await parseSession(MINIMAL);
    const md = renderMarkdown(parsed);

    expect(md).toContain("## User");
    expect(md).toContain("## Assistant");
  });

  test("includes session header and title", async () => {
    const parsed = await parseSession(MINIMAL);
    const md = renderMarkdown(parsed);

    expect(md).toContain("# Session: testproject — 2025-01-15");
    expect(md).toContain("_Hello, can you help me with this?_");
  });

  test("includes tool calls as blockquotes", async () => {
    const parsed = await parseSession(WITH_THINKING);
    const md = renderMarkdown(parsed);

    expect(md).toContain("> **Tool:** Bash: `ls /foo`");
  });

  test("null title produces no title line", async () => {
    const session: ParsedSession = {
      session_id: "test0001",
      path: "/tmp/test.jsonl",
      project: "myproject",
      date: "2025-01-15",
      title: null,
      hash: "abc",
      duration_seconds: 0,
      last_message_at: 0,
      turns: [],
    };
    const md = renderMarkdown(session);
    expect(md).not.toContain("__"); // no empty italic markers
  });
});
