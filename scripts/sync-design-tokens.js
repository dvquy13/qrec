#!/usr/bin/env bun
// Diffs qrec's CSS token values against dvq-design-system/colors_and_type.css.
// Prints nothing if in sync; exits 1 with a diff if tokens have drifted.
// Usage: bun scripts/sync-design-tokens.js

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DS_ROOT = join(ROOT, '..', 'dvq-design-system');

const qrecTokens = readFileSync(join(ROOT, 'ui-react/src/styles/variables.css'), 'utf8');
const dsTokens = readFileSync(join(DS_ROOT, 'theme.css'), 'utf8');

function extractRoot(css) {
  const match = css.match(/:root\s*\{([^}]+)\}/s);
  if (!match) return {};
  return Object.fromEntries(
    match[1]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('--') && l.includes(':'))
      .map(l => {
        const colon = l.indexOf(':');
        const name = l.slice(0, colon).trim();
        const value = l.slice(colon + 1).replace(/;.*$/, '').trim();
        return [name, value];
      })
  );
}

const qrec = extractRoot(qrecTokens);
const ds = extractRoot(dsTokens);

let drifted = false;

for (const [name, dsVal] of Object.entries(ds)) {
  if (!(name in qrec)) continue; // qrec doesn't define this token — skip
  if (qrec[name] !== dsVal) {
    if (!drifted) console.log('Token drift detected:\n');
    console.log(`  ${name}`);
    console.log(`    design-system: ${dsVal}`);
    console.log(`    qrec:          ${qrec[name]}`);
    drifted = true;
  }
}

if (drifted) {
  console.log('\nUpdate ui-react/src/styles/variables.css to resolve drift.');
  process.exit(1);
} else {
  console.log('OK — all shared tokens match dvq-design-system.');
}
