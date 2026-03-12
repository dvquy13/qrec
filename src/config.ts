// src/config.ts
// Persistent daemon config at ~/.qrec/config.json.
// Written by POST /settings, read by server.ts on each decision point.

import { join } from "path";
import { homedir } from "os";
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const CONFIG_PATH = join(homedir(), ".qrec", "config.json");

export interface QrecConfig {
  enrichEnabled: boolean;
}

const DEFAULTS: QrecConfig = {
  enrichEnabled: true,
};

export function readConfig(): QrecConfig {
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeConfig(patch: Partial<QrecConfig>): QrecConfig {
  const current = readConfig();
  const updated = { ...current, ...patch };
  mkdirSync(join(homedir(), ".qrec"), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}
