// src/config.ts
// Persistent daemon config at ~/.qrec/config.json.
// Written by POST /settings, read by server.ts on each decision point.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { QREC_DIR, CONFIG_FILE } from "./dirs.ts";

export interface QrecConfig {
  enrichEnabled: boolean;
  enrichIdleMs: number;
  indexIntervalMs: number;
}

const DEFAULTS: QrecConfig = {
  enrichEnabled: true,
  enrichIdleMs: 5 * 60 * 1000,
  indexIntervalMs: 60_000,
};

export function readConfig(configPath = CONFIG_FILE): QrecConfig {
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8"));
    return { ...DEFAULTS, ...raw };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[config] Failed to parse config.json, using defaults:", e);
    }
    return { ...DEFAULTS };
  }
}

// Write defaults if config.json doesn't exist yet (first daemon start).
// Prevents ENOENT spam in the log before the user ever visits /settings.
export function ensureConfig(configPath = CONFIG_FILE): void {
  if (!existsSync(configPath)) {
    writeConfig({}, configPath);
  }
}

export function writeConfig(patch: Partial<QrecConfig>, configPath = CONFIG_FILE): QrecConfig {
  const current = readConfig(configPath);
  const updated = { ...current, ...patch };
  const dir = configPath === CONFIG_FILE ? QREC_DIR : configPath.replace(/\/[^/]+$/, "");
  mkdirSync(dir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}
