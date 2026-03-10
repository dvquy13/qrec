import * as esbuild from "esbuild";
import { mkdirSync, cpSync } from "fs";

mkdirSync("plugin/scripts", { recursive: true });
mkdirSync("plugin/ui", { recursive: true });

await esbuild.build({
  entryPoints: ["src/cli.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  minify: true,
  outfile: "plugin/scripts/qrec.cjs",
  external: ["bun:sqlite", "node-llama-cpp", "sqlite-vec"],
  // Suppress handled import.meta.dir warnings — replaced with CJS __dirname fallback
  logOverride: { "empty-import-meta": "silent" },
});

// Copy UI files into plugin/ so the compiled bundle can serve them
cpSync("ui", "plugin/ui", { recursive: true });

console.log("Build complete: plugin/scripts/qrec.cjs + plugin/ui/");
