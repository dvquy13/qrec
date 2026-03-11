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
