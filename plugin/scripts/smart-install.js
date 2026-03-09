#!/usr/bin/env node
// smart-install.js — Plain Node.js (no Bun required) first-run installer
// Runs on every SessionStart; fast path via .install-version marker.
//
// Steps:
//   1. Check/install Bun
//   2. Check .install-version marker → skip if unchanged
//   3. bun install in $PLUGIN_ROOT
//   4. Download model if absent
//   5. First-time index if DB absent
//   6. Write .install-version marker

"use strict";

const { execSync, spawnSync } = require("child_process");
const { existsSync, mkdirSync, writeFileSync, readFileSync, createWriteStream } = require("fs");
const { join, dirname } = require("path");
const { homedir } = require("os");
const https = require("https");

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || dirname(__dirname);
const QREC_DIR = join(homedir(), ".qrec");
const LOG_FILE = join(QREC_DIR, "install.log");
const MODEL_DIR = join(homedir(), ".cache", "qmd", "models");
const MODEL_FILENAME = "hf_ggml-org_embeddinggemma-300M-Q8_0.gguf";
const MODEL_PATH = join(MODEL_DIR, MODEL_FILENAME);
const DB_PATH = join(QREC_DIR, "qrec.db");
const MARKER_FILE = join(PLUGIN_ROOT, ".install-version");
const VAULT_PATH = join(homedir(), "vault", "sessions");

// Read plugin version from plugin.json
function getPluginVersion() {
  try {
    const pkgPath = join(PLUGIN_ROOT, ".claude-plugin", "plugin.json");
    if (existsSync(pkgPath)) {
      return JSON.parse(readFileSync(pkgPath, "utf-8")).version || "unknown";
    }
  } catch {}
  return "unknown";
}

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  try {
    mkdirSync(QREC_DIR, { recursive: true });
    writeFileSync(LOG_FILE, line + "\n", { flag: "a" });
  } catch {}
  process.stderr.write("[qrec] " + msg + "\n");
}

function findBun() {
  const candidates = [
    join(homedir(), ".bun", "bin", "bun"),
    "/usr/local/bin/bun",
    "/opt/homebrew/bin/bun",
    "/home/linuxbrew/.linuxbrew/bin/bun",
    "bun", // in PATH
  ];

  for (const candidate of candidates) {
    try {
      const result = spawnSync(candidate, ["--version"], { encoding: "utf-8", timeout: 5000 });
      if (result.status === 0) {
        return candidate;
      }
    } catch {}
  }
  return null;
}

function installBun() {
  log("Installing Bun...");
  if (process.platform === "win32") {
    log("ERROR: Automatic Bun install not supported on Windows. Install manually from https://bun.sh");
    process.exit(1);
  }
  try {
    execSync("curl -fsSL https://bun.sh/install | bash", {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
    });
    log("Bun installed.");
  } catch (err) {
    log(`ERROR: Failed to install Bun: ${err.message}`);
    process.exit(1);
  }
}

function getBunVersion(bunPath) {
  try {
    const result = spawnSync(bunPath, ["--version"], { encoding: "utf-8", timeout: 5000 });
    return result.stdout.trim();
  } catch {
    return "unknown";
  }
}

function readMarker() {
  try {
    if (existsSync(MARKER_FILE)) {
      return JSON.parse(readFileSync(MARKER_FILE, "utf-8"));
    }
  } catch {}
  return null;
}

