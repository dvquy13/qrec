// test/cli-search-args.test.ts
// Verifies that the search command correctly separates flag values from the query.
// Uses citty's parseArgs directly to test the same parsing path as cli.ts.
import { test, expect, describe } from "bun:test";
import { parseArgs } from "citty";

const searchArgsDef = {
  k:       { type: "string"  as const, default: "10" },
  project: { type: "string"  as const },
  tag:     { type: "string"  as const },
  from:    { type: "string"  as const },
  to:      { type: "string"  as const },
};

function extractQuery(rawArgs: string[]): string {
  const parsed = parseArgs(rawArgs, searchArgsDef);
  return parsed._.join(" ").trim();
}

describe("cli search — query extraction via citty", () => {
  test("flag-only args produce an empty query (browse mode)", () => {
    expect(extractQuery(["--project", "qrec", "--k", "5"])).toBe("");
  });

  test("positional query before flags is preserved", () => {
    expect(extractQuery(["my search query", "--project", "qrec", "--k", "5"])).toBe("my search query");
  });

  test("multi-word query with flags", () => {
    expect(extractQuery(["hello", "world", "--k", "5"])).toBe("hello world");
  });

  test("no args → empty query", () => {
    expect(extractQuery([])).toBe("");
  });

  test("only positional query → unchanged", () => {
    expect(extractQuery(["my search query"])).toBe("my search query");
  });

  test("all flags combined → empty query", () => {
    const args = ["--project", "foo", "--tag", "bar", "--from", "2026-01-01", "--to", "2026-03-21", "--k", "10"];
    expect(extractQuery(args)).toBe("");
  });

  test("flag values are correctly parsed, not leaked into query", () => {
    const parsed = parseArgs(["--project", "qrec", "--k", "5"], searchArgsDef);
    expect(parsed.project).toBe("qrec");
    expect(parsed.k).toBe("5");
    expect(parsed._).toEqual([]);
  });
});
