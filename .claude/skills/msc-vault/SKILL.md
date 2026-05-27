---
name: msc-vault
description: Read, search, and update the MSc project wiki at ~/Developer/grant-researcher-msc/. Use when answering questions about the MSc project (deadlines, supervisor, proposal, presentation, final report, RPP logbook, project design, lit review, meetings) or when adding/maintaining notes in that vault.
---

# MSc Vault

A karpathy-style LLM wiki for Finn's MSc Individual Research Project (COMM424DA, University of Exeter, 2025/26). The vault is **the source of truth** for everything project-related: deadlines, scope, supervisor interactions, plan, lit review, RPP entries.

## Vault location

`/home/finn-rea/Developer/grant-researcher-msc/`

This is a **separate private repo** (`finnrea78/grant-researcher-msc` on GitHub) from the application code at `/home/finn-rea/Developer/grant-researcher/`. Academic content (supervisor, meetings, ethics, RPP) is kept private; the application repo can be open-sourced without exposing it.

## Strategy: orienteer first, then follow wikilinks

Don't grep the whole vault when answering a question. Don't re-explore on every session. Always start at the orienteer, then follow wikilinks.

```
Home.md  →  wiki/module/Module Index.md  →  follow [[wikilinks]] to depth
            wiki/index.md (full catalog)
            wiki/log.md (recent activity)
```

**`Module Index.md`** is the ~2-min session-start orienteer. Read it first when picking the project back up.

**`wiki/index.md`** is the master catalog — one-line summary per note, organised by category. Use when looking for a specific note by topic.

**`Home.md`** is the entry point — top-of-mind dates, vault structure, project summary.

## Vault structure

```
grant-researcher-msc/
├── Home.md          ← entry point (top-of-mind dates, project summary)
└── wiki/
    ├── index.md     ← master catalog (all notes, one-line summaries)
    ├── log.md       ← append-only activity log (newest first)
    ├── module/      ← COMM424DA: Module Index, Extended Timeline, Contacts, Ethics, GenAI Policy
    ├── assessments/ ← Project Proposal, Presentation, Final Report, RPP
    ├── project/     ← Project Description, Aims, Originality, Phase 1, Phase 2, Datasets, Methods
    ├── plan/        ← Project Plan, Work Packages, Risk Register
    ├── meetings/    ← Eugene Kozlovski Meetings, per-meeting pages
    └── literature/  ← Literature Index, per-paper notes
```

## When to read what

| Question / task | Read first |
|-----------------|-----------|
| "What's due when?" / "How many days until X?" | `wiki/module/Extended Timeline.md` |
| "What's the project about?" | `wiki/project/Project Description.md` then `wiki/project/Aims & Objectives.md` |
| "What's the gap / contribution?" | `wiki/project/Originality.md` |
| Anything about a specific assessment | `wiki/assessments/<name>.md` |
| Anything about a phase of the research | `wiki/project/Phase 1 — *.md` or `Phase 2 — *.md` |
| What to do this week / overall plan | `wiki/plan/Project Plan.md` |
| Risks / what could go wrong | `wiki/plan/Risk Register.md` |
| Something Eugene said / meeting prep | `wiki/meetings/Eugene Kozlovski Meetings.md` then the per-meeting page |
| Lit review status / target papers | `wiki/literature/Literature Index.md` |
| Recent activity / what changed lately | `wiki/log.md` |
| Ethics question | `wiki/module/Ethics & Worktribe.md` |
| GenAI declaration / policy | `wiki/module/GenAI Policy.md` |
| Contacts (supervisor, module leader, support) | `wiki/module/Contacts.md` |

If it's not obvious, start at `wiki/module/Module Index.md` — it cross-links to everything else.

## Linking conventions

- **Wikilinks**: `[[Note Title]]` — same as Obsidian, no extension, no path
- Notes cross-link liberally; index pages are mostly lists of wikilinks
- Don't worry about updating every backlink when renaming — but do update `wiki/index.md` and `Home.md` if a note name changes

## Search workflows

### By filename
```bash
find /home/finn-rea/Developer/grant-researcher-msc -name "*.md" | grep -i "keyword"
```

### By content
```bash
grep -rl "keyword" /home/finn-rea/Developer/grant-researcher-msc --include="*.md"
```

### Backlinks (who links to a note?)
```bash
grep -rl "\\[\\[Note Title\\]\\]" /home/finn-rea/Developer/grant-researcher-msc --include="*.md"
```

Prefer `Grep` / `Glob` tools over Bash for these — faster and respects ignore rules.

## Writing notes

### Naming
- Title Case (e.g., `Project Plan.md`, `Risk Register.md`)
- Use em-dashes for "X — Y" format where the second part is a qualifier (`Phase 1 — Grant Discovery Evaluation.md`)
- One file per concept; flat-ish within each folder; folders for category, not for hierarchy beyond one level

### Structure of a good note

```markdown
# Title

> One-line description so the index entry can be lifted directly.

## Section
Concise content. No filler. Bullet points where they help, prose where they help more.

## Cross-references
- [[Other Note]] — why it's relevant
- [[Another Note]] — why it's relevant
```

Notes don't need a uniform structure — a meeting page differs from a phase-design page differs from a risk register. **Match the structure to the content.** What matters: clear headings, concise content, wikilinks to related notes.

### When creating a new note

1. Pick the right folder (`module/`, `assessments/`, `project/`, `plan/`, `meetings/`, `literature/`)
2. Add a one-line entry to `wiki/index.md` under the right category
3. Add a brief mention to `wiki/log.md` if the note marks a real event/decision
4. Cross-link from existing notes that are now related (e.g., a new lit-review entry should be linked from `wiki/literature/Literature Index.md`)

## Updating the vault during a session

When a session uncovers something new (a decision, a paper read, a meeting outcome, a new risk):

- **Edit notes in place** — don't append "Update 2026-XX-XX" sections; integrate the change.
- **Append to `wiki/log.md`** — single bullet, date-prefixed, newest at top.
- **Update `wiki/index.md`** if a note's purpose has materially changed.
- **Don't sprawl** — if a topic is short, add a section to an existing note rather than creating a new file.

## Hard constraints

- **Don't fabricate dates.** ELE assignment listing is the source of truth for deadlines (see `wiki/module/Extended Timeline.md`). PDFs in `~/Downloads/MSc_*.pdf` show *original* (non-extended) dates that don't apply to Finn — never quote them.
- **Don't conflate vaults.** Engineering notes (the codebase) live in `research-docs/`; MSc / academic notes live here. Cross-link conceptually, but don't duplicate content.
- **Treat the vault as memory, not draft.** It's there so that future sessions can reload context fast. Keep it accurate and up-to-date; resist filling it with speculative scaffolding.
- **Today's date** comes from the system context, not from log file dates. Always compute "days until X" from the current system date.

## Companion vaults

- `research-docs/` — engineering wiki for the prototype being evaluated. Use the `obsidian-vault` skill for that vault. Cross-link from the final-report sections that describe system architecture.
