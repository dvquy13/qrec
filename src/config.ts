// src/config.ts
// Persistent daemon config at ~/.qrec/config.json.
// Written by POST /settings, read by server.ts on each decision point.

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { QREC_DIR, CONFIG_FILE } from "./dirs.ts";

export interface QrecConfig {
  enrichEnabled: boolean;
}

const DEFAULTS: QrecConfig = {
  enrichEnabled: true,
};

export function readConfig(): QrecConfig {
  try {
    const raw = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    return { ...DEFAULTS, ...raw };
  } catch (e) {
    console.warn("[config] Failed to parse config.json, using defaults:", e);
    return { ...DEFAULTS };
  }
}

export function writeConfig(patch: Partial<QrecConfig>): QrecConfig {
  const current = readConfig();
  const updated = { ...current, ...patch };
  mkdirSync(QREC_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}
