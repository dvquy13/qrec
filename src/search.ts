// src/search.ts
// search(query, {k}): BM25 → KNN → RRF → top-k results

import { createHash } from "crypto";
import type { Database } from "bun:sqlite";
import type { EmbedProvider } from "./embed/provider.ts";

export interface SearchResult {
  session_id: string;
  score: number;
  preview: string; // best matching chunk text
  project: string;
  date: string;
  title: string | null;
  summary: string | null;
  latency: {
    bm25Ms: number;
    embedMs: number;
    knnMs: number;
    fusionMs: number;
    totalMs: number;
  };
}

interface BM25Row {
  rowid: number;
  session_id: string;
  rank: number;
}

interface VecRow {
  chunk_id: string;
  distance: number;
}

interface ChunkRow {
  id: string;
  session_id: string;
  text: string;
}

interface SessionRow {
  id: string;
  project: string;
  date: string;
  title: string | null;
  summary: string | null;
}

const RRF_K = 60;

function getQueryHash(query: string): string {
  return createHash("sha256").update(query).digest("hex");
}

/**
 * Get or compute query embedding, using query_cache for repeated queries.
 */
async function getQueryEmbedding(
  db: Database,
  query: string,
  embedder: EmbedProvider
): Promise<{ embedding: Float32Array; cached: boolean; embedMs: number }> {
  const queryHash = getQueryHash(query);

  // Check cache
  const cached = db
    .prepare("SELECT embedding FROM query_cache WHERE query_hash = ?")
    .get(queryHash) as { embedding: Uint8Array } | undefined;

  if (cached) {
    const buf = cached.embedding;
    return {
      embedding: new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4),
      cached: true,
      embedMs: 0,
    };
  }

  // Embed
  const t0 = performance.now();
  const embedding = await embedder.embed(query);
  const embedMs = performance.now() - t0;

  // Cache it
  db.prepare("INSERT OR REPLACE INTO query_cache (query_hash, embedding, created_at) VALUES (?, ?, ?)").run(
    queryHash,
    Buffer.from(embedding.buffer),
    Date.now()
  );

  return { embedding, cached: false, embedMs };
}

