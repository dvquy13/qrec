# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not open a public GitHub issue**.

Instead, report it privately via [GitHub's private vulnerability reporting](https://github.com/dvquy13/qrec/security/advisories/new).

Please include:
- A description of the vulnerability and its potential impact
- Steps to reproduce
- Your OS and `qrec` version (`qrec --version`)

I aim to respond within 7 days and will keep you updated as I work on a fix.

## Scope

qrec runs entirely locally — it does not transmit session data to any remote server. The embedding model and enrichment model are downloaded from Hugging Face on first run and cached at `~/.qrec/models/`. The daemon listens only on `localhost:25927` by default.
