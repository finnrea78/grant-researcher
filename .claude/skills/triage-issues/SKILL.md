---
name: triage-issues
description: Use when the user wants to audit open GitHub issues — identifying which have already been implemented in the codebase, which are stale, and which are still active work. Triggered by phrases like "review my issues", "clean up issues", "which issues are done", or "triage issues".
---

# Triage Issues

Review all open GitHub issues and classify each as DONE, STALE, or ACTIVE — then close the ones that no longer need to be open.

## Process

### 1. Fetch all open issues

```bash
gh issue list --state open --limit 100 --json number,title,body,createdAt,updatedAt,labels
```

### 2. Classify each issue

For each issue, run these checks in order:

**Check DONE — work already shipped:**
- Search git log for commits that reference the issue title or number: `git log --oneline | grep -i "<keyword>"`
- Grep the codebase for the key functionality described: `grep -r "<keyword>" src/`
- Look for a closed PR linked to the issue: `gh pr list --state closed --search "<keyword>"`

**Check STALE — no longer relevant:**
- Last updated > 60 days ago with no linked PR or commit
- Issue describes work that conflicts with current architecture (e.g. issue about a file that no longer exists)
- Issue is a planning/research artifact that was superseded by actual implementation

**Otherwise: ACTIVE** — genuine future work that hasn't been started.

### 3. Produce a triage table

Output a markdown table before taking any action:

| # | Title | Classification | Reason |
|---|-------|----------------|--------|
| 42 | feat: retry handling | ACTIVE | Not implemented — no retry logic found in src/lib/ |
| 13 | Loading states | DONE | Implemented in PR #39, components exist in src/components/ |
| 5  | Claude API wrapper | STALE | Superseded by @anthropic-ai/claude-agent-sdk usage |

### 4. Confirm before closing

**Always show the table and ask for confirmation before closing any issues.**

Say: *"Ready to close the DONE and STALE issues above — shall I proceed?"*

### 5. Close with explanation

For each confirmed issue to close:

```bash
# DONE
gh issue close <number> --comment "Closing — this work was completed in <PR/commit reference>."

# STALE
gh issue close <number> --comment "Closing as stale — <reason, e.g. superseded by current architecture>."
```

## Staleness heuristics

| Signal | Weight |
|--------|--------|
| Last updated > 90 days ago | Strong stale signal |
| Last updated 30–90 days ago + no PR | Moderate signal |
| Issue body references files/patterns that no longer exist | Strong stale signal |
| Issue is labelled `planning`, `research`, or `architecture` | Check if superseded |
| Issue has `bug` label and bug is no longer reproducible | Strong done signal |

## Rules

- **Never close without confirmation.** Show the full table first.
- **Be conservative with DONE.** Only classify as done if you can point to specific code or a commit — don't assume.
- **Read the issue body.** Titles are ambiguous; the body describes the actual work.
- **One pass, then confirm.** Don't close issues one by one mid-analysis — complete the full triage first.
