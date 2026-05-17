# log.md

> Append-only chronological record of all vault operations (Ingest, Query, Lint).
> Never edit past entries. Always append new entries at the bottom.

| Date       | Op     | Summary                                                                                                                                                          |
| ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-02 | Ingest | Initial grant database catalogue ([[Grant Databases — Full Catalogue]])                                                                                          |
| 2026-04-06 | Ingest | Landscape deep-dive: free APIs, paid DBs, OpenAlex, UK strategy                                                                                                  |
| 2026-04-11 | Ingest | DB-first pipeline design — opportunities/funders as Supabase source of truth, retrieval RPCs                                                                     |
| 2026-04-12 | Ingest | Fix "Opportunity not found" bug — thread UUID through match → propose pipeline via HTML comments                                                                 |
| 2026-04-14 | Ingest | Added user feedback notes (Max Licciardi, Alexandros Zenonos); flattened vault structure                                                                         |
| 2026-04-15 | Ingest | Designed Claude-powered grant discovery loop ([[Claude-Powered Grant Discovery]])                                                                                |
| 2026-04-16 | Lint   | Reorganised vault to Karpathy pattern — added index.md, log.md; updated skill and Home.md                                                                        |
| 2026-04-17 | Lint   | Full restructure to Karpathy three-layer pattern — raw/, wiki/ subfolders (codebase, grants, feedback, strategy, applications, people); added frontmatter schema |
| 2026-04-17 | Lint   | Simplified skill file to generic Karpathy pattern — removed domain-specific workflows                                                                            |
| 2026-04-17 | Lint   | Split personal KG (contacts, applications, raw emails) out to separate private repo `finn-kg`; this vault is now project-only                                      |
| 2026-05-17 | Ingest | Architecture review captured — new `wiki/architecture/` section (8 notes): assessment, security, data model, cost, deployment, AI pipeline, refactor plan ([[Architecture Review Index]]) |
