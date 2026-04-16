---
active: true
iteration: 1
max_iterations: 60
completion_promise: "DONE"
---

Read docs/superpowers/specs/2026-04-15-scraper-improvement-loop.md then improve one existing grant scraper per iteration following the spec exactly — run the DB quality audit first to pick the worst-performing source, probe its live detail pages, update the source + normaliser + tests, re-ingest, verify the DB improved, then commit.
