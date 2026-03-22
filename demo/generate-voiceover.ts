/**
 * generate-voiceover.ts
 * One-shot ElevenLabs TTS script — run once before rendering to produce MP3s.
 *
 * Usage:
 *   bun --env-file=../.env generate-voiceover.ts
 *
 * Writes: demo/public/voiceover/<scene-id>.mp3
 * Requires: ELEVENLABS_API_KEY in environment
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'; // ElevenLabs "George" — swap for any voice ID
const MODEL_ID = 'eleven_multilingual_v2';
const OUT_DIR = join(import.meta.dirname, 'public/voiceover');

const SCENES: { id: string; text: string }[] = [
  {
    id: 'opening',
    text: 'qrec is a session recall engine for Claude Code. Every conversation you have with Claude gets indexed locally — so when you need to find something you built last week, you can.',
  },
  {
    id: 'onboard',
    text: 'Getting started takes one command. qrec downloads a local embedding model, starts a background daemon, and begins indexing your projects automatically.',
  },
  {
    id: 'project-filter',
    text: 'Working across multiple codebases? Filter sessions by project to focus your search on exactly what matters.',
  },
  {
    id: 'enrich-detail',
    text: 'Every session is enriched with a plain-English summary, semantic tags, and named entities — all generated locally by a compact language model. No data leaves your machine. Structured, searchable metadata with zero cloud dependency.',
  },
  {
    id: 'search-demo',
    text: 'Just type what you\'re looking for. qrec combines BM25 full-text search with local vector embeddings, fusing results with reciprocal rank fusion. Answers surface in milliseconds across thousands of sessions.',
  },
  {
    id: 'closing',
    text: 'Install qrec today. Your sessions are waiting.',
  },
];

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error('Error: ELEVENLABS_API_KEY is not set.');
  console.error('Run: bun --env-file=../.env generate-voiceover.ts');
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

for (const scene of SCENES) {
  const outPath = join(OUT_DIR, `${scene.id}.mp3`);
  process.stdout.write(`Generating ${scene.id}...`);

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: scene.text,
      model_id: MODEL_ID,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(` ✗\nElevenLabs error ${res.status}: ${body}`);
    process.exit(1);
  }

  await writeFile(outPath, Buffer.from(await res.arrayBuffer()));
  console.log(` ✓  ${outPath}`);
}

console.log('\nAll voiceover files generated. Open Remotion Studio to preview.');
