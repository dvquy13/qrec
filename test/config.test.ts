import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { existsSync } from "fs";
import { readConfig, writeConfig, ensureConfig } from "../src/config.ts";

let tmpDir: string;
let cfgPath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "qrec-config-test-"));
  cfgPath = join(tmpDir, "config.json");
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("readConfig", () => {
  test("returns all defaults when file is missing — no throw", () => {
    const cfg = readConfig(cfgPath);
    expect(cfg.enrichEnabled).toBe(true);
    expect(cfg.enrichIdleMs).toBe(5 * 60 * 1000);
    expect(cfg.indexIntervalMs).toBe(60_000);
  });

  test("returns defaults silently on ENOENT (no console.warn)", () => {
    const warns: unknown[] = [];
    const origWarn = console.warn;
    console.warn = (...args) => warns.push(args);
    try {
      readConfig(cfgPath);
      expect(warns).toHaveLength(0);
    } finally {
      console.warn = origWarn;
    }
  });

  test("warns on malformed JSON (not ENOENT)", () => {
    writeFileSync(cfgPath, "{ not json }", "utf-8");
    const warns: unknown[] = [];
    const origWarn = console.warn;
    console.warn = (...args) => warns.push(args);
    try {
      const cfg = readConfig(cfgPath);
      expect(warns.length).toBeGreaterThan(0);
      // Still returns defaults
      expect(cfg.enrichEnabled).toBe(true);
    } finally {
      console.warn = origWarn;
    }
  });

  test("merges partial JSON with defaults (forward-compatible)", () => {
    writeFileSync(cfgPath, JSON.stringify({ enrichEnabled: false }), "utf-8");
    const cfg = readConfig(cfgPath);
    expect(cfg.enrichEnabled).toBe(false);
    // New fields get defaults
    expect(cfg.enrichIdleMs).toBe(5 * 60 * 1000);
    expect(cfg.indexIntervalMs).toBe(60_000);
  });
});

describe("ensureConfig", () => {
  test("creates file with defaults when absent", () => {
    expect(existsSync(cfgPath)).toBe(false);
    ensureConfig(cfgPath);
    expect(existsSync(cfgPath)).toBe(true);
    const cfg = readConfig(cfgPath);
    expect(cfg.enrichEnabled).toBe(true);
    expect(cfg.enrichIdleMs).toBe(5 * 60 * 1000);
    expect(cfg.indexIntervalMs).toBe(60_000);
  });

  test("does not overwrite existing config", () => {
    writeConfig({ enrichEnabled: false, enrichIdleMs: 999 }, cfgPath);
    ensureConfig(cfgPath);
    const cfg = readConfig(cfgPath);
    expect(cfg.enrichEnabled).toBe(false);
    expect(cfg.enrichIdleMs).toBe(999);
  });
});

describe("writeConfig", () => {
  test("persists and reads back", () => {
    writeConfig({ enrichEnabled: false }, cfgPath);
    const cfg = readConfig(cfgPath);
    expect(cfg.enrichEnabled).toBe(false);
  });

  test("round-trips all fields", () => {
    writeConfig({ enrichEnabled: false, enrichIdleMs: 120_000, indexIntervalMs: 30_000 }, cfgPath);
    const cfg = readConfig(cfgPath);
    expect(cfg.enrichEnabled).toBe(false);
    expect(cfg.enrichIdleMs).toBe(120_000);
    expect(cfg.indexIntervalMs).toBe(30_000);
  });

  test("partial patch preserves other fields", () => {
    writeConfig({ enrichEnabled: false, enrichIdleMs: 120_000, indexIntervalMs: 30_000 }, cfgPath);
    writeConfig({ enrichEnabled: true }, cfgPath);
    const cfg = readConfig(cfgPath);
    expect(cfg.enrichEnabled).toBe(true);
    expect(cfg.enrichIdleMs).toBe(120_000);
    expect(cfg.indexIntervalMs).toBe(30_000);
  });
});
