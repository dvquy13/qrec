import { build } from 'bun';
import { rename, unlink } from 'fs/promises';
import { existsSync } from 'fs';

const result = await build({
  entrypoints: ['./web-entry.ts'],
  outdir: '../ui',
  // Use [name] so JS → web-entry.js, CSS → web-entry.css (no collision)
  naming: '[name].[ext]',
  target: 'browser',
  format: 'iife',
  minify: true,
});

if (!result.success) {
  console.error('Build failed:', result.logs);
  process.exit(1);
}

// Rename web-entry.js → components.js
const src = '../ui/web-entry.js';
const dst = '../ui/components.js';
await rename(src, dst);

// Rename web-entry.css → components.css (contains component styles + variables)
const cssOut = '../ui/web-entry.css';
const cssDst = '../ui/components.css';
if (existsSync(cssOut)) await rename(cssOut, cssDst);

console.log('Build complete: ui/components.js');
for (const out of result.outputs) {
  const name = out.path.replace(/.*\//, '');
  if (name === 'web-entry.js') {
    console.log('  ui/components.js', `(${(out.size / 1024).toFixed(1)} KB)`);
  }
}
