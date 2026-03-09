// src/chunk.ts
// Heading-aware markdown chunker: ~900 tokens/chunk, 15% overlap

export interface Chunk {
  text: string;
  pos: number; // char offset in source doc
}

// Approximation: ~4 chars per token
const TARGET_CHARS = 900 * 4; // 3600 chars
const OVERLAP_CHARS = Math.floor(TARGET_CHARS * 0.15); // ~540 chars

/**
 * Split markdown text into overlapping chunks.
 * Prefers splitting at markdown headings (##, ###) rather than mid-paragraph.
 * Falls back to paragraph breaks, then hard character limit.
 */
export function chunkMarkdown(text: string): Chunk[] {
  if (text.length <= TARGET_CHARS) {
    return [{ text, pos: 0 }];
  }

  // Split text into segments at heading boundaries
  const segments = splitAtHeadings(text);

  const chunks: Chunk[] = [];
  let currentText = "";
  let currentPos = 0;

  for (const seg of segments) {
    const combined = currentText ? currentText + "\n\n" + seg.text : seg.text;

    if (combined.length <= TARGET_CHARS) {
      // Fits: accumulate
      if (!currentText) {
        currentPos = seg.pos;
      }
      currentText = combined;
    } else {
      // Doesn't fit: flush current and start new
      if (currentText) {
        chunks.push({ text: currentText.trim(), pos: currentPos });

        // Compute overlap: take last OVERLAP_CHARS of currentText
        const overlap = currentText.slice(-OVERLAP_CHARS);
        const overlapPos = currentPos + currentText.length - overlap.length;
        currentText = overlap + "\n\n" + seg.text;
        currentPos = overlapPos;
      } else {
        // Single segment larger than target — split it hard
        const hardChunks = hardSplit(seg.text, seg.pos);
        // Last hard chunk becomes current
        if (hardChunks.length > 1) {
          for (let i = 0; i < hardChunks.length - 1; i++) {
            chunks.push(hardChunks[i]);
          }
          const last = hardChunks[hardChunks.length - 1];
          currentText = last.text;
          currentPos = last.pos;
        } else {
          currentText = seg.text;
          currentPos = seg.pos;
        }
      }
    }
  }

  // Flush remaining
  if (currentText.trim()) {
    chunks.push({ text: currentText.trim(), pos: currentPos });
  }

  return chunks;
}

interface Segment {
  text: string;
  pos: number;
}

function splitAtHeadings(text: string): Segment[] {
  const headingRegex = /^(#{1,6} .+)$/m;
  const segments: Segment[] = [];
  let lastPos = 0;

  // Find all heading positions
  const headingPositions: number[] = [];
  let match: RegExpExecArray | null;
  const globalRegex = /^(#{1,6} .+)$/gm;

  while ((match = globalRegex.exec(text)) !== null) {
    if (match.index > 0) {
      headingPositions.push(match.index);
    }
  }

  if (headingPositions.length === 0) {
    return [{ text, pos: 0 }];
  }

  for (const pos of headingPositions) {
    const segText = text.slice(lastPos, pos);
    if (segText.trim()) {
      segments.push({ text: segText.trim(), pos: lastPos });
    }
    lastPos = pos;
  }

  // Last segment
  const lastSeg = text.slice(lastPos);
  if (lastSeg.trim()) {
    segments.push({ text: lastSeg.trim(), pos: lastPos });
  }

  return segments.length > 0 ? segments : [{ text, pos: 0 }];
}

function hardSplit(text: string, basePos: number): Chunk[] {
  const chunks: Chunk[] = [];
  let pos = 0;

  while (pos < text.length) {
    let end = pos + TARGET_CHARS;

    if (end >= text.length) {
      // Last chunk
      chunks.push({ text: text.slice(pos).trim(), pos: basePos + pos });
      break;
    }

    // Try to break at paragraph boundary
    const paraBreak = text.lastIndexOf("\n\n", end);
    if (paraBreak > pos + TARGET_CHARS * 0.5) {
      end = paraBreak;
    } else {
      // Try newline
      const lineBreak = text.lastIndexOf("\n", end);
      if (lineBreak > pos + TARGET_CHARS * 0.5) {
        end = lineBreak;
      }
      // Otherwise hard cut at TARGET_CHARS
    }

    chunks.push({ text: text.slice(pos, end).trim(), pos: basePos + pos });

    // Next chunk starts with overlap
    pos = Math.max(pos + 1, end - OVERLAP_CHARS);
  }

  return chunks;
}
