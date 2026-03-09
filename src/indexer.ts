// src/indexer.ts
// Scan source → chunk → embed → store in FTS5 + sqlite-vec.
// Supports:
//   - ~/.claude/projects/ directory  → scans *.jsonl recursively
//   - /path/to/session.jsonl          → indexes single JSONL file
//   - ~/vault/sessions/ directory     → legacy *.md path (kept for migration)

import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join, basename } from "path";
import { createHash } from "crypto";
import type { Database } from "bun:sqlite";
import { chunkMarkdown } from "./chunk.ts";
import { getEmbedder } from "./embed/local.ts";
import { parseSession, extractChunkText } from "./parser.ts";

interface SessionMeta {
  id: string;
  path: string;
  project: string;
  date: string;
  title: string | null;
  hash: string;
  chunkText: string; // text to chunk + embed
}

// ---------------------------------------------------------------------------
// Markdown (legacy) helpers
// ---------------------------------------------------------------------------

function parseMdSessionMeta(filePath: string): { id: string; project: string; date: string } | null {
  const name = basename(filePath, ".md");
  const match = name.match(/^(\d{4}-\d{2}-\d{2})_(.+)_([0-9a-f]{8})$/);
  if (match) return { date: match[1], project: match[2], id: match[3] };
  const match2 = name.match(/^(\d{4}-\d{2}-\d{2})__(.+)_([0-9a-f]{8})$/);
  if (match2) return { date: match2[1], project: match2[2], id: match2[3] };
  return null;
}

function extractMdTitle(content: string): string | null {
  const h1 = content.match(/^# (.+)$/m);
  return h1 ? h1[1].trim() : null;
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

/** Recursively collect all *.jsonl files under a directory. */
function collectJsonlFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      for (const sub of readdirSync(full)) {
        if (sub.endsWith(".jsonl")) files.push(join(full, sub));
      }
    } else if (entry.endsWith(".jsonl")) {
      files.push(full);
    }
  }
  return files;
}

