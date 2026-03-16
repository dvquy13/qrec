#!/usr/bin/env node
"use strict";

const { findBun, installBun } = require("./bun-finder.js");

if (findBun()) {
  process.exit(0);
}

const ok = installBun();
if (!ok) {
  process.stderr.write("[qrec] WARNING: bun auto-install failed. Install manually from https://bun.sh\n");
  // Non-fatal: exit 0 so npm install -g doesn't fail
  process.exit(0);
}
