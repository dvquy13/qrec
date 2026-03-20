import * as esbuild from "esbuild";
import { mkdirSync, readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
const uiHtml = readFileSync("ui/index.html", "utf-8");

mkdirSync("plugin/scripts", { recursive: true });

await esbuild.build({
  entryPoints: ["src/cli.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  minify: true,
  outfile: "plugin/scripts/qrec.cjs",
  external: ["bun:sqlite", "node-llama-cpp", "sqlite-vec"],
  define: {
    __QREC_VERSION__: JSON.stringify(pkg.version),
    // Inline ui/index.html at build time — no file copy needed
    __UI_HTML__: JSON.stringify(uiHtml),
  },
  // Suppress handled import.meta.dir warnings — replaced with CJS __dirname fallback
  logOverride: { "empty-import-meta": "silent" },
});

console.log("Build complete: plugin/scripts/qrec.cjs");
