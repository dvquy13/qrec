## [0.7.2](https://github.com/dvquy13/qrec/compare/v0.7.1...v0.7.2) (2026-03-20)
## [0.7.1](https://github.com/dvquy13/qrec/compare/v0.7.0...v0.7.1) (2026-03-20)


### Bug Fixes

* prevent config ENOENT log spam and truncate log on daemon restart ([cbde669](https://github.com/dvquy13/qrec/commit/cbde6695109936a644eaa59a73522db0bab7004f))
# [0.7.0](https://github.com/dvquy13/qrec/compare/v0.6.8...v0.7.0) (2026-03-20)


### Bug Fixes

* replace frozen DAEMON_BASE constant with getDaemonBase() in mcp.ts ([ba22158](https://github.com/dvquy13/qrec/commit/ba221588d58ba798dce1b1970548be78e3516d7d))


### Features

* add title generation, uncap learnings, cap questions at 3, sync dashboard project filter to recent sessions ([6c74be6](https://github.com/dvquy13/qrec/commit/6c74be67741dca38f6594947eeaac6b5664ccae8))
* anchor project name to nearest .claude/ dir for monorepo support ([26ab438](https://github.com/dvquy13/qrec/commit/26ab4384fb5d7aa497543258217b54c42b30a483))
* replace MCP proxy with qrec search/get CLI commands ([8518a8d](https://github.com/dvquy13/qrec/commit/8518a8da1261c9ac73e2e6ec984698b344866a4e))
## [0.6.8](https://github.com/dvquy13/qrec/compare/v0.6.7...v0.6.8) (2026-03-20)


### Bug Fixes

* pass env: process.env to Bun.spawn in daemon so --port is inherited ([6cd501a](https://github.com/dvquy13/qrec/commit/6cd501a0460ad6f3554c936f3fb8c55e2e5a16b7))
* remove empty env: key from CI integration test step ([b3fe70c](https://github.com/dvquy13/qrec/commit/b3fe70c00b62df54ccbecd3ed3a60ba280273d06))
## [0.6.7](https://github.com/dvquy13/qrec/compare/v0.6.6...v0.6.7) (2026-03-20)


### Bug Fixes

* config takes precedence over env var for indexIntervalMs; update CI ([f273c02](https://github.com/dvquy13/qrec/commit/f273c022dd4d721773f1611e28a77f904bcae714))
## [0.6.6](https://github.com/dvquy13/qrec/compare/v0.6.5...v0.6.6) (2026-03-20)


### Bug Fixes

* respect QREC_INDEX_INTERVAL_MS env var over config at daemon startup ([50c4be8](https://github.com/dvquy13/qrec/commit/50c4be8f3b7354a28455c8effe5fee357f4ff81f))
## [0.6.5](https://github.com/dvquy13/qrec/compare/v0.6.4...v0.6.5) (2026-03-20)


### Features

* settings UI + centralized config (enrichIdleMs, indexIntervalMs) ([d8bcacb](https://github.com/dvquy13/qrec/commit/d8bcacb52877e01c6705306255a148b925d25e0d))
* show full session UUID in detail view with copy button ([67457b5](https://github.com/dvquy13/qrec/commit/67457b5460ac7a71f83eca4a7056bdadc8fb62b4))
## [0.6.4](https://github.com/dvquy13/qrec/compare/v0.6.4-next.2...v0.6.4) (2026-03-20)


### Features

* add --port flag to CLI commands ([6427d75](https://github.com/dvquy13/qrec/commit/6427d755cb390d7ef1846337487d66ccfc64e7c6))
## [0.6.4-next.2](https://github.com/dvquy13/qrec/compare/v0.6.4-next.1...v0.6.4-next.2) (2026-03-20)


### Bug Fixes

* enable flash attention for Qwen3 enricher on CUDA (Tesla T4) ([39adb92](https://github.com/dvquy13/qrec/commit/39adb92f4538d8df66897fdcf604b37eb61e6eb8)), closes [#261](https://github.com/dvquy13/qrec/issues/261)


### Features

* improve GPU diagnostics and Debug UI ([efab9e5](https://github.com/dvquy13/qrec/commit/efab9e509c25ef1c04309ec0835a036027c852b8))
## [0.6.4-next.1](https://github.com/dvquy13/qrec/compare/v0.6.4-next.0...v0.6.4-next.1) (2026-03-17)


### Features

* GPU/CUDA detection with diagnostics ([16bd724](https://github.com/dvquy13/qrec/commit/16bd7249f3f2ed993d4d9d6756273668f0622722))
## [0.6.4-next.0](https://github.com/dvquy13/qrec/compare/v0.6.3...v0.6.4-next.0) (2026-03-17)


### Bug Fixes

* daemon restart + enrich segfault on Linux (K8s/Tesla T4) ([ec7e7df](https://github.com/dvquy13/qrec/commit/ec7e7dff7ac9ae7fc1f4dbe87d4908eac2a2e1c9))
* don't stale-close index run while phase=indexing ([5aa4a30](https://github.com/dvquy13/qrec/commit/5aa4a30252e60d19220faf8097d1afdd85c208dc))
## [0.6.3](https://github.com/dvquy13/qrec/compare/v0.6.2...v0.6.3) (2026-03-16)


### Bug Fixes

* collapse zero-enrich runs, fix crashed index display, stop no-chunk enrich flooding ([7092486](https://github.com/dvquy13/qrec/commit/7092486c761259adf8c4e44c7d526d17ef76f17e))
## [0.6.2](https://github.com/dvquy13/qrec/compare/v0.6.1...v0.6.2) (2026-03-16)


### Bug Fixes

* install bun during npm install -g via postinstall script ([5162828](https://github.com/dvquy13/qrec/commit/5162828b0c34c7c6f2fcac08e41afba5301efd99))
## [0.6.1](https://github.com/dvquy13/qrec/compare/v0.6.0...v0.6.1) (2026-03-15)


### Bug Fixes

* type dynamic SQL params arrays as SQLQueryBindings[] ([5c89beb](https://github.com/dvquy13/qrec/commit/5c89beb1b604e03834f42a2fb19a6be33d3bb9e2))
# [0.6.0](https://github.com/dvquy13/qrec/compare/v0.5.1...v0.6.0) (2026-03-15)


### Bug Fixes

* prevent tests from polluting production archive and activity log ([83c4ee4](https://github.com/dvquy13/qrec/commit/83c4ee4c99aa20eec2f990d2c10b0419648b241d))


### Features

* server-side search filters + flexible date range picker ([b5338c9](https://github.com/dvquy13/qrec/commit/b5338c95fad01ea16cb041b4245f134de3438fe3)), closes [#date-btn](https://github.com/dvquy13/qrec/issues/date-btn)
## [0.5.1](https://github.com/dvquy13/qrec/compare/v0.5.0...v0.5.1) (2026-03-15)


### Bug Fixes

* **ci:** handle curl ECONNREFUSED in daemon poll loop ([#5](https://github.com/dvquy13/qrec/issues/5)) ([68e0a8a](https://github.com/dvquy13/qrec/commit/68e0a8af0d63ffca584fb62100ce0857d54561ca))
* **ci:** replace qrec onboard with qrec serve --daemon --no-open ([f4ec9e4](https://github.com/dvquy13/qrec/commit/f4ec9e4df05087ac49b4ec6d3c70cfb95f82115d))
* correct prevIndexed sentinel so all sessions appear in activity log ([866a37e](https://github.com/dvquy13/qrec/commit/866a37e92a5f786b9940bf5193f7ef7b6f2a160e))
* **parser:** use git root as project name for worktree sessions ([4f8f5d3](https://github.com/dvquy13/qrec/commit/4f8f5d3152b7989881ff75b8b51083328fac6598))
* **release:** include qrec-mcp.cjs in release commit ([e28acc4](https://github.com/dvquy13/qrec/commit/e28acc47ecfe45be941b56bda67f014bd4606ce8))
* session ordering, activity event flooding, absorb session learnings ([cc65f6e](https://github.com/dvquy13/qrec/commit/cc65f6e0511ef4695022223c4773536c55c26093))
* **ui:** fix model download acitivity incorrec showing up ([36e1d63](https://github.com/dvquy13/qrec/commit/36e1d63555015b3166581dd00ab24a4e39453af8))
* **ui:** polish activity alignment, search UX, and README install commands ([afe4c20](https://github.com/dvquy13/qrec/commit/afe4c20eb31ce6ff78eaa98051f9535b47aa9766))


### Features

* parallel indexing+enriching, last_message_at timestamps, activity UI fixes ([844deda](https://github.com/dvquy13/qrec/commit/844deda6bb37f97d0f3dc6e6ec2c9aa2b2a37b1e))
* **ui:** permanent model download rows + activity ordering fixes ([86a1b16](https://github.com/dvquy13/qrec/commit/86a1b1675933ef6cc7d9148843cbb53079169617))
# [0.5.0](https://github.com/dvquy13/qrec/compare/v0.4.0...v0.5.0) (2026-03-14)


### Bug Fixes

* **ui:** show actual enriched count for stale/crashed enrich runs ([3bacb86](https://github.com/dvquy13/qrec/commit/3bacb86a2e02baf2a5d2e5ce059f4304035bd7e1))


### Features

* **cli:** remove qrec onboard; use qrec serve --daemon for first-run setup ([ad797bf](https://github.com/dvquy13/qrec/commit/ad797bf511a895bec0a05ae1e808030cc4b3caef))
# [0.4.0](https://github.com/dvquy13/qrec/compare/v0.3.5...v0.4.0) (2026-03-14)


### Bug Fixes

* bug time calculation ([61f8b09](https://github.com/dvquy13/qrec/commit/61f8b094f72af58a8ad41cf3e5b3fd07675e31d3))
* **daemon:** kill orphan processes on port 25927 before spawn + QREC_PROJECTS_DIR ([4225bba](https://github.com/dvquy13/qrec/commit/4225bba17b06775b8c3e6d1c47ad59b4d47216b6))
* **server:** cron index scans no longer revert UI to onboarding ([4618cf2](https://github.com/dvquy13/qrec/commit/4618cf22ba0e92082a0d26b36c2277826537cef9))
* **ui:** clean up enriching run spinning ([d69c32b](https://github.com/dvquy13/qrec/commit/d69c32b665d0f7152d6339c78892a155a82e35e6))
* **ui:** server-side date filter for sessions pagination ([1a6a6c9](https://github.com/dvquy13/qrec/commit/1a6a6c9194d6b41bbe3f7199074c19cf43d261d4))
* **ui:** sessions refresh hangs ([cd6848f](https://github.com/dvquy13/qrec/commit/cd6848f0e1fbab059fcc78cf86c5013e0bf02bba))


### Features

* **activity:** expand event coverage + merge Activity tab into Dashboard ([a0b750e](https://github.com/dvquy13/qrec/commit/a0b750e2042cd965b155408473d883900127e271))
* ask enrich to output learnings and questions as well ([7f562d7](https://github.com/dvquy13/qrec/commit/7f562d74534eca13adfc40aa5375ec41f24931a9))
* **enrich:** add debounce to prevent unnecessary enrich work when session hasn't been finished/idle ([121cccd](https://github.com/dvquy13/qrec/commit/121cccd8072b24d69ff2820cd62c79c9abaafebc))
* **enrich:** gate idle filter on last_message_at instead of indexed_at ([4592096](https://github.com/dvquy13/qrec/commit/45920969466728f3aa0190409fe41c0bf5b5c5ef))
* **indexer:** archive JSONL sessions to ~/.qrec/archive/ and drop legacy MD support ([5e1266b](https://github.com/dvquy13/qrec/commit/5e1266b3b108b1d321a75ac020ee737680c2b2d8))
* QREC_DIR + QREC_PORT env vars for isolated test environments ([be3dc40](https://github.com/dvquy13/qrec/commit/be3dc4087b1dc5b39d26ca9d5f8d232f3f837189))
* **ui:** activity lens ([4745dcd](https://github.com/dvquy13/qrec/commit/4745dcdb58538c75751f7750d9d6602a434fa464))
* **ui:** activity lens project filter ([53154ca](https://github.com/dvquy13/qrec/commit/53154cad8fc40c23f8b3fbaae3096c5b37cf78d8))
* **ui:** dashboard face-lift ([5144d9a](https://github.com/dvquy13/qrec/commit/5144d9ae410fdb420cca0bb07ee241df63c4e67d))
* **ui:** group 0-new sessions activities ([062bd24](https://github.com/dvquy13/qrec/commit/062bd24d2b9ef6cd06bff5626b4c3a9e0cbeae3b))
* **ui:** infinite scroll for sessions list ([fb6f703](https://github.com/dvquy13/qrec/commit/fb6f703a6c8793597704d62fd4ee49e5bc606f79))
* **ui:** onboarding as inline dashboard banner + scorecard counter animations ([5261b69](https://github.com/dvquy13/qrec/commit/5261b6925cf70d850c0c5a3d422d43179b8ea05f))
* **ui:** project breakdown tooltips for ActivityLens grid and bars ([ddec5c6](https://github.com/dvquy13/qrec/commit/ddec5c6cd965dc4f023979229ab82f7380a937da))
* **ui:** project colors + last-active sort for activity lens ([9c09b47](https://github.com/dvquy13/qrec/commit/9c09b47ce071cd94f72ade478c8e02b51522542d))
* **ui:** tooltip for ActivityLens grid cells ([9583404](https://github.com/dvquy13/qrec/commit/95834043b73251664ce05ac35ca95c221fde91bd))
* **ui:** update Sessions UI on new face-lift ([80518f8](https://github.com/dvquy13/qrec/commit/80518f84b10dffe08dd25ac8d00a795fd9857628))
## [0.3.5](https://github.com/dvquy13/qrec/compare/v0.3.4...v0.3.5) (2026-03-13)


### Bug Fixes

* resolve static UI assets from correct path in compiled CJS ([40845e7](https://github.com/dvquy13/qrec/commit/40845e7f6664cd3440e91476b7f1d33ea4b3c031))
## [0.3.4](https://github.com/dvquy13/qrec/compare/v0.3.3...v0.3.4) (2026-03-13)


### Bug Fixes

* include ui and plugin assets in npm package files ([edc9a3e](https://github.com/dvquy13/qrec/commit/edc9a3ebee117197288f77bc60364fcb7cbc5054))
## [0.3.3](https://github.com/dvquy13/qrec/compare/v0.3.2...v0.3.3) (2026-03-13)
## [0.3.2](https://github.com/dvquy13/qrec/compare/v0.3.1...v0.3.2) (2026-03-13)
## [0.3.1](https://github.com/dvquy13/qrec/compare/v0.3.0...v0.3.1) (2026-03-12)


### Bug Fixes

* **ci:** update port 25927 → 25729 after server port change ([2fab56d](https://github.com/dvquy13/qrec/commit/2fab56d9fc1ee92e2b1d44572cc65ebb13b24301))
* **ui:** browser back button + logo navigates to dashboard ([c5c5b64](https://github.com/dvquy13/qrec/commit/c5c5b64edc590850ab427e5cf8ce22e9c4522801))
* **ui:** default font ([3dec14b](https://github.com/dvquy13/qrec/commit/3dec14bd97b69e333e868dbd02567d3a8cebf2a9))


### Features

* search highlight ([fcef661](https://github.com/dvquy13/qrec/commit/fcef6610105a56fd74d72cdf637532cd2533bace))
* session UI filters rework ([d7ba77a](https://github.com/dvquy13/qrec/commit/d7ba77a6834e4854c1af206e84b4176606824fed))
* **ui:** merge Search + Sessions into unified tab ([d81c088](https://github.com/dvquy13/qrec/commit/d81c088de4c929b20c9e14f5c6b0950527020578)), closes [#tab-search](https://github.com/dvquy13/qrec/issues/tab-search)
* **ui:** search highlight preview ([bb69d6e](https://github.com/dvquy13/qrec/commit/bb69d6e20cc5a296df1d2fa288b140188dcd5220))
* **ui:** use Inter Variable for body text, Google Sans Flex for UI chrome ([f69578c](https://github.com/dvquy13/qrec/commit/f69578c31d96fb80f15d25c6f6a41dd57cdb01b8))
# [0.3.0](https://github.com/dvquy13/qrec/compare/v0.2.4...v0.3.0) (2026-03-12)


### Features

* session enrichment — AI summaries, tags, entities via Qwen3-1.7B ([807b040](https://github.com/dvquy13/qrec/commit/807b040bafaffb76f2f3cbaa79264101feebc07c))
## [0.2.4](https://github.com/dvquy13/qrec/compare/v0.2.3...v0.2.4) (2026-03-11)


### Features

* add query_db MCP tool for structured SQL recall ([9f737d1](https://github.com/dvquy13/qrec/commit/9f737d156e65f3b51aec114fc5bd7b7a8f748b4c))
* plugin MCP agent recall integration ([42b3c8b](https://github.com/dvquy13/qrec/commit/42b3c8b349bd59652b4c08e82d948b0289bdef79))
## [0.2.3](https://github.com/dvquy13/qrec/compare/v0.2.2...v0.2.3) (2026-03-11)


### Bug Fixes

* pass TTY stdin through to bun child in qrec-cli.js ([cf36eb6](https://github.com/dvquy13/qrec/commit/cf36eb61841178b9c3d74f04fdc407c89e962919))
## [0.2.2](https://github.com/dvquy13/qrec/compare/v0.2.1...v0.2.2) (2026-03-11)


### Bug Fixes

* **ci:** update /sessions jq query for new metadata response format ([7d1731f](https://github.com/dvquy13/qrec/commit/7d1731fcf77474603fbb5cc4cf7bc5f1249a1b5b))
* inline ui/index.html into CJS bundle at build time ([68f59da](https://github.com/dvquy13/qrec/commit/68f59dac79d5102ab5a236b014613c294520663e))
## [0.2.2](https://github.com/dvquy13/qrec/compare/v0.2.1...v0.2.2) (2026-03-11)


### Bug Fixes

* **ci:** update /sessions jq query for new metadata response format ([7d1731f](https://github.com/dvquy13/qrec/commit/7d1731fcf77474603fbb5cc4cf7bc5f1249a1b5b))
* inline ui/index.html into CJS bundle at build time ([68f59da](https://github.com/dvquy13/qrec/commit/68f59dac79d5102ab5a236b014613c294520663e))
## [0.2.1](https://github.com/dvquy13/qrec/compare/v0.2.0...v0.2.1) (2026-03-11)


### Bug Fixes

* add --access public to npm publish in release.sh ([270b8ae](https://github.com/dvquy13/qrec/commit/270b8ae6b57d65f366f20eca674f5ce74c9c09d7))
* **ci:** update npm pack glob for scoped package @dvquys/qrec ([dc0ac91](https://github.com/dvquy13/qrec/commit/dc0ac91cb01af7da04d4e5c8451d8f40eb88bf98))


### Features

* **ui:** sessions list, detail view, mobile responsive, markdown rendering ([172f4ba](https://github.com/dvquy13/qrec/commit/172f4bae77bec01bd9ed0c0cb11b883be996504c)), closes [#sessions](https://github.com/dvquy13/qrec/issues/sessions)
# [0.2.0](https://github.com/dvquy13/qrec/compare/v0.1.5...v0.2.0) (2026-03-10)
## [0.1.5](https://github.com/dvquy13/qrec/compare/v0.1.4...v0.1.5) (2026-03-10)


### Bug Fixes

* bun-runner.js stdin hang causes SessionStart hook error ([75af8fb](https://github.com/dvquy13/qrec/commit/75af8fb555ccd2f16620549bf8627f8e64fb92e0))
## [0.1.4](https://github.com/dvquy13/qrec/compare/v0.1.3...v0.1.4) (2026-03-10)


### Features

* **ui:** add control center dashboard with automated onboarding and progress tracking ([8ff2773](https://github.com/dvquy13/qrec/commit/8ff27734872759d78ba2bb148d38e4609b5e9a70))
## [0.1.3](https://github.com/dvquy13/qrec/compare/v0.1.2...v0.1.3) (2026-03-10)


### Bug Fixes

* **ci:** run smart-install synchronously in CI environment ([6de2e9d](https://github.com/dvquy13/qrec/commit/6de2e9dba650f8a77bd66f12d4b17abb17bb2a93))
* sync plugins[].version in marketplace.json + fix sync script ([255aaa9](https://github.com/dvquy13/qrec/commit/255aaa9122b11224e26d69fe379f96f9508e202d))


### Features

* **skills:** comprehensive qrec skill — auto-invokable, full knowledge base ([6a04993](https://github.com/dvquy13/qrec/commit/6a04993fbfb8e3e01233ace8f4ad5a367bcc1965))
## [0.1.2](https://github.com/dvquy13/qrec/compare/v0.1.1...v0.1.2) (2026-03-10)


### Bug Fixes

* background installer, UI files in git, correct HF model URI ([001bcb9](https://github.com/dvquy13/qrec/commit/001bcb9778609986e25ff8de85a543aeb080b214))
## [0.1.1](https://github.com/dvquy13/qrec/compare/v0.1.0...v0.1.1) (2026-03-10)


### Bug Fixes

* correct marketplace.json schema — owner as object, add plugins array ([c8bb94d](https://github.com/dvquy13/qrec/commit/c8bb94d5d3642ba47e50125e85f08dcccec16adb))
# 0.1.0 (2026-03-10)


### Bug Fixes

* **ci:** add QREC_EMBED_PROVIDER=stub to MCP test step, fail-fast: false ([19fb111](https://github.com/dvquy13/qrec/commit/19fb1113c8b7c7bb24d21626d0d05a70edc81462))
* **ci:** commit ui/ HTML files, scope gitignore to eval/**/*.html ([339412f](https://github.com/dvquy13/qrec/commit/339412f431baf03e995b9904631bf2e50cce4224))
* **ci:** remove timeout from MCP test — not available on macos-latest ([e442cb3](https://github.com/dvquy13/qrec/commit/e442cb38ad70ca1a5ef59ad7924ab15b7f5c1fd0))
* **ci:** stub embed provider, fix indexer factory bypass, add node_modules cache ([bd710fc](https://github.com/dvquy13/qrec/commit/bd710fc13995b742c48129aefe1500f0c7d6df0c))


### Features

* **dist:** M6 distribution — smart-install, CI bootstrap, npm publish ([e342d0c](https://github.com/dvquy13/qrec/commit/e342d0c173cfdc15e6acbfc8a0e93f12d791061d))
* initial release — qrec session recall engine v0.1.0 ([a59494c](https://github.com/dvquy13/qrec/commit/a59494c2537da5b337f7f430a1ddb6e1a974bb01))