/** Recursively collect all *.md files under a directory (legacy vault). */
function collectMdFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      for (const sub of readdirSync(full)) {
        if (sub.endsWith(".md")) files.push(join(full, sub));
      }
    } else if (entry.endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Seeded sampling
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededSample<T>(arr: T[], n: number, seed: number): T[] {
  const rng = mulberry32(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// ---------------------------------------------------------------------------
// Candidate building
// ---------------------------------------------------------------------------

/** Build a SessionMeta from a JSONL file. Returns null if session has < minTurns user turns. */
async function buildJsonlCandidate(
  filePath: string,
  minTurns: number = 2
): Promise<SessionMeta | null> {
  try {
    const session = await parseSession(filePath);
    const userTurns = session.turns.filter(t => t.role === "user").length;
    if (userTurns < minTurns) return null;

    const chunkText = extractChunkText(session);
    if (!chunkText.trim()) return null;

    return {
      id: session.session_id,
      path: filePath,
      project: session.project,
      date: session.date,
      title: session.title,
      hash: session.hash,
      chunkText,
    };
  } catch {
    return null;
  }
}

/** Build a SessionMeta from a legacy .md file. */
function buildMdCandidate(filePath: string): SessionMeta | null {
  const parsed = parseMdSessionMeta(filePath);
  if (!parsed) return null;
  const content = readFileSync(filePath, "utf-8");
  return {
    id: parsed.id,
    path: filePath,
    project: parsed.project,
    date: parsed.date,
    title: extractMdTitle(content),
    hash: hashContent(content),
    chunkText: content,
  };
}

// ---------------------------------------------------------------------------
// Core indexer
// ---------------------------------------------------------------------------

const MIN_TURNS = 2;

export async function indexVault(
  db: Database,
  sourcePath: string,
  options: { force?: boolean; sessions?: number; seed?: number } = {}
): Promise<void> {
  const embedder = await getEmbedder();

  // Determine source type
  const isSingleJsonl = sourcePath.endsWith(".jsonl") && existsSync(sourcePath);
  const isDirectory = !isSingleJsonl && existsSync(sourcePath) && statSync(sourcePath).isDirectory();

  let candidates: SessionMeta[] = [];

  if (isSingleJsonl) {
    // Single-file mode (SessionEnd hook)
    const candidate = await buildJsonlCandidate(sourcePath, MIN_TURNS);
    if (!candidate) {
      console.log("[indexer] Session skipped (too few user turns or empty)");
      return;
    }
    candidates = [candidate];
  } else if (isDirectory) {
    // Detect: prefer JSONL, fallback to .md
    const jsonlFiles = collectJsonlFiles(sourcePath);
    if (jsonlFiles.length > 0) {
      console.log(`[indexer] Found ${jsonlFiles.length} JSONL files`);
      const results = await Promise.all(jsonlFiles.map(f => buildJsonlCandidate(f, MIN_TURNS)));
      candidates = results.filter((c): c is SessionMeta => c !== null);
    } else {
      const mdFiles = collectMdFiles(sourcePath);
      console.log(`[indexer] Found ${mdFiles.length} markdown files (legacy path)`);
      candidates = mdFiles.map(buildMdCandidate).filter((c): c is SessionMeta => c !== null);
    }
  } else {
    console.error(`[indexer] Path not found or not a JSONL/directory: ${sourcePath}`);
    return;
  }

  // Get existing session hashes for change detection
  const existingSessions = new Map<string, string>();
  const rows = db.prepare("SELECT id, hash FROM sessions").all() as Array<{ id: string; hash: string }>;
  for (const row of rows) existingSessions.set(row.id, row.hash);

  // Seeded sampling (eval reproducibility)
  if (options.sessions && options.sessions < candidates.length) {
    const seed = options.seed ?? 42;
    candidates = seededSample(candidates, options.sessions, seed);
    console.log(`[indexer] Sampled ${candidates.length} sessions (seed=${seed})`);
  }

  const toIndex = candidates.filter(({ id, hash }) => {
    if (options.force) return true;
    return existingSessions.get(id) !== hash;
  });

  const skipped = candidates.length - toIndex.length;
  const total = isSingleJsonl ? 1 : candidates.length;
  console.log(`[indexer] ${toIndex.length} sessions to index (${total} total, ${skipped} up-to-date)`);

  // Prepared statements
  const insertSession = db.prepare(`
    INSERT OR REPLACE INTO sessions (id, path, project, date, title, hash, indexed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertChunk = db.prepare(`
    INSERT OR REPLACE INTO chunks (id, session_id, seq, pos, text, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertVec = db.prepare(`
    INSERT OR REPLACE INTO chunks_vec (chunk_id, embedding)
    VALUES (?, ?)
  `);
  const deleteChunks = db.prepare(`DELETE FROM chunks WHERE session_id = ?`);
  const deleteVec = db.prepare(`DELETE FROM chunks_vec WHERE chunk_id LIKE ?`);

  for (let i = 0; i < toIndex.length; i++) {
    const { id, path, project, date, title, hash, chunkText } = toIndex[i];
    const chunks = chunkMarkdown(chunkText);
    const now = Date.now();

    const indexSession = db.transaction(() => {
      deleteChunks.run(id);
      deleteVec.run(`${id}_%`);
      insertSession.run(id, path, project, date, title, hash, now);
      return chunks;
    });

    const chunksToEmbed = indexSession();
    process.stdout.write(`[${i + 1}/${toIndex.length}] ${id} (${project}/${date}) — ${chunksToEmbed.length} chunks\n`);

    const embedAndInsert = db.transaction(
      (embeddedChunks: Array<{ chunkId: string; seq: number; pos: number; text: string; embedding: Float32Array }>) => {
        for (const { chunkId, seq, pos, text, embedding } of embeddedChunks) {
          insertChunk.run(chunkId, id, seq, pos, text, now);
          insertVec.run(chunkId, Buffer.from(embedding.buffer));
        }
      }
    );

    const embeddedChunks = [];
    for (let j = 0; j < chunksToEmbed.length; j++) {
      const chunk = chunksToEmbed[j];
      const chunkId = `${id}_${j}`;
      const embedding = await embedder.embed(chunk.text);
      embeddedChunks.push({ chunkId, seq: j, pos: chunk.pos, text: chunk.text, embedding });
    }
    embedAndInsert(embeddedChunks);
  }

  console.log(`[indexer] Done. Total sessions indexed: ${toIndex.length}`);
}
