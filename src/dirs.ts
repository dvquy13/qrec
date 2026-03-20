// src/dirs.ts
// Single source of truth for all ~/.qrec paths.
// Override the root with QREC_DIR env var for isolated environments (e.g. onboarding tests).

import { join } from "path";
import { homedir } from "os";

export const QREC_DIR        = process.env.QREC_DIR ?? join(homedir(), ".qrec");
export const QREC_PORT       = parseInt(process.env.QREC_PORT ?? "25927", 10);
export function getQrecPort(): number { return parseInt(process.env.QREC_PORT ?? "25927", 10); }
export const DB_PATH         = join(QREC_DIR, "qrec.db");
export const PID_FILE        = join(QREC_DIR, "qrec.pid");
export const ENRICH_PID_FILE      = join(QREC_DIR, "enrich.pid");
export const ENRICH_PROGRESS_FILE = join(QREC_DIR, "enrich-progress.json");
export const LOG_FILE        = join(QREC_DIR, "qrec.log");
export const ACTIVITY_FILE   = join(QREC_DIR, "activity.jsonl");
export const CONFIG_FILE     = join(QREC_DIR, "config.json");
export const MODEL_CACHE_DIR = join(QREC_DIR, "models");
export const ARCHIVE_DIR     = join(QREC_DIR, "archive");