function writeMarker(pluginVersion, bunVersion) {
  try {
    writeFileSync(MARKER_FILE, JSON.stringify({ pluginVersion, bunVersion, ts: Date.now() }), "utf-8");
  } catch (err) {
    log(`WARN: Failed to write marker: ${err.message}`);
  }
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    mkdirSync(dirname(destPath), { recursive: true });
    const file = createWriteStream(destPath + ".tmp");
    let downloaded = 0;
    let total = 0;

    function doRequest(reqUrl) {
      https.get(reqUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          doRequest(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${reqUrl}`));
          return;
        }
        total = parseInt(res.headers["content-length"] || "0", 10);
        res.on("data", chunk => {
          downloaded += chunk.length;
          file.write(chunk);
          if (total > 0) {
            const pct = Math.round((downloaded / total) * 100);
            process.stderr.write(`\r[qrec] Downloading model... ${pct}% (${Math.round(downloaded / 1024 / 1024)}MB / ${Math.round(total / 1024 / 1024)}MB)`);
          }
        });
        res.on("end", () => {
          file.close(() => {
            const { renameSync } = require("fs");
            try {
              renameSync(destPath + ".tmp", destPath);
              process.stderr.write("\n");
              resolve();
            } catch (err) {
              reject(err);
            }
          });
        });
        res.on("error", reject);
      }).on("error", reject);
    }

    doRequest(url);
  });
}

async function main() {
  log(`smart-install starting. Platform: ${process.platform} ${process.arch}. Plugin root: ${PLUGIN_ROOT}`);

  // Step 1: Find or install Bun
  let bunPath = findBun();
  if (!bunPath) {
    installBun();
    bunPath = findBun();
    if (!bunPath) {
      log("ERROR: Bun installation succeeded but bun binary not found. Try restarting your shell.");
      process.exit(1);
    }
  }
  log(`Bun found at: ${bunPath}`);

  // Step 2: Check .install-version marker
  const pluginVersion = getPluginVersion();
  const bunVersion = getBunVersion(bunPath);
  const marker = readMarker();

  if (marker && marker.pluginVersion === pluginVersion && marker.bunVersion === bunVersion) {
    // Fast path: nothing changed
    log(`Fast path: plugin@${pluginVersion}, bun@${bunVersion} — skipping reinstall.`);
    process.exit(0);
  }

  log(`Installing: plugin@${pluginVersion}, bun@${bunVersion}`);

  // Step 3: bun install in PLUGIN_ROOT
  log("Running bun install...");
  try {
    const result = spawnSync(bunPath, ["install"], {
      cwd: PLUGIN_ROOT,
      encoding: "utf-8",
      timeout: 120_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.status !== 0) {
      log(`ERROR: bun install failed:\n${result.stderr}`);
      process.exit(1);
    }
    log("bun install complete.");
  } catch (err) {
    log(`ERROR: bun install threw: ${err.message}`);
    process.exit(1);
  }

  // Step 4: Download model if absent
  if (!existsSync(MODEL_PATH)) {
    log(`Model not found at ${MODEL_PATH}. Downloading...`);
    const modelUrl =
      "https://huggingface.co/ggml-org/embeddinggemma-300M-Q8_0/resolve/main/" +
      MODEL_FILENAME;
    try {
      await downloadFile(modelUrl, MODEL_PATH);
      log(`Model downloaded to ${MODEL_PATH}`);
    } catch (err) {
      log(`ERROR: Model download failed: ${err.message}`);
      process.exit(1);
    }
  } else {
    log(`Model already present at ${MODEL_PATH}`);
  }

  // Step 5: First-time index if DB absent
  if (!existsSync(DB_PATH)) {
    if (existsSync(VAULT_PATH)) {
      log(`DB not found. Indexing vault at ${VAULT_PATH}...`);
      try {
        const qrecCjs = join(PLUGIN_ROOT, "scripts", "qrec.cjs");
        const result = spawnSync(bunPath, ["run", qrecCjs, "index", VAULT_PATH], {
          encoding: "utf-8",
          timeout: 600_000,
          stdio: ["ignore", "pipe", "pipe"],
        });
        if (result.status !== 0) {
          log(`WARN: Initial index failed:\n${result.stderr}`);
          // Non-fatal: daemon can still start; user can re-run manually
        } else {
          log("Initial index complete.");
        }
      } catch (err) {
        log(`WARN: Initial index threw: ${err.message}`);
      }
    } else {
      log(`Vault not found at ${VAULT_PATH}. Skipping initial index.`);
    }
  } else {
    log("DB already exists. Skipping initial index.");
  }

  // Step 6: Write marker
  writeMarker(pluginVersion, bunVersion);
  log("Setup complete.");
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