export async function search(
  db: Database,
  embedder: EmbedProvider,
  query: string,
  k: number = 10
): Promise<SearchResult[]> {
  const totalStart = performance.now();

  // === BM25 via FTS5 ===
  const bm25Start = performance.now();
  let bm25Rows: BM25Row[] = [];
  try {
    // Sanitize query for FTS5: replace punctuation that breaks syntax with spaces,
    // then collapse whitespace and trim. This converts e.g. "plugin.json ./ prefix" →
    // "plugin json prefix" which FTS5 handles as AND over these terms.
    const ftsQuery = query
      .replace(/[^a-zA-Z0-9\s'-]/g, " ")  // keep alphanumerics, spaces, hyphens, apostrophes
      .replace(/\s+/g, " ")
      .trim();

    if (ftsQuery.length > 0) {
      // FTS5 rank is negative (lower = better match)
      bm25Rows = db
        .prepare(
          `SELECT rowid, session_id, rank FROM chunks_fts WHERE text MATCH ? ORDER BY rank LIMIT ?`
        )
        .all(ftsQuery, k * 5) as BM25Row[];
    }
  } catch {
    // FTS5 query may fail — fallback to empty
    bm25Rows = [];
  }
  const bm25Ms = performance.now() - bm25Start;

  // === Embed query ===
  const { embedding, embedMs } = await getQueryEmbedding(db, query, embedder);

  // === KNN via sqlite-vec ===
  const knnStart = performance.now();
  const embeddingBuf = Buffer.from(embedding.buffer);
  const vecRows = db
    .prepare(
      `SELECT chunk_id, distance FROM chunks_vec WHERE embedding MATCH ? AND k = ?`
    )
    .all(embeddingBuf, k * 5) as VecRow[];
  const knnMs = performance.now() - knnStart;

  // === RRF Fusion ===
  const fusionStart = performance.now();

  // Build rank maps
  const bm25Ranks = new Map<string, number>(); // chunk_id -> rank (1-based)
  for (let i = 0; i < bm25Rows.length; i++) {
    // BM25 returns rowid — need to get chunk id
    // chunks_fts is a content table — rowid maps to chunks.rowid
    const row = bm25Rows[i];
    // We'll use rowid to join later
    bm25Ranks.set(String(row.rowid), i + 1);
  }

  const vecRanks = new Map<string, number>(); // chunk_id -> rank (1-based)
  for (let i = 0; i < vecRows.length; i++) {
    vecRanks.set(vecRows[i].chunk_id, i + 1);
  }

  // Get chunk_id for BM25 rowids
  const allRowids = bm25Rows.map(r => r.rowid);
  const rowidToChunkId = new Map<number, string>();
  if (allRowids.length > 0) {
    const placeholders = allRowids.map(() => "?").join(",");
    const chunkRows = db
      .prepare(`SELECT rowid, id FROM chunks WHERE rowid IN (${placeholders})`)
      .all(...allRowids) as Array<{ rowid: number; id: string }>;
    for (const row of chunkRows) {
      rowidToChunkId.set(row.rowid, row.id);
    }
  }

  // Collect all chunk IDs from both lists
  const allChunkIds = new Set<string>();
  for (const row of bm25Rows) {
    const chunkId = rowidToChunkId.get(row.rowid);
    if (chunkId) allChunkIds.add(chunkId);
  }
  for (const row of vecRows) {
    allChunkIds.add(row.chunk_id);
  }

  // Compute RRF scores per chunk
  const chunkScores = new Map<string, number>();
  for (const chunkId of allChunkIds) {
    let score = 0;

    // Find BM25 rank by chunk_id
    // We need to reverse-map: chunkId -> rowid -> rank
    for (const [rowid, cid] of rowidToChunkId) {
      if (cid === chunkId) {
        const rank = bm25Ranks.get(String(rowid));
        if (rank !== undefined) {
          score += 1 / (RRF_K + rank);
        }
        break;
      }
    }

    const vecRank = vecRanks.get(chunkId);
    if (vecRank !== undefined) {
      score += 1 / (RRF_K + vecRank);
    }

    chunkScores.set(chunkId, score);
  }

  // Aggregate to session level: take max chunk score per session.
  // MAX prevents verbose sessions (many chunks) from dominating over
  // focused sessions with one highly-relevant chunk.
  const sessionScores = new Map<string, { score: number; bestChunkId: string }>();
  for (const [chunkId, score] of chunkScores) {
    const sessionId = chunkId.split("_").slice(0, -1).join("_");
    const existing = sessionScores.get(sessionId);
    if (!existing || score > existing.score) {
      sessionScores.set(sessionId, { score, bestChunkId: chunkId });
    }
  }

  // Sort by aggregated score
  const sortedSessions = [...sessionScores.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, k);

  const fusionMs = performance.now() - fusionStart;
  const totalMs = performance.now() - totalStart;

  // Fetch session metadata and best chunk previews
  if (sortedSessions.length === 0) {
    return [];
  }

  const sessionIds = sortedSessions.map(([id]) => id);
  const sessPlaceholders = sessionIds.map(() => "?").join(",");

  const sessionMeta = db
    .prepare(`SELECT id, project, date, title, summary FROM sessions WHERE id IN (${sessPlaceholders})`)
    .all(...sessionIds) as SessionRow[];
  const sessionMetaMap = new Map(sessionMeta.map(s => [s.id, s]));

  // Get best chunk text for each session
  const bestChunkIds = sortedSessions.map(([, v]) => v.bestChunkId);
  const chunkPlaceholders = bestChunkIds.map(() => "?").join(",");
  const chunkTexts = db
    .prepare(`SELECT id, session_id, text FROM chunks WHERE id IN (${chunkPlaceholders})`)
    .all(...bestChunkIds) as ChunkRow[];
  const chunkTextMap = new Map(chunkTexts.map(c => [c.id, c]));

  const results: SearchResult[] = [];
  for (const [sessionId, { score, bestChunkId }] of sortedSessions) {
    const meta = sessionMetaMap.get(sessionId);
    if (!meta) continue; // session not in sessions table (shouldn't happen)

    const chunk = chunkTextMap.get(bestChunkId);
    const preview = chunk ? chunk.text : "";

    results.push({
      session_id: sessionId,
      score,
      preview,
      project: meta.project,
      date: meta.date,
      title: meta.title,
      summary: meta.summary ?? null,
      latency: {
        bm25Ms,
        embedMs,
        knnMs,
        fusionMs,
        totalMs,
      },
    });
  }

  return results;
}
