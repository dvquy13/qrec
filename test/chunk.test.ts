// test/chunk.test.ts
import { test, expect, describe } from "bun:test";
import { chunkMarkdown } from "../src/chunk.ts";

const TARGET_CHARS = 3600; // 900 tokens * 4 chars/token
const OVERLAP_CHARS = 540; // 15% of TARGET_CHARS

describe("chunkMarkdown", () => {
  test("empty text → single chunk at pos 0", () => {
    const chunks = chunkMarkdown("");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].pos).toBe(0);
    expect(chunks[0].text).toBe("");
  });

  test("short text → single chunk at pos 0", () => {
    const text = "Hello, world!";
    const chunks = chunkMarkdown(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].pos).toBe(0);
    expect(chunks[0].text).toBe(text);
  });

  test("text at exactly TARGET_CHARS → single chunk", () => {
    const text = "x".repeat(TARGET_CHARS);
    const chunks = chunkMarkdown(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].pos).toBe(0);
    expect(chunks[0].text).toBe(text);
  });

  test("heading splits → chunks break at heading boundaries", () => {
    // Two heading-prefixed segments; combined length > TARGET_CHARS forces a split
    const text =
      "## Heading 1\n" +
      "A".repeat(2000) +
      "\n## Heading 2\n" +
      "B".repeat(2000);

    const chunks = chunkMarkdown(text);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].text).toContain("Heading 1");
    expect(chunks[0].text).toContain("A");
    expect(chunks[chunks.length - 1].text).toContain("Heading 2");
    expect(chunks[chunks.length - 1].text).toContain("B");
  });

  test("overlap → last OVERLAP_CHARS of chunk N appear at start of chunk N+1", () => {
    const text =
      "## Heading 1\n" +
      "A".repeat(2000) +
      "\n## Heading 2\n" +
      "B".repeat(2000);

    const chunks = chunkMarkdown(text);
    expect(chunks.length).toBeGreaterThanOrEqual(2);

    // The tail of chunk[0] must appear verbatim at the start of chunk[1]
    const tail = chunks[0].text.slice(-OVERLAP_CHARS);
    expect(chunks[1].text.startsWith(tail)).toBe(true);
  });

  test("hard split fallback → multiple chunks for long no-heading text", () => {
    // No headings — forces hardSplit path
    const text = "x".repeat(TARGET_CHARS * 2 + 1000);
    const chunks = chunkMarkdown(text);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const chunk of chunks) {
      expect(chunk.pos).toBeGreaterThanOrEqual(0);
      expect(chunk.pos).toBeLessThan(text.length);
      expect(chunk.text.length).toBeGreaterThan(0);
    }
  });

  test("hard split prefers paragraph breaks over hard cuts", () => {
    // Three ~1800-char paragraphs separated by blank lines; total > TARGET_CHARS
    const para = "word ".repeat(360); // 1800 chars
    const text = para + "\n\n" + para + "\n\n" + para;

    const chunks = chunkMarkdown(text);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // Every chunk boundary should not split mid-word
    for (const chunk of chunks) {
      expect(chunk.text).not.toMatch(/^\s/); // no leading whitespace after trim
    }
  });

  test("position tracking → pos values are non-decreasing and within bounds", () => {
    const text =
      "## Heading 1\n" +
      "A".repeat(2000) +
      "\n## Heading 2\n" +
      "B".repeat(2000);

    const chunks = chunkMarkdown(text);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].pos).toBe(0);

    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].pos).toBeGreaterThan(chunks[i - 1].pos);
    }
    for (const chunk of chunks) {
      expect(chunk.pos).toBeLessThan(text.length);
    }
  });
});
