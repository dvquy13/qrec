// src/activity.ts
// Append-only activity log at ~/.qrec/activity.jsonl.
// Written by daemon when indexing runs; read by /activity/entries endpoint.

import { join } from "path";
import { homedir } from "os";
import { appendFileSync, existsSync, readFileSync, mkdirSync } from "fs";

const ACTIVITY_FILE = join(homedir(), ".qrec", "activity.jsonl");

export type ActivityType =
  | "daemon_started"
  | "index_started"
  | "session_indexed"
  | "index_complete";

export interface ActivityEvent {
  ts: number;
  type: ActivityType;
  data?: Record<string, unknown>;
}

export function appendActivity(event: Omit<ActivityEvent, "ts">): void {
  const entry: ActivityEvent = { ts: Date.now(), ...event };
  try {
    mkdirSync(join(homedir(), ".qrec"), { recursive: true });
    appendFileSync(ACTIVITY_FILE, JSON.stringify(entry) + "\n", "utf-8");
  } catch {
    // Activity log failure must not affect other operations
  }
}

export function getRecentActivity(limit: number = 100): ActivityEvent[] {
  if (!existsSync(ACTIVITY_FILE)) return [];
  try {
    const lines = readFileSync(ACTIVITY_FILE, "utf-8")
      .split("\n")
      .filter(l => l.trim().length > 0);
    const parsed = lines
      .map(l => {
        try { return JSON.parse(l) as ActivityEvent; }
        catch { return null; }
      })
      .filter((e): e is ActivityEvent => e !== null);
    // Most recent first
    return parsed.slice(-limit).reverse();
  } catch {
    return [];
  }
}
