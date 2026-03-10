#!/usr/bin/env node
// Reads version from package.json, syncs to .claude-plugin/marketplace.json
// and plugin/.claude-plugin/plugin.json.
// Usage: node scripts/sync-plugin-version.mjs <version>

import { readFileSync, writeFileSync } from "fs";

const version = process.argv[2];
if (!version) {
  console.error("Usage: node scripts/sync-plugin-version.mjs <version>");
  process.exit(1);
}

function updateJson(filePath, updateFn) {
  const raw = readFileSync(filePath, "utf-8");
  const obj = JSON.parse(raw);
  updateFn(obj);
  writeFileSync(filePath, JSON.stringify(obj, null, 2) + "\n", "utf-8");
  console.log(`Updated ${filePath} → version ${version}`);
}

// Update root package.json
updateJson("package.json", obj => { obj.version = version; });

// Update marketplace manifest (top-level version + nested plugins[].version)
updateJson(".claude-plugin/marketplace.json", obj => {
  obj.version = version;
  if (Array.isArray(obj.plugins)) {
    obj.plugins.forEach(p => { p.version = version; });
  }
});

// Update plugin manifest
updateJson("plugin/.claude-plugin/plugin.json", obj => { obj.version = version; });
