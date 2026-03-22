// test/cli-serve-args.test.ts
// Verifies that the serve command correctly parses --no-open.
// Uses citty's parseArgs directly to test the same parsing path as cli.ts.
import { test, expect, describe } from "bun:test";
import { parseArgs } from "citty";

const serveArgsDef = {
  daemon: { type: "boolean" as const, default: false },
  open:   { type: "boolean" as const, default: true },
};

describe("cli serve — --no-open flag via citty", () => {
  test("--no-open sets args.open to false (suppresses browser)", () => {
    const parsed = parseArgs(["--daemon", "--no-open"], serveArgsDef);
    // citty treats --no-X as negation of flag X; args.open must be false.
    expect(parsed.open).toBe(false);
  });

  test("omitting --no-open leaves args.open true (opens browser)", () => {
    const parsed = parseArgs(["--daemon"], serveArgsDef);
    expect(parsed.open).toBe(true);
  });

  test("daemon flag is still parsed correctly alongside --no-open", () => {
    const parsed = parseArgs(["--daemon", "--no-open"], serveArgsDef);
    expect(parsed.daemon).toBe(true);
  });
});
