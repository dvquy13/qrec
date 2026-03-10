#!/usr/bin/env node
// qrec-cli.js — bin entry registered via "bin": { "qrec": "scripts/qrec-cli.js" }
// Injects qrec.cjs as the bun script and delegates all CLI args to bun-runner.js.
//
// When user runs `qrec serve`, process.argv is [node, qrec-cli.js, "serve"].
// After splice: [node, qrec-cli.js, "run", qrec.cjs, "serve"].
// bun-runner takes args = ["run", qrec.cjs, "serve"] → runs: bun run qrec.cjs serve.

"use strict";

const path = require("path");
const qrecCjs = path.join(__dirname, "qrec.cjs");
process.argv.splice(2, 0, "run", qrecCjs);
require("./bun-runner.js");
